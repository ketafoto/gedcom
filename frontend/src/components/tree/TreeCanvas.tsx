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
  /** Ref to expose the React Flow viewport element for export */
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  /** Callback when a person node is clicked (re-center tree on them) */
  onPersonClick?: (individualId: number) => void;
}

const nodeTypes: NodeTypes = {
  personNode: PersonNode as any,
};

/**
 * Inner component that uses useReactFlow (must be inside ReactFlowProvider).
 */
function TreeCanvasInner({ data, viewportRef, onPersonClick }: TreeCanvasProps) {
  const { fitView } = useReactFlow();
  const layout = useMemo(() => computeTreeLayout(data), [data]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Update nodes/edges when data changes
  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
    // Fit view after layout settles
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 150);
    return () => clearTimeout(timer);
  }, [layout, setNodes, setEdges, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onPersonClick?.(Number(node.id));
    },
    [onPersonClick],
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e5e7eb" />
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
