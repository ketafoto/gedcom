# Family Tree Visualization - Design Document

**Version:** 1.0
**Date:** February 7, 2026
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Stories](#2-user-stories)
3. [Technology Choices](#3-technology-choices)
4. [Source Code Organization](#4-source-code-organization)
5. [Backend API](#5-backend-api)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Tree Layout & Rendering](#7-tree-layout--rendering)
8. [Interactive Features](#8-interactive-features)
9. [Image Export](#9-image-export)
10. [Growth Animation](#10-growth-animation)
11. [Entry Points (Wizard Button)](#11-entry-points-wizard-button)
12. [Data Flow](#12-data-flow)
13. [Performance Considerations](#13-performance-considerations)
14. [Implementation Phases](#14-implementation-phases)
15. [Open Questions](#15-open-questions)

---

## 1. Overview

Add an interactive, visual family tree to the Genealogy Database application.
The tree is centered on a chosen individual (the **focus person**) and displays
ancestors upward and descendants downward. Users can control how many
generations are shown with a slider, hover over any person to read a
chronological story of their life events, and export the result as a
high-resolution PNG or JPEG suitable for printing on A4 landscape paper.

An optional animated mode ("Tree Growth") plays a choreographed sequence where
parents appear, connectors draw themselves, and children fade in --
generation by generation -- using only standard web animation APIs (no AI).

---

## 2. User Stories

| # | As a... | I want to... | So that... |
|---|---------|--------------|------------|
| 1 | User viewing an Individual detail page | Click a "View Tree" button | I can see that person in a visual family tree |
| 2 | User on the Bulk Edit Individuals table | Click a tree icon on any row | I can quickly see any person's tree without leaving the table context |
| 3 | User on the tree page | Drag a slider from 1 to N | I can progressively reveal more generations (ancestors + descendants) |
| 4 | User on the tree page | Hover over any person node | I see a floating tooltip listing their life events in chronological order |
| 5 | User on the tree page | Export the tree as PNG/JPEG at ~300 DPI | I can print the tree on A4 landscape paper |
| 6 | User on the tree page | Watch a "growth animation" | I get a visually engaging presentation of how the family grew |

---

## 3. Technology Choices

### 3.1 Tree Rendering

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **React Flow** (`@xyflow/react`) | Mature, React-native, custom nodes/edges, built-in pan/zoom, large community | Heavy for a read-only tree; edge routing can be tricky for strict vertical layout | **Selected** |
| D3.js (`d3-hierarchy`) | Full layout control, small footprint | Manual React integration, imperative API | Runner-up |
| `react-konva` (Canvas) | Good for pixel-perfect export & animation | Harder to make accessible; no native HTML tooltips | Considered |

**Decision:** Use **React Flow** for the interactive tree view. It integrates
naturally with the existing React/TypeScript/Tailwind stack, supports custom
node components (circle portraits), custom edge styles (connectors), and
built-in viewport controls (zoom, pan, fit-to-view). The `@xyflow/react`
package (v12+) is the current maintained version.

For tree layout calculation (converting parent-child relationships into x/y
coordinates), use **dagre** (`@dagrejs/dagre`) -- a directed graph layout
engine that React Flow officially recommends for automatic tree/DAG layouts.

### 3.2 Image Export

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **html-to-image** | Small, fast, supports scale factor for DPI control | Occasional CSS quirk with some properties | **Selected** |
| `html2canvas` | Well-known | Larger bundle, slower, less accurate CSS rendering | Runner-up |
| `dom-to-image-more` | Fork of dom-to-image, maintained | Less popular | Considered |

**Decision:** Use **html-to-image** (`toJpeg`, `toPng`) with a `pixelRatio`
of `~3.125` (300 / 96) to produce 300 DPI output. For JPEG, quality is
configurable (0.0 - 1.0).

### 3.3 Animation

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Framer Motion** (`motion`) | React-native, `useAnimate`, stagger, timeline | Additional dependency (~30 KB gzipped) | **Selected** |
| GSAP | Most powerful animation library | Non-React paradigm, commercial license for some features | Runner-up |
| CSS @keyframes + JS | Zero dependency | Harder to orchestrate complex sequences | Fallback |

**Decision:** Use **Framer Motion** for the growth animation. It integrates
naturally with React components and provides `useAnimate`, `stagger`, and
`AnimatePresence` for orchestrating the generation-by-generation reveal.

### 3.4 New Dependencies Summary

```
npm install @xyflow/react @dagrejs/dagre html-to-image framer-motion
```

| Package | Purpose | Approx Size (gzip) |
|---------|---------|---------------------|
| `@xyflow/react` | Interactive node graph / tree canvas | ~45 KB |
| `@dagrejs/dagre` | Automatic directed graph layout | ~15 KB |
| `html-to-image` | DOM-to-PNG/JPEG export at configurable DPI | ~5 KB |
| `framer-motion` | React animation (growth animation) | ~30 KB |

---

## 4. Source Code Organization

The tree feature is self-contained. All tree-specific code lives in dedicated
directories, following the project's existing conventions.

```
frontend/src/
├── api/
│   └── tree.ts                      # NEW - API client for tree endpoint
│
├── components/
│   └── tree/                        # NEW - tree-specific components
│       ├── TreeCanvas.tsx           # React Flow canvas wrapper
│       ├── PersonNode.tsx           # Custom node: circle portrait + name + dates
│       ├── PersonTooltip.tsx        # Hover tooltip: event story list
│       ├── FamilyEdge.tsx           # Custom edge: styled connectors
│       ├── DepthSlider.tsx          # Slider control for generation depth
│       ├── ExportControls.tsx       # PNG/JPEG export controls (format, DPI, quality)
│       ├── GrowthAnimation.tsx      # Animated tree growth overlay
│       ├── MaleSilhouette.tsx       # SVG fallback for males without photo
│       └── FemaleSilhouette.tsx     # SVG fallback for females without photo
│
├── pages/
│   └── tree/                        # NEW - tree page
│       └── TreePage.tsx             # Main page: assembles all tree components
│
├── types/
│   └── models.ts                    # MODIFIED - add TreeNode/TreeData types
│
└── utils/
    └── treeLayout.ts                # NEW - dagre layout helper functions


backend/api/
└── tree.py                          # NEW - tree data endpoint


database/
└── models.py                        # (no changes needed - existing relationships suffice)
```

**Why not `frontend/tree/` at the top level?**
The existing project convention places all source code under `frontend/src/`
with `pages/`, `components/`, `api/`, `types/`, and `utils/` subdirectories.
A top-level `frontend/tree/` would break this convention and confuse imports.
Instead, we create `tree/` subdirectories inside the existing folders, which
keeps the codebase consistent and allows tree components to easily import
shared components (`Button`, `Card`, `Spinner`) and utilities (`nameUtils`).

---

## 5. Backend API

### 5.1 New Endpoint

```
GET /api/individuals/{id}/tree?ancestor_depth=1&descendant_depth=1
```

**Purpose:** Returns a pre-computed tree structure centered on the given
individual, traversing family relationships up to the requested depth.

**Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `ancestor_depth` | int | 1 | How many generations of ancestors to include (1 = parents, 2 = grandparents, ...) |
| `descendant_depth` | int | 1 | How many generations of descendants to include (1 = children, 2 = grandchildren, ...) |

**Response Schema:**

```json
{
  "focus_id": 42,
  "max_ancestor_depth": 3,
  "max_descendant_depth": 2,
  "nodes": [
    {
      "id": 42,
      "gedcom_id": "I0042",
      "sex_code": "M",
      "display_name": "John Smith",
      "birth_date": "1950-05-15",
      "birth_date_approx": null,
      "death_date": null,
      "death_date_approx": null,
      "photo_url": "/api/media/7/file",
      "generation": 0,
      "events": [
        {
          "event_type": "Study Start",
          "event_date": "1968",
          "event_place": "Harvard University",
          "description": null
        }
      ]
    }
  ],
  "edges": [
    {
      "parent_id": 10,
      "child_id": 42,
      "family_id": 5,
      "relationship": "biological"
    }
  ],
  "couples": [
    {
      "family_id": 5,
      "partner_ids": [10, 11],
      "marriage_date": "1948-06-20",
      "marriage_date_approx": null,
      "divorce_date": null
    }
  ]
}
```

**Field explanations:**

- `focus_id` -- the individual the tree is centered on (generation 0).
- `max_ancestor_depth` / `max_descendant_depth` -- the actual maximum depths
  available in the database for this person. The frontend uses these to set the
  slider's max value.
- `nodes` -- flat list of all individuals in the tree. Each node carries
  everything needed for rendering: display name, dates, photo URL, sex
  (for silhouette fallback), generation level (negative = ancestor,
  positive = descendant, 0 = focus person), and the full list of events
  (for tooltip).
- `edges` -- parent-to-child links. Each edge references a family so the
  frontend can group siblings.
- `couples` -- spouse/partner pairs with marriage info. Used to draw
  horizontal couple connectors and position partners side by side.

### 5.2 Backend Implementation (`backend/api/tree.py`)

The endpoint performs a BFS (breadth-first search) traversal:

```
Algorithm:
  1. Load the focus individual
  2. BFS upward: for each person, find families where they are a child
     (main_family_children), then get the family's members
     (main_family_members) as parents. Repeat up to ancestor_depth.
  3. BFS downward: for each person, find families where they are a member
     (main_family_members), then get the family's children
     (main_family_children) as descendants. Repeat up to descendant_depth.
  4. For each collected individual, load:
     - Primary name (name_order = 0 or first name)
     - First photo media (media_type_code = 'photo', first by id)
     - All events (sorted by date)
  5. Compute max_ancestor_depth and max_descendant_depth by doing an
     unbounded BFS (with cycle detection) and counting max depth reached.
     Cache this or compute lazily.
  6. Return the assembled TreeResponse.
```

**SQL efficiency:** Use a single query with JOINs to load families + members +
children for the BFS frontier at each level, rather than N+1 individual
queries. For the max-depth computation, consider caching the result (or
computing it on the first request with full depth, then trimming).

### 5.3 New Router Registration

In `backend/main.py`, add:

```python
from backend.api import tree
app.include_router(tree.router, prefix="/api")
```

### 5.4 Pydantic Schemas

Add to `backend/schemas.py`:

```python
class TreeNodeEvent(BaseModel):
    event_type: str
    event_date: Optional[str]
    event_date_approx: Optional[str]
    event_place: Optional[str]
    description: Optional[str]

class TreeNode(BaseModel):
    id: int
    gedcom_id: Optional[str]
    sex_code: Optional[str]
    display_name: str
    birth_date: Optional[str]
    birth_date_approx: Optional[str]
    death_date: Optional[str]
    death_date_approx: Optional[str]
    photo_url: Optional[str]
    generation: int
    events: List[TreeNodeEvent]

class TreeEdge(BaseModel):
    parent_id: int
    child_id: int
    family_id: int

class TreeCouple(BaseModel):
    family_id: int
    partner_ids: List[int]
    marriage_date: Optional[str]
    marriage_date_approx: Optional[str]
    divorce_date: Optional[str]

class TreeResponse(BaseModel):
    focus_id: int
    max_ancestor_depth: int
    max_descendant_depth: int
    nodes: List[TreeNode]
    edges: List[TreeEdge]
    couples: List[TreeCouple]
```

---

## 6. Frontend Architecture

### 6.1 TypeScript Types (`types/models.ts` additions)

```typescript
// ==================== Tree ====================
export interface TreeNodeEvent {
  event_type: string;
  event_date?: string;
  event_date_approx?: string;
  event_place?: string;
  description?: string;
}

export interface TreeNode {
  id: number;
  gedcom_id?: string;
  sex_code?: string;
  display_name: string;
  birth_date?: string;
  birth_date_approx?: string;
  death_date?: string;
  death_date_approx?: string;
  photo_url?: string;
  generation: number;
  events: TreeNodeEvent[];
}

export interface TreeEdge {
  parent_id: number;
  child_id: number;
  family_id: number;
}

export interface TreeCouple {
  family_id: number;
  partner_ids: number[];
  marriage_date?: string;
  marriage_date_approx?: string;
  divorce_date?: string;
}

export interface TreeData {
  focus_id: number;
  max_ancestor_depth: number;
  max_descendant_depth: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
  couples: TreeCouple[];
}
```

### 6.2 API Client (`api/tree.ts`)

```typescript
import apiClient from './client';
import type { TreeData } from '../types/models';

export interface TreeParams {
  ancestor_depth?: number;
  descendant_depth?: number;
}

export const treeApi = {
  getTree: async (individualId: number, params: TreeParams = {}): Promise<TreeData> => {
    const response = await apiClient.get<TreeData>(
      `/individuals/${individualId}/tree`,
      { params }
    );
    return response.data;
  },
};
```

### 6.3 Route (`App.tsx`)

Add inside the protected route block:

```tsx
import { TreePage } from './pages/tree/TreePage';

// ... inside <Routes>
<Route path="individuals/:id/tree" element={<TreePage />} />
```

### 6.4 Page Structure (`pages/tree/TreePage.tsx`)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to John Smith                              [Export ▼] [Play]│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Generations: [====●===========] 1 / 5                              │
│               (slider: 1..max)                                       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                          ┌───────┐   ┌───────┐                       │
│                          │ Father│───│ Mother│    generation -1      │
│                          │  ○    │   │  ○    │                       │
│                          └───┬───┘   └───┬───┘                       │
│                              │           │                           │
│                              └─────┬─────┘                           │
│                                    │                                 │
│                              ┌─────┴─────┐                           │
│                              │  ★ FOCUS  │    generation 0           │
│                              │   John    │                           │
│                              │  ○ photo  │                           │
│                              └─────┬─────┘                           │
│                                    │                                 │
│                           ┌────────┼────────┐                        │
│                      ┌────┴──┐ ┌───┴───┐ ┌──┴────┐                   │
│                      │ Son 1 │ │ Son 2 │ │Daught.│  generation +1   │
│                      │  ○    │ │  ○    │ │  ○    │                   │
│                      └───────┘ └───────┘ └───────┘                   │
│                                                                      │
│                            [Zoom +] [Zoom -] [Fit]                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Toolbar:**
- **Back** link to `IndividualDetailPage`
- **Export** dropdown: format (PNG/JPEG), quality slider (for JPEG), download
- **Play** button: starts Growth Animation

**Slider:**
- Range: 1 to `max(max_ancestor_depth, max_descendant_depth)`
- Default: 1
- Changing the slider re-fetches tree data with new depth parameters
- Labels show current depth and max available

**Canvas:**
- React Flow canvas with pan/zoom
- Custom nodes (PersonNode) and edges (FamilyEdge)
- Focus person highlighted with a distinct border color

---

## 7. Tree Layout & Rendering

### 7.1 Layout Algorithm (dagre)

Dagre computes x/y positions for a directed acyclic graph. Configuration:

```typescript
import Dagre from '@dagrejs/dagre';

function layoutTree(nodes, edges, couples) {
  const g = new Dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',        // Top-to-Bottom (ancestors on top)
    nodesep: 60,          // Horizontal spacing between siblings
    ranksep: 120,         // Vertical spacing between generations
    edgesep: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add person nodes
  nodes.forEach(node => {
    g.setNode(String(node.id), { width: 140, height: 180 });
  });

  // Add parent→child edges
  edges.forEach(edge => {
    g.setEdge(String(edge.parent_id), String(edge.child_id));
  });

  Dagre.layout(g);

  // Extract positions
  return nodes.map(node => {
    const pos = g.node(String(node.id));
    return { ...node, position: { x: pos.x - 70, y: pos.y - 90 } };
  });
}
```

### 7.2 Couple Handling

Couples (partners/spouses) must appear side by side on the same rank. Dagre
supports this by ensuring both partners share the same `rank` value. We add
invisible edges between partners with `minlen: 1` to keep them adjacent.

A small horizontal connector line between partners is drawn as a custom
"couple edge" (no arrow, simple line, optionally with a heart icon or marriage
date label).

### 7.3 PersonNode Component

Each person is rendered as a custom React Flow node:

```
┌──────────────────────┐
│                      │
│     ┌──────────┐     │
│     │          │     │   Circle border (120px diameter)
│     │  PHOTO   │     │   - Photo if available (object-fit: cover)
│     │  or      │     │   - Male/Female silhouette SVG if no photo
│     │ Silhouet │     │   - Focus person: gold border
│     │          │     │   - Others: gray border
│     └──────────┘     │
│                      │
│   Given Family Name  │   Primary name (bold, 13px)
│   1950 - 2020        │   Birth year - Death year (gray, 11px)
│                      │
└──────────────────────┘
    ~140px × ~180px
```

**Photo source:**
- `photo_url` field from the tree API (points to `/api/media/{id}/file`)
- If `null`, render `MaleSilhouette` or `FemaleSilhouette` based on `sex_code`
- Unknown sex: use a neutral silhouette

**Focus person** gets a highlighted border (e.g., golden/amber ring) and a
subtle glow to make them easy to find in large trees.

### 7.4 Edge (Connector) Styles

- **Parent-to-child:** Vertical line from parent bottom to child top, with
  right-angle routing (step edge). Color: gray-400. Stroke: 2px.
- **Couple connector:** Short horizontal line between two partners on the same
  rank. Color: rose-300. Stroke: 2px dashed.
- All edges have smooth corners (border-radius on SVG path bends).

---

## 8. Interactive Features

### 8.1 Hover Tooltip (PersonTooltip)

When the mouse hovers over a PersonNode, a floating tooltip appears with the
person's life story rendered as a chronological list:

```
┌──────────────────────────────────────┐
│  John Smith (I0042)                  │
│                                      │
│  ● 1950-05-15  Born                  │
│                 New York, USA        │
│  ● 1968        Study Start           │
│                 Harvard University   │
│  ● 1972        Study End             │
│                 Harvard University   │
│  ● 1975-06-15  Marriage              │
│                 with Mary Johnson    │
│  ● 1980        Work Start            │
│                 IBM Corporation      │
│                                      │
└──────────────────────────────────────┘
```

Implementation: Use React Flow's `onNodeMouseEnter` / `onNodeMouseLeave`
callbacks to show/hide a positioned `<div>` with the event list. The events
are already included in each node's data from the API (no additional fetch
needed).

Tooltip positioning: offset 10px right and 10px below the cursor. If near
the viewport edge, flip to the opposite side.

### 8.2 Click-to-Navigate

Clicking a PersonNode navigates to that person's detail page:
`/individuals/{id}`. This uses React Router's `useNavigate`.

Alternatively (future enhancement): re-center the tree on the clicked person.

### 8.3 Depth Slider (DepthSlider)

```tsx
<input
  type="range"
  min={1}
  max={maxDepth}
  value={depth}
  onChange={(e) => setDepth(Number(e.target.value))}
/>
```

When depth changes, the tree API is re-fetched with the new
`ancestor_depth` and `descendant_depth`. React Query manages caching so
previously fetched depths load instantly.

The slider controls **both** ancestor and descendant depth symmetrically.
A future enhancement could add separate sliders for each direction.

---

## 9. Image Export

### 9.1 Export Parameters

| Parameter | Options | Default |
|-----------|---------|---------|
| Format | PNG, JPEG | PNG |
| Quality (JPEG only) | 0.5 - 1.0 | 0.92 |
| DPI | 150, 300 | 300 |
| Paper size | A4 Landscape, A3 Landscape, Auto | A4 Landscape |

### 9.2 A4 Landscape at 300 DPI

```
A4 = 297mm × 210mm
At 300 DPI:
  Width  = 297 / 25.4 * 300 = 3508 px
  Height = 210 / 25.4 * 300 = 2480 px

Landscape orientation:
  Width  = 3508 px
  Height = 2480 px
```

The guideline "~4 levels should fit A4 landscape" means each generation row
gets approximately 620 px of vertical space at 300 DPI (2480 / 4). At screen
resolution (96 DPI) this is ~200 px per row -- which aligns well with the
180 px node height + 120 px `ranksep` in the dagre layout.

### 9.3 Export Flow

```
1. User clicks "Export" → opens ExportControls panel
2. User selects format, quality, DPI
3. User clicks "Download"
4. Frontend:
   a. Temporarily hide UI controls (slider, buttons, zoom controls)
   b. Use React Flow's `fitView()` to ensure entire tree is visible
   c. Compute pixelRatio = targetDPI / 96
   d. Call html-to-image:
      - toPng(element, { pixelRatio }) for PNG
      - toJpeg(element, { pixelRatio, quality }) for JPEG
   e. For A4 target: if the output exceeds A4 dimensions, scale down
      to fit while maintaining aspect ratio
   f. Trigger browser download of the blob
   g. Restore UI controls
```

### 9.4 ExportControls Component

```
┌──────────────────────────────────────┐
│  Export Tree                         │
├──────────────────────────────────────┤
│                                      │
│  Format:  ○ PNG  ● JPEG             │
│                                      │
│  Quality: [========●==] 92%         │  (JPEG only)
│                                      │
│  DPI:     ○ 150  ● 300              │
│                                      │
│  Paper:   ● A4 Landscape            │
│           ○ A3 Landscape            │
│           ○ Auto (fit content)       │
│                                      │
│              [Cancel]  [Download]    │
│                                      │
└──────────────────────────────────────┘
```

---

## 10. Growth Animation

### 10.1 Concept

The "growth animation" is a choreographed sequence that builds the tree
visually, generation by generation, starting from the focus person and
expanding outward. It uses **Framer Motion** for all animation -- no AI,
no video, purely deterministic web animation.

### 10.2 Animation Sequence

```
Phase 1: Focus person appears (0.0s - 0.5s)
  - Scale from 0 → 1 with spring easing
  - Opacity from 0 → 1

Phase 2: Parents appear (0.5s - 1.5s)
  - Each parent fades in with scale spring
  - Parents slide toward each other briefly (translateX ±15px)
  - Small heart particle at meeting point (CSS animation)
  - Parents slide back to original position

Phase 3: Parent-to-focus connectors draw (1.5s - 2.0s)
  - SVG stroke-dashoffset animation from full length to 0
  - Connectors draw themselves from parents downward to focus person

Phase 4: Siblings appear (2.0s - 2.5s)
  - If focus person has siblings, they fade in with stagger (100ms each)
  - Connector lines branch out from parents

Phase 5: Children appear (2.5s - 3.5s)
  - Focus person's spouse appears (same partner animation as Phase 2)
  - Connector lines draw downward
  - Children fade in with stagger

Phase 6+: Additional generations (3.5s+)
  - Repeat parent/children pattern for each additional generation
  - Each generation takes ~1 second
  - Generations farther from focus animate faster (compress time)
```

### 10.3 Implementation Approach

```typescript
// Pseudocode using Framer Motion's useAnimate
const [scope, animate] = useAnimate();

async function playGrowthAnimation() {
  // Phase 1: Focus person
  await animate(`[data-node-id="${focusId}"]`, 
    { opacity: 1, scale: 1 }, 
    { duration: 0.5, type: "spring" }
  );

  // Phase 2: Parents
  const parentNodes = getParentNodes(focusId);
  await animate(`[data-generation="-1"]`,
    { opacity: 1, scale: 1 },
    { duration: 0.4, delay: stagger(0.15) }
  );

  // "Kiss" animation
  if (parentNodes.length === 2) {
    await Promise.all([
      animate(`[data-node-id="${parentNodes[0].id}"]`,
        { x: [0, 15, 0] }, { duration: 0.6 }),
      animate(`[data-node-id="${parentNodes[1].id}"]`,
        { x: [0, -15, 0] }, { duration: 0.6 }),
    ]);
  }

  // Phase 3: Connectors
  await animate('[data-edge-gen="-1"]',
    { strokeDashoffset: 0 },
    { duration: 0.5, delay: stagger(0.1) }
  );

  // Continue for descendants...
}
```

### 10.4 Controls

- **Play** button (in toolbar) starts the animation
- **Stop** button appears during animation to cancel
- During animation, the depth slider is disabled
- After animation completes, the tree is in its final static state

### 10.5 CSS Techniques Used

| Technique | Purpose |
|-----------|---------|
| `transform: scale(0→1)` | Node appearance |
| `opacity: 0→1` | Fade in |
| `transform: translateX(±15px)` | "Kiss" slide |
| `stroke-dasharray` + `stroke-dashoffset` | Line drawing effect |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bounce/spring easing |
| CSS `@keyframes` with `animation-delay` | Heart particle |

---

## 11. Entry Points (Wizard Button)

### 11.1 Individual Detail Page

Add a "View Tree" button next to the existing "Edit" and "Delete" buttons:

```tsx
// In IndividualDetailPage.tsx, header actions section:
<Link to={`/individuals/${id}/tree`}>
  <Button variant="secondary">
    <GitBranch className="w-4 h-4 mr-2" />   {/* from lucide-react */}
    View Tree
  </Button>
</Link>
```

Position: between "Edit" and "Delete" buttons.

### 11.2 Bulk Edit Individuals Page

Add a tree icon button in the actions column of each row:

```tsx
// In BulkEditIndividualsPage.tsx, row actions:
<button
  onClick={() => navigate(`/individuals/${individual.id}/tree`)}
  className="p-1 hover:bg-gray-100 rounded"
  title="View Family Tree"
>
  <GitBranch className="w-4 h-4 text-gray-600" />
</button>
```

Position: alongside the existing Edit and Delete icons.

---

## 12. Data Flow

### 12.1 Complete Flow Diagram

```
User clicks "View Tree" on Individual #42
  │
  ▼
Router navigates to /individuals/42/tree
  │
  ▼
TreePage mounts
  │
  ├─ Sets default depth = 1
  │
  ▼
React Query fetches GET /api/individuals/42/tree?ancestor_depth=1&descendant_depth=1
  │
  ▼
Backend:
  ├─ Loads individual #42
  ├─ BFS upward: finds parents via family_children → family_members
  ├─ BFS downward: finds children via family_members → family_children
  ├─ For each person: loads name, photo, events
  ├─ Computes max_ancestor_depth, max_descendant_depth
  └─ Returns TreeResponse
  │
  ▼
Frontend receives TreeData
  │
  ├─ treeLayout.ts: converts nodes + edges + couples into React Flow
  │   format using dagre layout
  │
  ├─ TreeCanvas renders:
  │   ├─ PersonNode for each person (with photo or silhouette)
  │   ├─ FamilyEdge for each parent→child link
  │   └─ Couple connector for each partner pair
  │
  ├─ DepthSlider shows: value=1, max=max(max_ancestor_depth, max_descendant_depth)
  │
  └─ React Flow fitView() centers the tree
  │
  ▼
User drags slider to depth=3
  │
  ▼
React Query fetches GET /api/individuals/42/tree?ancestor_depth=3&descendant_depth=3
  │
  ▼
Tree re-renders with more generations (animated transition via React Flow)
```

### 12.2 When a child appears with only one parent line

If a child (e.g. Tom) appears under one parent only (e.g. only a line from Alona) while siblings (Aya, Sonya) have lines from both parents, the cause is usually **data**, not the tree code:

- The backend creates one parent→child edge **per family member** for each child in that family.
- So if Tom is stored as a child in a **different family** that has only Alona as a member (e.g. a one‑parent family), the API will only return an edge from Alona to Tom.
- **Fix:** Ensure Tom is a child of the **same family** as his siblings (the one that has both Igor and Alona as members). Use the Families API or the family edit UI: open the family that has Igor and Alona and add Tom as a child there; remove or leave the one‑parent family as needed.

The tree layout will still place Tom next to his siblings (we merge sibling groups when one family has both parents and another has a subset). The second parent line will only appear after the data is corrected.

### 12.3 Caching Strategy

```typescript
// React Query key structure:
['tree', individualId, { ancestor_depth, descendant_depth }]

// Settings:
staleTime: 5 * 60 * 1000,  // 5 minutes
```

Previously fetched depths are cached, so sliding back to a lower depth is
instant (no network request).

---

## 13. Performance Considerations

### 13.1 Large Trees

| Concern | Mitigation |
|---------|------------|
| Many nodes (>200) | React Flow handles 1000+ nodes efficiently with viewport culling. Only visible nodes are rendered in the DOM. |
| Deep recursion in BFS | Backend caps at reasonable depth (max 20 generations). Cycle detection prevents infinite loops. |
| Photo loading | Lazy-load photos: show silhouette immediately, load `<img>` with `loading="lazy"`. Use thumbnails if available. |
| Export of large trees | For trees exceeding A4, warn the user and suggest A3 or auto mode. |

### 13.2 API Response Size

For a typical 4-generation tree (~30 people), the JSON response is estimated
at ~15-20 KB (including events). This is well within acceptable limits.

For very large trees (10+ generations, 500+ people), the response could reach
200-300 KB. This is still fine for a single API call, but we should add
backend pagination or depth limiting as a safeguard.

### 13.3 Rendering Budget

Target: tree should render within 200ms after data arrives.
- Dagre layout: ~10ms for 100 nodes
- React Flow initial render: ~50ms for 100 nodes
- Photo loading: async, doesn't block

---

## 14. Implementation Phases

### Phase 1: Backend + Core Tree (3-4 days)

- [ ] Create `backend/api/tree.py` with BFS traversal
- [ ] Add Pydantic schemas for tree response
- [ ] Register router in `backend/main.py`
- [ ] Add tree types to `frontend/src/types/models.ts`
- [ ] Create `frontend/src/api/tree.ts`
- [ ] Add route in `App.tsx`
- [ ] Create basic `TreePage.tsx` with React Flow
- [ ] Create `PersonNode.tsx` (name + dates, placeholder circle)
- [ ] Create `treeLayout.ts` using dagre
- [ ] Basic vertical tree rendering with connectors

**Deliverable:** Functional tree page showing ancestors and descendants
with placeholder portraits.

### Phase 2: Polish & Interactivity (2-3 days)

- [ ] Create `MaleSilhouette.tsx` / `FemaleSilhouette.tsx` SVG components
- [ ] Photo display in PersonNode (from media API)
- [ ] `DepthSlider.tsx` with reactive data fetching
- [ ] `PersonTooltip.tsx` with event story list
- [ ] Couple connectors (horizontal partner lines)
- [ ] Focus person highlighting (golden border)
- [ ] Click-to-navigate to individual detail page
- [ ] Fit-to-view on load
- [ ] "View Tree" button on IndividualDetailPage
- [ ] Tree icon on BulkEditIndividualsPage rows

**Deliverable:** Fully interactive tree with slider, tooltips, and entry
points from existing pages.

### Phase 3: Image Export (1-2 days)

- [ ] Create `ExportControls.tsx` (format, quality, DPI, paper size)
- [ ] Implement `html-to-image` export pipeline
- [ ] DPI scaling logic
- [ ] A4/A3 paper size fitting
- [ ] Download trigger
- [ ] Hide UI elements during export capture

**Deliverable:** Working PNG/JPEG export at configurable resolution.

### Phase 4: Growth Animation (2-3 days)

- [ ] Create `GrowthAnimation.tsx`
- [ ] Implement generation-by-generation reveal sequence
- [ ] "Kiss" animation for partner pairs
- [ ] SVG connector drawing animation (stroke-dashoffset)
- [ ] Heart particle CSS animation
- [ ] Play/Stop controls
- [ ] Disable slider during animation

**Deliverable:** Complete animated tree growth feature.

### Total Estimated Effort: 8-12 days

---

## 15. Resolved Questions

| # | Question | Decision | Notes |
|---|----------|----------|-------|
| 1 | Should the slider control ancestor and descendant depth independently? | **Two independent sliders with "Lock" checkbox.** When locked, moving either slider moves the other symmetrically. | Provides flexibility while keeping the common symmetric case easy. |
| 2 | Should clicking a node re-center the tree on that person? | **No navigation on click.** Left-button drag pans the tree. **Double-click** re-centers the tree on that person. Close button (top-right X) returns user to the originating page. Mouse wheel zooms. | Standard React Flow interaction model. |
| 3 | Should we generate photo thumbnails on upload for faster tree loading? | **Yes, generate thumbnails server-side** (deferred until media upload is fully implemented). | Use full photos with browser resize for now. |
| 4 | Maximum depth cap for the BFS? | **20 generations** with a 5-second query timeout. | Covers even the deepest documented genealogies while protecting against runaway queries. |
| 5 | Should the tree show half-siblings and step-parents? | **Yes, show all family connections.** Biological and non-biological connectors use different visual styles. A **legend** in the bottom-right corner explains connector types. | family_type = "marriage" → solid lines; other types → dashed lines. |
| 6 | Child ordering | **Children ordered elder to younger, left to right** based on birth_date/birth_date_approx. | Individuals without birth dates are placed at the end (rightmost). |

---

**Document End**

*Version 1.1 -- February 7, 2026*
*Status: Approved -- Implementation Started*
