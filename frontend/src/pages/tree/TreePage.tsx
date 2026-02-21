import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { X, Download, GitBranch } from 'lucide-react';

import { treeApi } from '../../api/tree';
import { individualsApi } from '../../api/individuals';
import { Spinner } from '../../components/common/Spinner';
import { TreeCanvas } from '../../components/tree/TreeCanvas';
import { DepthSlider } from '../../components/tree/DepthSlider';
import { TreeLegend } from '../../components/tree/TreeLegend';
import { ExportControls } from '../../components/tree/ExportControls';

/**
 * Main tree visualization page.
 * Shows a family tree centered on an individual with depth controls,
 * export functionality, and a legend.
 */
export function TreePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const individualId = Number(id);

  const [ancestorDepth, setAncestorDepth] = useState(1);
  const [descendantDepth, setDescendantDepth] = useState(1);
  const [showExport, setShowExport] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Reset depths when navigating to a different person's tree
  useEffect(() => {
    setAncestorDepth(1);
    setDescendantDepth(1);
  }, [individualId]);

  // Fetch focus individual info (for the header)
  const { data: individual } = useQuery({
    queryKey: ['individuals', id],
    queryFn: () => individualsApi.get(individualId),
    enabled: !!id,
  });

  // Fetch tree data
  const { data: treeData, isLoading, isError } = useQuery({
    queryKey: ['tree', individualId, { ancestor_depth: ancestorDepth, descendant_depth: descendantDepth }],
    queryFn: () =>
      treeApi.getTree(individualId, {
        ancestor_depth: ancestorDepth,
        descendant_depth: descendantDepth,
      }),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Close handler: go back to previous page
  const handleClose = useCallback(() => {
    // Try to go back in history; if there's no history, go to the individual detail page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/individuals/${id}`);
    }
  }, [navigate, id]);

  // Click a node: re-center tree on that person (new focus, redraw with their predecessors/successors)
  const handlePersonClick = useCallback(
    (clickedId: number) => {
      if (clickedId === individualId) return; // already focused
      navigate(`/individuals/${clickedId}/tree`, { replace: true });
    },
    [navigate, individualId],
  );

  // Export helpers
  const getExportElement = useCallback(() => {
    if (!viewportRef.current) return null;
    // Find the React Flow viewport element inside our container
    return viewportRef.current.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  // Display name for header
  const displayName = individual?.names[0]
    ? `${individual.names[0].given_name || ''} ${individual.names[0].family_name || ''}`.trim() ||
      'Unnamed'
    : 'Individual';

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-emerald-600" />
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Family Tree: {displayName}
            </h1>
            {individual?.gedcom_id && (
              <p className="text-[10px] text-gray-400">{individual.gedcom_id}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Depth sliders */}
          {treeData && (
            <DepthSlider
              ancestorDepth={ancestorDepth}
              descendantDepth={descendantDepth}
              maxAncestorDepth={treeData.max_ancestor_depth}
              maxDescendantDepth={treeData.max_descendant_depth}
              onAncestorDepthChange={setAncestorDepth}
              onDescendantDepthChange={setDescendantDepth}
            />
          )}

          {/* Export button */}
          <button
            onClick={() => setShowExport(!showExport)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export as image"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close tree view"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Loading family tree...</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Failed to load family tree</p>
              <button
                onClick={handleClose}
                className="text-emerald-600 hover:underline text-sm"
              >
                Go back
              </button>
            </div>
          </div>
        )}

        {treeData && (
          <ReactFlowProvider key={individualId}>
            <TreeCanvas
              data={treeData}
              viewportRef={viewportRef}
              onPersonClick={handlePersonClick}
            />
          </ReactFlowProvider>
        )}

        {/* Legend - bottom right */}
        <div className="absolute bottom-4 right-4 z-10">
          <TreeLegend />
        </div>

        {/* Export panel - top right */}
        {showExport && (
          <div className="absolute top-4 right-4 z-10">
            <ExportControls
              getElement={getExportElement}
              onClose={() => setShowExport(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
