import type { TreeData, TreeNode, TreeCouple } from '../types/models';
import type { Node, Edge } from '@xyflow/react';

// Dimensions of each person node in pixels
export const NODE_WIDTH = 150;
export const NODE_HEIGHT = 190;
const H_GAP = 40;       // Horizontal gap between sibling nodes
const V_GAP = 100;       // Vertical gap between generations
const COUPLE_GAP = 20;   // Horizontal gap between partners in a couple

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Custom tree layout engine for family trees.
 *
 * Strategy:
 *   1. Group nodes by generation (negative = ancestors, 0 = focus, positive = descendants).
 *   2. Within each generation, order nodes by:
 *      - Couples are placed side-by-side.
 *      - Children of a couple are grouped beneath their parents.
 *      - Children sorted elder-to-younger (left-to-right) by birth date (API pre-sorts).
 *   3. Compute x positions bottom-up for descendants, top-down for ancestors,
 *      centering parents over their children.
 */
export function computeTreeLayout(data: TreeData): LayoutResult {
  const nodeMap = new Map<number, TreeNode>();
  for (const n of data.nodes) nodeMap.set(n.id, n);

  // Group nodes by generation
  const genGroups = new Map<number, number[]>();
  for (const n of data.nodes) {
    const ids = genGroups.get(n.generation) || [];
    ids.push(n.id);
    genGroups.set(n.generation, ids);
  }

  // Build lookup: family_id → couple (partner ids)
  const coupleByFamily = new Map<number, TreeCouple>();
  for (const c of data.couples) coupleByFamily.set(c.family_id, c);

  // Build lookup: family_id → child ids
  const childrenByFamily = new Map<number, Set<number>>();
  for (const e of data.edges) {
    const kids = childrenByFamily.get(e.family_id) || new Set();
    kids.add(e.child_id);
    childrenByFamily.set(e.family_id, kids);
  }

  // Merged children by "couple key": for layout, treat children from families that share
  // the same parents (or a subset, e.g. one parent) as one sibling group. So if Tom is
  // in a family with only Alona and Aya/Sonya are in a family with Igor+Alona, we show
  // all three as siblings under Igor+Alona.
  const coupleKey = (partnerIds: number[]) => [...partnerIds].sort((a, b) => a - b).join(',');
  const mergedChildrenByCoupleKey = new Map<string, Set<number>>();
  for (const c of data.couples) {
    const kids = childrenByFamily.get(c.family_id);
    if (!kids?.size) continue;
    const key = coupleKey(c.partner_ids);
    const merged = mergedChildrenByCoupleKey.get(key) || new Set();
    for (const kid of kids) merged.add(kid);
    mergedChildrenByCoupleKey.set(key, merged);
  }
  // For each 2-partner couple, merge in children from any family that has a subset of these partners
  for (const c of data.couples) {
    if (c.partner_ids.length !== 2) continue;
    const key = coupleKey(c.partner_ids);
    const partnerSet = new Set(c.partner_ids);
    for (const c2 of data.couples) {
      if (c2.family_id === c.family_id) continue;
      const subset = c2.partner_ids.every((id) => partnerSet.has(id));
      if (!subset || c2.partner_ids.length === 0) continue;
      const kids = childrenByFamily.get(c2.family_id);
      if (!kids?.size) continue;
      const merged = mergedChildrenByCoupleKey.get(key) || new Set();
      for (const kid of kids) merged.add(kid);
      mergedChildrenByCoupleKey.set(key, merged);
    }
  }

  // Build lookup: child_id → parent family_ids
  const parentFamilyOf = new Map<number, Set<number>>();
  for (const e of data.edges) {
    const fams = parentFamilyOf.get(e.child_id) || new Set();
    fams.add(e.family_id);
    parentFamilyOf.set(e.child_id, fams);
  }

  // Build lookup: individual_id → families where they are a partner
  const partnerFamilyOf = new Map<number, number[]>();
  for (const c of data.couples) {
    for (const pid of c.partner_ids) {
      const fams = partnerFamilyOf.get(pid) || [];
      fams.push(c.family_id);
      partnerFamilyOf.set(pid, fams);
    }
  }

  // ---- Compute ordering within each generation ----
  // For each generation, produce an ordered list of node IDs with their x-positions.
  const positions = new Map<number, { x: number; y: number }>();

  // Sort generations
  const generations = Array.from(genGroups.keys()).sort((a, b) => a - b);

  // First pass: order nodes within each generation
  // We use a simple approach: lay out each generation left-to-right,
  // grouping couples together, then center-adjust parents over children.
  const genOrder = new Map<number, number[]>(); // generation → ordered node IDs

  for (const gen of generations) {
    const ids = genGroups.get(gen)!;
    const ordered: number[] = [];
    const placed = new Set<number>();

    // Group by couples first
    for (const couple of data.couples) {
      const validPartners = couple.partner_ids.filter(
        (id) => nodeMap.has(id) && nodeMap.get(id)!.generation === gen,
      );
      if (validPartners.length === 2 && !placed.has(validPartners[0]) && !placed.has(validPartners[1])) {
        ordered.push(validPartners[0], validPartners[1]);
        placed.add(validPartners[0]);
        placed.add(validPartners[1]);
      }
    }

    // Add remaining ungrouped individuals
    for (const id of ids) {
      if (!placed.has(id)) {
        ordered.push(id);
        placed.add(id);
      }
    }

    genOrder.set(gen, ordered);
  }

  // Second pass: compute initial x positions (simple left-to-right)
  for (const gen of generations) {
    const ordered = genOrder.get(gen)!;
    let x = 0;
    for (let i = 0; i < ordered.length; i++) {
      const id = ordered[i];
      // Check if this node is part of a couple with the next node
      const nextId = ordered[i + 1];
      const isCouplePair = nextId !== undefined && data.couples.some(
        (c) =>
          c.partner_ids.includes(id) &&
          c.partner_ids.includes(nextId),
      );

      positions.set(id, { x, y: gen * (NODE_HEIGHT + V_GAP) });

      if (isCouplePair) {
        x += NODE_WIDTH + COUPLE_GAP;
      } else {
        x += NODE_WIDTH + H_GAP;
      }
    }
  }

  // Helper: get merged children for this couple (so siblings from different families appear together)
  const getMergedChildren = (couple: TreeCouple): Set<number> => {
    if (couple.partner_ids.length === 2) {
      const merged = mergedChildrenByCoupleKey.get(coupleKey(couple.partner_ids));
      if (merged?.size) return merged;
    }
    return childrenByFamily.get(couple.family_id) || new Set();
  };

  // Third pass: center parents over their children (iterate a few times to converge)
  for (let iter = 0; iter < 3; iter++) {
    // For each couple, center them over their children (using merged sibling group)
    for (const couple of data.couples) {
      const kids = getMergedChildren(couple);
      if (kids.size === 0) continue;

      const validPartners = couple.partner_ids.filter((id) => positions.has(id));
      if (validPartners.length === 0) continue;

      // Skip centering for a one-parent "couple" if that parent is in a two-parent couple
      // whose merged children include these kids (otherwise we'd pull the parent away from their partner)
      if (validPartners.length === 1) {
        const soleParent = validPartners[0];
        const coveredByCouple = data.couples.some(
          (c) =>
            c.partner_ids.length === 2 &&
            c.partner_ids.includes(soleParent) &&
            Array.from(kids).every((kid) =>
              mergedChildrenByCoupleKey.get(coupleKey(c.partner_ids))?.has(kid),
            ),
        );
        if (coveredByCouple) continue;
      }

      // Get children positions
      const childXs: number[] = [];
      for (const kid of kids) {
        const pos = positions.get(kid);
        if (pos) childXs.push(pos.x);
      }
      if (childXs.length === 0) continue;

      const childCenter = (Math.min(...childXs) + Math.max(...childXs) + NODE_WIDTH) / 2;

      if (validPartners.length === 2) {
        // Center the couple over children
        const coupleWidth = NODE_WIDTH * 2 + COUPLE_GAP;
        const coupleStartX = childCenter - coupleWidth / 2;
        positions.set(validPartners[0], {
          x: coupleStartX,
          y: positions.get(validPartners[0])!.y,
        });
        positions.set(validPartners[1], {
          x: coupleStartX + NODE_WIDTH + COUPLE_GAP,
          y: positions.get(validPartners[1])!.y,
        });
      } else if (validPartners.length === 1) {
        positions.set(validPartners[0], {
          x: childCenter - NODE_WIDTH / 2,
          y: positions.get(validPartners[0])!.y,
        });
      }
    }

    // For each child group, center children under their parents (using same merged group)
    for (const couple of data.couples) {
      const kids = getMergedChildren(couple);
      if (kids.size === 0) continue;

      const validPartners = couple.partner_ids.filter((id) => positions.has(id));
      if (validPartners.length === 0) continue;

      if (validPartners.length === 1) {
        const soleParent = validPartners[0];
        const coveredByCouple = data.couples.some(
          (c) =>
            c.partner_ids.length === 2 &&
            c.partner_ids.includes(soleParent) &&
            Array.from(kids).every((kid) =>
              mergedChildrenByCoupleKey.get(coupleKey(c.partner_ids))?.has(kid),
            ),
        );
        if (coveredByCouple) continue;
      }

      // Get parent center
      const parentXs = validPartners.map((id) => positions.get(id)!.x);
      const parentCenter =
        (Math.min(...parentXs) + Math.max(...parentXs) + NODE_WIDTH) / 2;

      // Get current children span
      const kidIds = Array.from(kids).filter((id) => positions.has(id));
      if (kidIds.length === 0) continue;

      const kidXs = kidIds.map((id) => positions.get(id)!.x);
      const kidCenter = (Math.min(...kidXs) + Math.max(...kidXs) + NODE_WIDTH) / 2;
      const shift = parentCenter - kidCenter;

      // Shift all children
      for (const kid of kidIds) {
        const pos = positions.get(kid)!;
        positions.set(kid, { x: pos.x + shift, y: pos.y });
      }
    }
  }

  // Normalize: shift all positions so minimum x is 0
  let minX = Infinity;
  let minY = Infinity;
  for (const pos of positions.values()) {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
  }
  for (const [id, pos] of positions) {
    positions.set(id, { x: pos.x - minX + 40, y: pos.y - minY + 40 });
  }

  // ---- Build React Flow nodes ----
  const rfNodes: Node[] = [];
  for (const node of data.nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    rfNodes.push({
      id: String(node.id),
      type: 'personNode',
      position: pos,
      data: {
        ...node,
        isFocus: node.id === data.focus_id,
      },
      draggable: false,
    });
  }

  // ---- Create invisible junction nodes between couples ----
  // Each couple with children gets a tiny hidden node at the midpoint below the
  // couple connector. All child edges originate from this junction so siblings
  // are visually grouped under one shared drop-point.
  const JUNCTION_SIZE = 1;
  const JUNCTION_DROP = 40; // px below parents
  const junctionIds = new Map<number, string>(); // family_id → junction node id

  for (const couple of data.couples) {
    const kids = getMergedChildren(couple);
    if (kids.size === 0) continue;
    const validPartners = couple.partner_ids.filter((id) => positions.has(id));
    if (validPartners.length < 1) continue;

    // Skip if a larger couple already covers these children
    if (validPartners.length === 1) {
      const soleParent = validPartners[0];
      const coveredByCouple = data.couples.some(
        (c) =>
          c.partner_ids.length === 2 &&
          c.partner_ids.includes(soleParent) &&
          Array.from(kids).every((kid) =>
            mergedChildrenByCoupleKey.get(coupleKey(c.partner_ids))?.has(kid),
          ),
      );
      if (coveredByCouple) continue;
    }

    const partnerXs = validPartners.map((id) => positions.get(id)!.x);
    const partnerY = positions.get(validPartners[0])!.y;
    const midX = (Math.min(...partnerXs) + Math.max(...partnerXs) + NODE_WIDTH) / 2;

    const junctionId = `junction-${couple.family_id}`;
    junctionIds.set(couple.family_id, junctionId);

    rfNodes.push({
      id: junctionId,
      type: 'default',
      position: { x: midX - JUNCTION_SIZE / 2, y: partnerY + NODE_HEIGHT - JUNCTION_DROP },
      data: {},
      draggable: false,
      selectable: false,
      style: { width: JUNCTION_SIZE, height: JUNCTION_SIZE, opacity: 0, padding: 0, border: 'none' },
    } as Node);
  }

  // ---- Build React Flow edges ----
  const rfEdges: Edge[] = [];

  // Couple horizontal connectors
  for (const couple of data.couples) {
    const validPartners = couple.partner_ids.filter((id) => positions.has(id));
    if (validPartners.length === 2) {
      rfEdges.push({
        id: `couple-${couple.family_id}`,
        source: String(validPartners[0]),
        target: String(validPartners[1]),
        type: 'straight',
        style: {
          stroke: couple.family_type === 'marriage' ? '#fb7185' : '#c084fc',
          strokeWidth: 2,
          strokeDasharray: couple.family_type === 'marriage' ? undefined : '6 4',
        },
        animated: false,
      });
    }
  }

  // Parent→junction edges (one per couple that has a junction)
  for (const couple of data.couples) {
    const junctionId = junctionIds.get(couple.family_id);
    if (!junctionId) continue;
    const validPartners = couple.partner_ids.filter((id) => positions.has(id));
    // Pick the partner closest to the junction's x for the cleanest line
    // (for 2-partner couples the midpoint is equidistant, so first partner works)
    const sourceParent = validPartners[0];
    rfEdges.push({
      id: `parent-junction-${couple.family_id}`,
      source: String(sourceParent),
      target: junctionId,
      type: 'straight',
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      animated: false,
    });
  }

  // Junction→child edges (deduplicated: one per family×child)
  const familyChildSeen = new Set<string>();
  for (const edge of data.edges) {
    if (!positions.has(edge.parent_id) || !positions.has(edge.child_id)) continue;
    const key = `${edge.family_id}-${edge.child_id}`;
    if (familyChildSeen.has(key)) continue;
    familyChildSeen.add(key);

    // Determine the actual family to use for the junction (might be a larger couple's family)
    let junctionFamilyId = edge.family_id;
    let junctionId = junctionIds.get(junctionFamilyId);

    // If no junction for this family, check if a 2-partner couple covers this child
    if (!junctionId) {
      for (const c of data.couples) {
        if (c.partner_ids.length === 2) {
          const merged = mergedChildrenByCoupleKey.get(coupleKey(c.partner_ids));
          if (merged?.has(edge.child_id) && junctionIds.has(c.family_id)) {
            junctionId = junctionIds.get(c.family_id);
            junctionFamilyId = c.family_id;
            break;
          }
        }
      }
    }

    const sourceId = junctionId || String(edge.parent_id);

    rfEdges.push({
      id: `edge-${edge.family_id}-${edge.child_id}`,
      source: sourceId,
      target: String(edge.child_id),
      type: 'smoothstep',
      style: {
        stroke: edge.relationship === 'biological' ? '#9ca3af' : '#f9a8d4',
        strokeWidth: 2,
        strokeDasharray: edge.relationship === 'biological' ? undefined : '6 4',
      },
      animated: false,
    });
  }

  return { nodes: rfNodes, edges: rfEdges };
}
