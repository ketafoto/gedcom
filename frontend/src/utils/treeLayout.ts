import type { TreeData, TreeNode, TreeCouple } from '../types/models';
import type { Node, Edge } from '@xyflow/react';

// Dimensions of each person node in pixels (must match PersonNode rendered size)
export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 190;
const H_GAP = 40;       // Horizontal gap between sibling nodes
const V_GAP = 100;       // Vertical gap between generations
const COUPLE_GAP = 2;    // Horizontal gap between partners in a couple
const COMPONENT_GAP = 120; // Horizontal gap between disconnected sub-trees

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Find connected components among the individuals using edges and couples
 * as the adjacency source.
 */
function findConnectedComponents(data: TreeData): Set<number>[] {
  const adj = new Map<number, Set<number>>();
  for (const n of data.nodes) adj.set(n.id, new Set());

  for (const e of data.edges) {
    adj.get(e.parent_id)?.add(e.child_id);
    adj.get(e.child_id)?.add(e.parent_id);
  }
  for (const c of data.couples) {
    for (let i = 0; i < c.partner_ids.length; i++) {
      for (let j = i + 1; j < c.partner_ids.length; j++) {
        adj.get(c.partner_ids[i])?.add(c.partner_ids[j]);
        adj.get(c.partner_ids[j])?.add(c.partner_ids[i]);
      }
    }
  }

  const visited = new Set<number>();
  const components: Set<number>[] = [];

  for (const n of data.nodes) {
    if (visited.has(n.id)) continue;
    const component = new Set<number>();
    const stack = [n.id];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      component.add(cur);
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) stack.push(nb);
      }
    }
    components.push(component);
  }

  return components;
}

/**
 * Partition TreeData into sub-datasets for each connected component.
 */
function splitByComponent(data: TreeData, component: Set<number>): TreeData {
  return {
    focus_id: data.focus_id !== null && component.has(data.focus_id) ? data.focus_id : null,
    max_ancestor_depth: data.max_ancestor_depth,
    max_descendant_depth: data.max_descendant_depth,
    nodes: data.nodes.filter((n) => component.has(n.id)),
    edges: data.edges.filter((e) => component.has(e.parent_id) && component.has(e.child_id)),
    couples: data.couples.filter((c) => c.partner_ids.some((id) => component.has(id))),
  };
}

/**
 * Public entry point: handles disconnected components by laying each one out
 * independently, then placing them side-by-side with a gap.
 */
export function computeTreeLayout(data: TreeData): LayoutResult {
  const components = findConnectedComponents(data);
  if (components.length <= 1) {
    return computeSingleTreeLayout(data);
  }

  // Sort components: largest first (by node count) for a nicer visual
  components.sort((a, b) => b.size - a.size);

  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];
  let xOffset = 0;

  for (const component of components) {
    const subData = splitByComponent(data, component);
    const result = computeSingleTreeLayout(subData);

    // Find bounding box width of this component
    let maxX = 0;
    for (const node of result.nodes) {
      const right = node.position.x + NODE_WIDTH;
      if (right > maxX) maxX = right;
    }

    // Offset all nodes
    for (const node of result.nodes) {
      node.position.x += xOffset;
      allNodes.push(node);
    }
    for (const edge of result.edges) {
      allEdges.push(edge);
    }

    xOffset += maxX + COMPONENT_GAP;
  }

  return { nodes: allNodes, edges: allEdges };
}

/**
 * Layout engine for a single connected tree component.
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
function computeSingleTreeLayout(data: TreeData): LayoutResult {
  const nodeMap = new Map<number, TreeNode>();
  for (const n of data.nodes) nodeMap.set(n.id, n);

  // Group nodes by generation
  const genGroups = new Map<number, number[]>();
  for (const n of data.nodes) {
    const ids = genGroups.get(n.generation) || [];
    ids.push(n.id);
    genGroups.set(n.generation, ids);
  }

  // Deterministic family order helps keep layout stable between renders.
  const couples = [...data.couples].sort((a, b) => a.family_id - b.family_id);

  // Build lookup: family_id → child ids
  const childrenByFamily = new Map<number, Set<number>>();
  for (const e of data.edges) {
    const kids = childrenByFamily.get(e.family_id) || new Set();
    kids.add(e.child_id);
    childrenByFamily.set(e.family_id, kids);
  }

  // Lookup: person -> direct partners (from couple links)
  const partnerLookup = new Map<number, number[]>();
  for (const c of couples) {
    if (c.partner_ids.length !== 2) continue;
    const [a, b] = c.partner_ids;
    const aPartners = partnerLookup.get(a) || [];
    aPartners.push(b);
    partnerLookup.set(a, aPartners);
    const bPartners = partnerLookup.get(b) || [];
    bPartners.push(a);
    partnerLookup.set(b, bPartners);
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
    const idsSet = new Set(ids);
    const ordered: number[] = [];
    const placed = new Set<number>();

    // Build family child blocks for this generation and order them by the
    // parent position in previous generation. This keeps sibling groups from
    // different parent couples separated left-to-right in a predictable way.
    const prevOrdered = genOrder.get(gen - 1) || [];
    const prevIndex = new Map<number, number>();
    prevOrdered.forEach((id, idx) => prevIndex.set(id, idx));

    const childBlocks = couples
      .map((couple) => {
        const kids = Array.from(childrenByFamily.get(couple.family_id) || new Set())
          .filter((kidId) => idsSet.has(kidId));
        if (kids.length === 0) return null;
        const parentIdx = couple.partner_ids
          .map((pid) => prevIndex.get(pid))
          .filter((idx): idx is number => idx !== undefined);
        const blockOrder = parentIdx.length > 0 ? Math.min(...parentIdx) : Number.MAX_SAFE_INTEGER;
        return { couple, kids, blockOrder };
      })
      .filter((b): b is { couple: TreeCouple; kids: number[]; blockOrder: number } => b !== null)
      .sort((a, b) => (a.blockOrder - b.blockOrder) || (a.couple.family_id - b.couple.family_id));

    // Place each family block: child near their spouse (if present in same generation)
    for (const block of childBlocks) {
      const kidsOrdered = [...block.kids].sort((a, b) => ids.indexOf(a) - ids.indexOf(b));
      for (const kidId of kidsOrdered) {
        if (placed.has(kidId)) continue;
        const spouseId = (partnerLookup.get(kidId) || []).find(
          (pid) => idsSet.has(pid) && nodeMap.get(pid)?.generation === gen,
        );
        if (spouseId !== undefined && !placed.has(spouseId)) {
          ordered.push(kidId, spouseId);
          placed.add(kidId);
          placed.add(spouseId);
        } else {
          ordered.push(kidId);
          placed.add(kidId);
        }
      }
    }

    // Place remaining couples and singles
    for (const couple of couples) {
      const validPartners = couple.partner_ids.filter(
        (id) => nodeMap.has(id) && nodeMap.get(id)!.generation === gen,
      );
      if (validPartners.length === 2 && !placed.has(validPartners[0]) && !placed.has(validPartners[1])) {
        ordered.push(validPartners[0], validPartners[1]);
        placed.add(validPartners[0]);
        placed.add(validPartners[1]);
      }
    }
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

  // Family-strict child grouping: children stay with their actual family.
  const getMergedChildren = (couple: TreeCouple): Set<number> => {
    return childrenByFamily.get(couple.family_id) || new Set();
  };

  // Build couple-partner lookup: for each individual, who is their spouse in the same generation
  const couplePartner = new Map<number, number>();
  for (const couple of couples) {
    const vp = couple.partner_ids.filter((id) => nodeMap.has(id) && positions.has(id));
    if (vp.length === 2 && nodeMap.get(vp[0])!.generation === nodeMap.get(vp[1])!.generation) {
      couplePartner.set(vp[0], vp[1]);
      couplePartner.set(vp[1], vp[0]);
    }
  }

  const isCoveredBySoleParent = (couple: TreeCouple, kids: Set<number>) => {
    if (couple.partner_ids.filter((id) => positions.has(id)).length !== 1) return false;
    const soleParent = couple.partner_ids.find((id) => positions.has(id))!;
    return couples.some(
      (c) =>
        c.partner_ids.length === 2 &&
        c.partner_ids.includes(soleParent) &&
        c.family_id !== couple.family_id &&
        Array.from(kids).every((kid) => (childrenByFamily.get(c.family_id) || new Set()).has(kid)),
    );
  };

  const centerParentsOverChildren = () => {
    for (const couple of couples) {
      const kids = getMergedChildren(couple);
      if (kids.size === 0) continue;
      const validPartners = couple.partner_ids.filter((id) => positions.has(id));
      if (validPartners.length === 0) continue;
      if (isCoveredBySoleParent(couple, kids)) continue;

      const childXs: number[] = [];
      for (const kid of kids) {
        const pos = positions.get(kid);
        if (pos) childXs.push(pos.x);
      }
      if (childXs.length === 0) continue;
      const childCenter = (Math.min(...childXs) + Math.max(...childXs) + NODE_WIDTH) / 2;

      if (validPartners.length === 2) {
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
  };

  /**
   * Walk each generation left-to-right, grouping couples as single layout
   * units, and push any overlapping unit rightward.  This guarantees
   * COUPLE_GAP between spouses and H_GAP between separate units.
   */
  const resolveOverlaps = () => {
    for (const gen of generations) {
      const ids = genOrder.get(gen)!;
      if (ids.length <= 1) continue;

      type LayoutUnit = { ids: number[]; isCouple: boolean };
      const units: LayoutUnit[] = [];
      const placed = new Set<number>();
      // Keep the logical generation order (built from couples + birth ordering)
      // instead of sorting by temporary x-coordinates; this prevents siblings
      // from drifting across unrelated family groups after iterative centering.
      for (const id of ids) {
        if (placed.has(id)) continue;
        const partner = couplePartner.get(id);
        if (partner !== undefined && !placed.has(partner) && ids.includes(partner)) {
          const posA = positions.get(id)!;
          const posB = positions.get(partner)!;
          const leftId = posA.x <= posB.x ? id : partner;
          const rightId = leftId === id ? partner : id;
          units.push({ ids: [leftId, rightId], isCouple: true });
          placed.add(id);
          placed.add(partner);
        } else {
          units.push({ ids: [id], isCouple: false });
          placed.add(id);
        }
      }

      let cursor = -Infinity;
      for (const unit of units) {
        if (unit.isCouple) {
          const [leftId, rightId] = unit.ids;
          const leftPos = positions.get(leftId)!;
          const rightPos = positions.get(rightId)!;
          const newLeft = Math.max(leftPos.x, cursor);
          positions.set(leftId, { x: newLeft, y: leftPos.y });
          positions.set(rightId, { x: newLeft + NODE_WIDTH + COUPLE_GAP, y: rightPos.y });
          cursor = newLeft + NODE_WIDTH * 2 + COUPLE_GAP + H_GAP;
        } else {
          const [id] = unit.ids;
          const pos = positions.get(id)!;
          const newX = Math.max(pos.x, cursor);
          positions.set(id, { x: newX, y: pos.y });
          cursor = newX + NODE_WIDTH + H_GAP;
        }
      }
    }
  };

  // Third pass: single deterministic refinement (no drift-inducing feedback loop)
  centerParentsOverChildren();
  resolveOverlaps();

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
  //
  // Junctions in the same parent generation are staggered vertically so their
  // smoothstep horizontal routing bars don't merge into one confusing line.
  const JUNCTION_SIZE = 1;
  const JUNCTION_DROP = 40; // px below parents
  const JUNCTION_Y_STEP = 10; // slight stagger to avoid merged horizontal bars
  const junctionIds = new Map<number, string>(); // family_id → junction node id
  const genJunctionCount = new Map<number, number>();

  for (const couple of couples) {
    const kids = getMergedChildren(couple);
    if (kids.size === 0) continue;
    const validPartners = couple.partner_ids.filter((id) => positions.has(id));
    if (validPartners.length < 1) continue;

    // Skip if a larger couple already covers these children
    if (validPartners.length === 1) {
      const soleParent = validPartners[0];
      const coveredByCouple = couples.some(
        (c) =>
          c.partner_ids.length === 2 &&
          c.partner_ids.includes(soleParent) &&
          c.family_id !== couple.family_id &&
          Array.from(kids).every((kid) => (childrenByFamily.get(c.family_id) || new Set()).has(kid)),
      );
      if (coveredByCouple) continue;
    }

    const partnerXs = validPartners.map((id) => positions.get(id)!.x);
    const partnerY = positions.get(validPartners[0])!.y;
    const midX = (Math.min(...partnerXs) + Math.max(...partnerXs) + NODE_WIDTH) / 2;

    const partnerGen = nodeMap.get(validPartners[0])!.generation;
    const junctionIdx = genJunctionCount.get(partnerGen) || 0;
    genJunctionCount.set(partnerGen, junctionIdx + 1);

    const junctionId = `junction-${couple.family_id}`;
    junctionIds.set(couple.family_id, junctionId);

    rfNodes.push({
      id: junctionId,
      type: 'default',
      position: {
        x: midX - JUNCTION_SIZE / 2,
        y: partnerY + NODE_HEIGHT - JUNCTION_DROP + junctionIdx * JUNCTION_Y_STEP,
      },
      data: {},
      draggable: false,
      selectable: false,
      style: { width: JUNCTION_SIZE, height: JUNCTION_SIZE, opacity: 0, padding: 0, border: 'none' },
    } as Node);
  }

  // ---- Build React Flow edges ----
  const rfEdges: Edge[] = [];

  // Couple horizontal connectors
  for (const couple of couples) {
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

    const junctionId = junctionIds.get(edge.family_id);
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
