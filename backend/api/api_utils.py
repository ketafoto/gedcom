from sqlalchemy.orm import Session, joinedload
from sqlalchemy import inspect
from typing import List, Optional
import database.models


def _format_individual_name(individual: database.models.Individual) -> str:
    """Format an individual's name from their first name record."""
    if not individual.names:
        return f"Individual {individual.gedcom_id}"
    name = individual.names[0]
    parts = []
    if name.given_name:
        parts.append(name.given_name)
    if name.family_name:
        parts.append(name.family_name)
    return " ".join(parts) if parts else f"Individual {individual.gedcom_id}"


def generate_family_note(
    db: Session,
    members: List[dict],
    children: List[dict],
    family_type: Optional[str] = None
) -> Optional[str]:
    """
    Generate a descriptive note for a family based on members and children.

    Args:
        db: SQLAlchemy Session object
        members: List of dicts with 'individual_id' and 'role' keys
        children: List of dicts with 'child_id' key
        family_type: Optional family type (e.g., "marriage", "same-sex")

    Returns:
        Generated note string, or None if no members/children
    """
    if not members and not children:
        return None

    member_names = []
    husband_name = None
    wife_name = None
    husband_sex = None
    wife_sex = None

    # Get member names and sex codes
    for member in members:
        individual = db.query(database.models.Individual).options(
            joinedload(database.models.Individual.names)
        ).filter(
            database.models.Individual.id == member.get("individual_id")
        ).first()
        if individual:
            name = _format_individual_name(individual)
            role = member.get("role")
            if role == "husband":
                husband_name = name
                husband_sex = individual.sex_code
            elif role == "wife":
                wife_name = name
                wife_sex = individual.sex_code
            else:
                member_names.append(name)

    # Get children names
    child_names = []
    for child in children:
        individual = db.query(database.models.Individual).options(
            joinedload(database.models.Individual.names)
        ).filter(
            database.models.Individual.id == child.get("child_id")
        ).first()
        if individual:
            child_names.append(_format_individual_name(individual))

    # Build note
    note_parts = []

    # Check if same-sex marriage
    is_same_sex = False
    if family_type == "same-sex":
        is_same_sex = True
    elif husband_name and wife_name and husband_sex and wife_sex:
        # Check if both have same sex code (both M or both F)
        if husband_sex == wife_sex:
            is_same_sex = True

    # Family members part
    if husband_name and wife_name:
        if is_same_sex:
            note_parts.append(f"Same-sex marriage of {husband_name} and {wife_name}")
        else:
            note_parts.append(f"Family of {husband_name} and {wife_name}")
    elif husband_name:
        note_parts.append(f"Family of {husband_name}")
    elif wife_name:
        note_parts.append(f"Family of {wife_name}")
    elif member_names:
        if len(member_names) == 2:
            note_parts.append(f"Family of {member_names[0]} and {member_names[1]}")
        else:
            note_parts.append(f"Family of {', '.join(member_names)}")

    # Children part
    if child_names:
        if len(child_names) == 1:
            note_parts.append(f"parents of {child_names[0]}")
        elif len(child_names) == 2:
            note_parts.append(f"parents of {child_names[0]} and {child_names[1]}")
        else:
            # For 3+ children, list first two and "and X others" or just list them all
            if len(child_names) <= 4:
                names_str = ", ".join(child_names[:-1]) + f" and {child_names[-1]}"
            else:
                names_str = ", ".join(child_names[:3]) + f" and {len(child_names) - 3} others"
            note_parts.append(f"parents of {names_str}")

    return ", ".join(note_parts) if note_parts else None


def generate_gedcom_id(db: Session, model) -> str:
    """
    Generate a unique GEDCOM ID for the given table/model.
    Assumes model has 'gedcom_id' string column with format: Letter + digits.

    Args:
        db: SQLAlchemy Session object
        model: SQLAlchemy model class to generate ID for (e.g., Individual)

    Returns:
        New unique gedcom_id string (e.g., 'I00001')
    """
    max_id = 0
    # Reflect column presence for safety
    mapper = inspect(model)
    if 'gedcom_id' not in mapper.columns:
        raise ValueError(f'Model {model} does not have a gedcom_id column')

    items = db.query(model).filter(model.gedcom_id != None).all()

    for item in items:
        gedcom_id = item.gedcom_id
        if gedcom_id and len(gedcom_id) > 1 and gedcom_id[1:].isdigit():
            if gedcom_id[0].isalpha():
                num = int(gedcom_id[1:])
                if num > max_id:
                    max_id = num

    return f"{max_id + 1:05d}"
