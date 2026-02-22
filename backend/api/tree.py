# Tree visualization API endpoint.
# Provides a pre-computed tree structure centered on a given individual,
# traversing family relationships via BFS up to requested depth.

from collections import deque
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Dict, List, Optional, Set, Tuple

from .. import schemas
import database.models as models
import database.db

router = APIRouter(prefix="/individuals", tags=["tree"])

MAX_DEPTH_CAP = 20  # Safety limit for BFS traversal


def _get_display_name(individual: models.Individual) -> str:
    """Get display name from the individual's names, preferring primary (lowest name_order)."""
    if not individual.names:
        return "Unnamed"
    # Sort by name_order (None last), pick first
    sorted_names = sorted(
        individual.names,
        key=lambda n: (n.name_order if n.name_order is not None else 9999, n.id),
    )
    name = sorted_names[0]
    display = f"{name.given_name or ''} {name.family_name or ''}".strip()
    return display or "Unnamed"


def _get_birth_sort_key(individual: models.Individual):
    """Return a sort key for ordering children elder-to-younger (left-to-right).
    Individuals with known birth dates come first (sorted ascending).
    Individuals without dates are placed at the end.
    """
    if individual.birth_date:
        return (0, str(individual.birth_date))
    if individual.birth_date_approx:
        # Extract year from approx date (e.g. "ABT 1970" -> "1970")
        parts = (individual.birth_date_approx or "").split()
        for part in reversed(parts):
            if part.isdigit() and len(part) == 4:
                return (0, part)
    return (1, "9999")  # No date → sort to the end


PREFERRED_AGE = 35


def _get_photo_url(individual: models.Individual) -> Optional[str]:
    """Get the best photo URL for tree display.

    Priority: explicit default → closest to age 35 → first available.
    """
    first_url: Optional[str] = None
    best_age_url: Optional[str] = None
    best_age_diff = float("inf")

    for m in individual.media:
        if m.media_type_code == "photo" and m.file_path:
            url = f"/api/media/{m.id}/file"
            if m.is_default:
                return url
            if first_url is None:
                first_url = url
            if m.age_on_photo is not None:
                diff = abs(m.age_on_photo - PREFERRED_AGE)
                if diff < best_age_diff:
                    best_age_diff = diff
                    best_age_url = url

    return best_age_url or first_url


def _get_all_photos(individual: models.Individual) -> List[schemas.TreeNodePhoto]:
    """Build the list of photos for the carousel, sorted by age.

    If no photo carries an explicit ``is_default`` flag the one whose age is
    closest to 35 is promoted to effective default so the frontend shows a
    sensible rest-state photo without extra logic.
    """
    photos = []
    has_explicit_default = False
    for m in individual.media:
        if m.media_type_code == "photo" and m.file_path:
            is_def = bool(m.is_default)
            if is_def:
                has_explicit_default = True
            photos.append(
                schemas.TreeNodePhoto(
                    url=f"/api/media/{m.id}/file",
                    age=m.age_on_photo,
                    is_default=is_def,
                )
            )
    photos.sort(key=lambda p: (p.age if p.age is not None else 9999))

    if not has_explicit_default and photos:
        best_idx = 0
        best_diff = float("inf")
        for i, p in enumerate(photos):
            if p.age is not None:
                diff = abs(p.age - PREFERRED_AGE)
                if diff < best_diff:
                    best_diff = diff
                    best_idx = i
        photos[best_idx].is_default = True

    return photos


def _build_node(
    individual: models.Individual,
    generation: int,
    event_type_map: Dict[str, str],
) -> schemas.TreeNode:
    """Build a TreeNode from an ORM Individual."""
    events = []
    for evt in sorted(
        individual.events,
        key=lambda e: (str(e.event_date or ""), e.event_date_approx or "", e.id),
    ):
        events.append(
            schemas.TreeNodeEvent(
                event_type=event_type_map.get(evt.event_type_code, evt.event_type_code),
                event_date=str(evt.event_date) if evt.event_date else None,
                event_date_approx=evt.event_date_approx,
                event_place=evt.event_place,
                description=evt.description,
            )
        )

    return schemas.TreeNode(
        id=individual.id,
        gedcom_id=individual.gedcom_id,
        sex_code=individual.sex_code,
        display_name=_get_display_name(individual),
        birth_date=str(individual.birth_date) if individual.birth_date else None,
        birth_date_approx=individual.birth_date_approx,
        death_date=str(individual.death_date) if individual.death_date else None,
        death_date_approx=individual.death_date_approx,
        photo_url=_get_photo_url(individual),
        photos=_get_all_photos(individual),
        generation=generation,
        events=events,
    )


def _compute_max_depth(
    db: Session,
    start_id: int,
    direction: str,  # "ancestors" or "descendants"
) -> int:
    """Compute the maximum number of generations available in a direction.
    Uses iterative BFS with cycle detection, capped at MAX_DEPTH_CAP.
    """
    visited: Set[int] = {start_id}
    frontier: Set[int] = {start_id}
    depth = 0

    while frontier and depth < MAX_DEPTH_CAP:
        next_frontier: Set[int] = set()

        if direction == "ancestors":
            # For each person in frontier, find families where they are a child,
            # then get the family members (parents)
            family_children = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.child_id.in_(frontier))
                .all()
            )
            family_ids = {fc.family_id for fc in family_children}
            if not family_ids:
                break
            family_members = (
                db.query(models.FamilyMember)
                .filter(models.FamilyMember.family_id.in_(family_ids))
                .all()
            )
            for fm in family_members:
                if fm.individual_id not in visited:
                    visited.add(fm.individual_id)
                    next_frontier.add(fm.individual_id)
        else:
            # For each person in frontier, find families where they are a member,
            # then get the family children
            family_members = (
                db.query(models.FamilyMember)
                .filter(models.FamilyMember.individual_id.in_(frontier))
                .all()
            )
            family_ids = {fm.family_id for fm in family_members}
            if not family_ids:
                break
            family_children = (
                db.query(models.FamilyChild)
                .filter(models.FamilyChild.family_id.in_(family_ids))
                .all()
            )
            for fc in family_children:
                if fc.child_id not in visited:
                    visited.add(fc.child_id)
                    next_frontier.add(fc.child_id)

        if not next_frontier:
            break
        frontier = next_frontier
        depth += 1

    return depth


@router.get("/{individual_id}/tree", response_model=schemas.TreeResponse)
def get_individual_tree(
    individual_id: int,
    ancestor_depth: int = Query(default=1, ge=0, le=MAX_DEPTH_CAP),
    descendant_depth: int = Query(default=1, ge=0, le=MAX_DEPTH_CAP),
    db: Session = Depends(database.db.get_db),
):
    """Get the family tree centered on an individual.

    Returns a tree structure with nodes (individuals), edges (parent-child links),
    and couples (partner pairs) up to the requested ancestor/descendant depth.
    """
    # Verify the focus individual exists
    focus = (
        db.query(models.Individual)
        .options(
            joinedload(models.Individual.names),
            joinedload(models.Individual.events),
            joinedload(models.Individual.media),
        )
        .filter(models.Individual.id == individual_id)
        .first()
    )
    if not focus:
        raise HTTPException(status_code=404, detail="Individual not found")

    # Load event type descriptions for human-readable names
    from sqlalchemy import text as sql_text
    event_type_rows = db.execute(
        sql_text("SELECT code, description FROM lookup_event_types")
    ).fetchall()
    event_type_map: Dict[str, str] = {row[0]: row[1] for row in event_type_rows}

    # Collect all individuals, edges, and couples
    collected_ids: Set[int] = {individual_id}
    individual_generation: Dict[int, int] = {individual_id: 0}
    edges: List[schemas.TreeEdge] = []
    couples: List[schemas.TreeCouple] = []
    seen_families: Set[int] = set()

    # ---- BFS Upward (ancestors) ----
    ancestor_frontier: Set[int] = {individual_id}
    for depth_level in range(1, ancestor_depth + 1):
        if not ancestor_frontier:
            break
        # Find families where frontier individuals are children
        family_children = (
            db.query(models.FamilyChild)
            .filter(models.FamilyChild.child_id.in_(ancestor_frontier))
            .all()
        )
        # Group by child to process each child's parent family
        child_to_families: Dict[int, List[int]] = {}
        for fc in family_children:
            child_to_families.setdefault(fc.child_id, []).append(fc.family_id)

        family_ids = {fc.family_id for fc in family_children}
        if not family_ids:
            break

        # Load families with members
        families = (
            db.query(models.Family)
            .options(joinedload(models.Family.members))
            .filter(models.Family.id.in_(family_ids))
            .all()
        )
        family_map = {f.id: f for f in families}

        next_frontier: Set[int] = set()
        for family in families:
            family_type = family.family_type or "marriage"
            relationship = "biological" if family_type == "marriage" else "non-biological"

            # Record couple
            if family.id not in seen_families:
                seen_families.add(family.id)
                partner_ids = [m.individual_id for m in family.members]
                couples.append(
                    schemas.TreeCouple(
                        family_id=family.id,
                        partner_ids=partner_ids,
                        marriage_date=str(family.marriage_date) if family.marriage_date else None,
                        marriage_date_approx=family.marriage_date_approx,
                        divorce_date=str(family.divorce_date) if family.divorce_date else None,
                        family_type=family_type,
                    )
                )

            # Get parent individuals from this family
            for member in family.members:
                parent_id = member.individual_id
                if parent_id not in collected_ids:
                    collected_ids.add(parent_id)
                    individual_generation[parent_id] = -depth_level
                    next_frontier.add(parent_id)

                # Add edges from parents to children in this family that are in our frontier
                for fc in family_children:
                    if fc.family_id == family.id and fc.child_id in ancestor_frontier:
                        edges.append(
                            schemas.TreeEdge(
                                parent_id=parent_id,
                                child_id=fc.child_id,
                                family_id=family.id,
                                relationship=relationship,
                            )
                        )

        ancestor_frontier = next_frontier

    # ---- BFS Downward (descendants) ----
    descendant_frontier: Set[int] = {individual_id}
    for depth_level in range(1, descendant_depth + 1):
        if not descendant_frontier:
            break
        # Find families where frontier individuals are members (parents/spouses)
        family_members = (
            db.query(models.FamilyMember)
            .filter(models.FamilyMember.individual_id.in_(descendant_frontier))
            .all()
        )
        family_ids = {fm.family_id for fm in family_members}
        if not family_ids:
            break

        # Load families with children and members
        families = (
            db.query(models.Family)
            .options(
                joinedload(models.Family.children),
                joinedload(models.Family.members),
            )
            .filter(models.Family.id.in_(family_ids))
            .all()
        )

        next_frontier: Set[int] = set()
        for family in families:
            family_type = family.family_type or "marriage"
            relationship = "biological" if family_type == "marriage" else "non-biological"

            # Record couple (if not already recorded from ancestor pass)
            if family.id not in seen_families:
                seen_families.add(family.id)
                partner_ids = [m.individual_id for m in family.members]
                # Also add the spouse if not yet collected
                for m in family.members:
                    if m.individual_id not in collected_ids:
                        collected_ids.add(m.individual_id)
                        # Spouses are at the same generation as the frontier member
                        # Find the generation of the frontier member in this family
                        spouse_gen = 0
                        for fm in family_members:
                            if fm.family_id == family.id and fm.individual_id in descendant_frontier:
                                spouse_gen = individual_generation.get(fm.individual_id, 0)
                                break
                        individual_generation[m.individual_id] = spouse_gen

                couples.append(
                    schemas.TreeCouple(
                        family_id=family.id,
                        partner_ids=partner_ids,
                        marriage_date=str(family.marriage_date) if family.marriage_date else None,
                        marriage_date_approx=family.marriage_date_approx,
                        divorce_date=str(family.divorce_date) if family.divorce_date else None,
                        family_type=family_type,
                    )
                )

            # Get children
            for fc in family.children:
                child_id = fc.child_id
                if child_id not in collected_ids:
                    collected_ids.add(child_id)
                    individual_generation[child_id] = depth_level
                    next_frontier.add(child_id)

                # Add edges from each parent in this family to the child
                for member in family.members:
                    edges.append(
                        schemas.TreeEdge(
                            parent_id=member.individual_id,
                            child_id=child_id,
                            family_id=family.id,
                            relationship=relationship,
                        )
                    )
                    # Make sure the parent is collected (e.g. a spouse not in the frontier)
                    if member.individual_id not in collected_ids:
                        collected_ids.add(member.individual_id)
                        spouse_gen = individual_generation.get(
                            next(
                                (fm.individual_id for fm in family_members
                                 if fm.family_id == family.id and fm.individual_id in descendant_frontier),
                                individual_id,
                            ),
                            0,
                        )
                        individual_generation[member.individual_id] = spouse_gen

        descendant_frontier = next_frontier

    # ---- Load all collected individuals ----
    individuals = (
        db.query(models.Individual)
        .options(
            joinedload(models.Individual.names),
            joinedload(models.Individual.events),
            joinedload(models.Individual.media),
        )
        .filter(models.Individual.id.in_(collected_ids))
        .all()
    )
    individual_map = {ind.id: ind for ind in individuals}

    # ---- Build nodes (sort children by birth date for left-to-right ordering) ----
    nodes: List[schemas.TreeNode] = []
    for ind_id in collected_ids:
        ind = individual_map.get(ind_id)
        if ind:
            gen = individual_generation.get(ind_id, 0)
            nodes.append(_build_node(ind, gen, event_type_map))

    # Sort nodes: by generation first (ascending = ancestors first), then by birth sort key
    nodes.sort(key=lambda n: (
        n.generation,
        (0, n.birth_date or "") if n.birth_date else (0, n.birth_date_approx or "") if n.birth_date_approx else (1, "9999"),
    ))

    # ---- Compute max available depths ----
    max_ancestor_depth = _compute_max_depth(db, individual_id, "ancestors")
    max_descendant_depth = _compute_max_depth(db, individual_id, "descendants")

    return schemas.TreeResponse(
        focus_id=individual_id,
        max_ancestor_depth=max_ancestor_depth,
        max_descendant_depth=max_descendant_depth,
        nodes=nodes,
        edges=edges,
        couples=couples,
    )
