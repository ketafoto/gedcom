import { useState, useCallback } from 'react';
import { Download, X } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { Button } from '../common/Button';
import toast from 'react-hot-toast';

interface ExportControlsProps {
  /** The DOM element to capture (React Flow viewport) */
  getElement: () => HTMLElement | null;
  /** Called before export starts (e.g. hide UI elements) */
  onExportStart?: () => void;
  /** Called after export completes */
  onExportEnd?: () => void;
  onClose: () => void;
}

type ImageFormat = 'png' | 'jpeg';
type DpiOption = 150 | 300;

/**
 * Panel for configuring and triggering tree image export.
 * Supports PNG/JPEG at 150 or 300 DPI with quality control for JPEG.
 */
export function ExportControls({
  getElement,
  onExportStart,
  onExportEnd,
  onClose,
}: ExportControlsProps) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [dpi, setDpi] = useState<DpiOption>(300);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    const element = getElement();
    if (!element) {
      toast.error('Could not find tree element to export');
      return;
    }

    setExporting(true);
    onExportStart?.();

    try {
      // Wait a frame for UI changes to take effect
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const pixelRatio = dpi / 96;
      const options = {
        pixelRatio,
        backgroundColor: '#ffffff',
        cacheBust: true,
      };

      let dataUrl: string;
      if (format === 'jpeg') {
        dataUrl = await toJpeg(element, { ...options, quality });
      } else {
        dataUrl = await toPng(element, options);
      }

      // Trigger download
      const link = document.createElement('a');
      link.download = `family-tree.${format === 'jpeg' ? 'jpg' : 'png'}`;
      link.href = dataUrl;
      link.click();

      toast.success('Tree exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export tree image');
    } finally {
      setExporting(false);
      onExportEnd?.();
    }
  }, [format, quality, dpi, getElement, onExportStart, onExportEnd]);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Export Tree</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Format */}
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-600 block mb-1">Format</label>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="png"
              checked={format === 'png'}
              onChange={() => setFormat('png')}
              className="accent-emerald-600"
            />
            PNG
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="jpeg"
              checked={format === 'jpeg'}
              onChange={() => setFormat('jpeg')}
              className="accent-emerald-600"
            />
            JPEG
          </label>
        </div>
      </div>

      {/* Quality (JPEG only) */}
      {format === 'jpeg' && (
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Quality: {Math.round(quality * 100)}%
          </label>
          <input
            type="range"
            min={50}
            max={100}
            value={quality * 100}
            onChange={(e) => setQuality(Number(e.target.value) / 100)}
            className="w-full h-1.5 accent-emerald-600"
          />
        </div>
      )}

      {/* DPI */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 block mb-1">Resolution</label>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="dpi"
              value={150}
              checked={dpi === 150}
              onChange={() => setDpi(150)}
              className="accent-emerald-600"
            />
            150 DPI
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="dpi"
              value={300}
              checked={dpi === 300}
              onChange={() => setDpi(300)}
              className="accent-emerald-600"
            />
            300 DPI
          </label>
        </div>
      </div>

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={exporting}
        className="w-full"
      >
        <Download className="w-4 h-4 mr-2" />
        {exporting ? 'Exporting...' : 'Download'}
      </Button>
    </div>
  );
}
