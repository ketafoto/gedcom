import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { TreeData } from '../../types/models';
import { computeTreeLayout } from '../../utils/treeLayout';
import { PersonNode } from './PersonNode';

interface TreeCanvasProps {
  data: TreeData;
  /** Interval between carousel photo changes in milliseconds */
  photoIntervalMs?: number;
  /** Ref to expose the React Flow viewport element for export */
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  /** Callback when a person node is clicked (re-center tree on them) */
  onPersonClick?: (individualId: number) => void;
  /** Callback when a person node is double-clicked (open detail page) */
  onPersonDoubleClick?: (individualId: number) => void;
}

const nodeTypes: NodeTypes = {
  personNode: PersonNode as any,
};

/**
 * Inner component that uses useReactFlow (must be inside ReactFlowProvider).
 */
function TreeCanvasInner({
  data,
  photoIntervalMs,
  viewportRef,
  onPersonClick,
  onPersonDoubleClick,
}: TreeCanvasProps) {
  const { fitView } = useReactFlow();
  const layout = useMemo(() => computeTreeLayout(data), [data]);
  const nodesWithCarouselInterval = useMemo(
    () =>
      layout.nodes.map((node) =>
        node.type === 'personNode'
          ? {
              ...node,
              data: {
                ...(node.data as Record<string, unknown>),
                carouselIntervalMs: (photoIntervalMs ?? 3000),
              },
            }
          : node,
      ),
    [layout.nodes, photoIntervalMs],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithCarouselInterval);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Update nodes/edges when data changes
  useEffect(() => {
    setNodes(nodesWithCarouselInterval);
    setEdges(layout.edges);
    // Fit view after layout settles
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 150);
    return () => clearTimeout(timer);
  }, [nodesWithCarouselInterval, layout.edges, setNodes, setEdges, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onPersonClick?.(Number(node.id));
    },
    [onPersonClick],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onPersonDoubleClick?.(Number(node.id));
    },
    [onPersonDoubleClick],
  );

  return (
    <div ref={viewportRef} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        panOnScroll={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="#d6dcf5" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!shadow-sm !border-gray-200"
        />
      </ReactFlow>
    </div>
  );
}

/**
 * The main React Flow canvas that renders the family tree.
 * Supports pan (left-click drag), zoom (mouse wheel), and fit-to-view.
 */
export function TreeCanvas(props: TreeCanvasProps) {
  return <TreeCanvasInner {...props} />;
}
