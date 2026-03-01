import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ReactFlowProvider } from '@xyflow/react';
import { X, Download, GitBranch } from 'lucide-react';

import { treeApi } from '../../api/tree';
import { Spinner } from '../../components/common/Spinner';
import { TreeCanvas } from '../../components/tree/TreeCanvas';
import { TreeLegend } from '../../components/tree/TreeLegend';
import { ExportControls } from '../../components/tree/ExportControls';

/**
 * Full tree overview page.
 * Shows every individual in the database — even disconnected sub-trees —
 * laid out side by side.
 */
export function TreeOverviewPage() {
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const { data: treeData, isLoading, isError } = useQuery({
    queryKey: ['tree', 'full'],
    queryFn: () => treeApi.getFullTree(),
    staleTime: 5 * 60 * 1000,
  });

  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handlePersonClick = useCallback(
    (clickedId: number) => {
      navigate(`/individuals/${clickedId}/tree`);
    },
    [navigate],
  );

  const handlePersonDoubleClick = useCallback(
    (clickedId: number) => {
      navigate(`/individuals/${clickedId}`);
    },
    [navigate],
  );

  const getExportElement = useCallback(() => {
    if (!viewportRef.current) return null;
    return viewportRef.current.querySelector('.react-flow__viewport') as HTMLElement | null;
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-emerald-600" />
          <h1 className="text-sm font-semibold text-gray-900">
            Full Family Tree
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExport(!showExport)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export as image"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>

          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close tree view"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" />
              <p className="text-sm text-gray-500">Loading full tree...</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-600 mb-2">Failed to load full tree</p>
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
          <ReactFlowProvider>
            <TreeCanvas
              data={treeData}
              viewportRef={viewportRef}
              onPersonClick={handlePersonClick}
              onPersonDoubleClick={handlePersonDoubleClick}
            />
          </ReactFlowProvider>
        )}

        <div className="absolute bottom-4 right-4 z-10">
          <TreeLegend />
        </div>

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
