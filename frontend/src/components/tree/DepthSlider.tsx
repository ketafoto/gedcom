import { useState, useCallback } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface DepthSliderProps {
  ancestorDepth: number;
  descendantDepth: number;
  maxAncestorDepth: number;
  maxDescendantDepth: number;
  onAncestorDepthChange: (depth: number) => void;
  onDescendantDepthChange: (depth: number) => void;
}

/**
 * Two independent sliders for ancestor/descendant depth with a "Lock" checkbox.
 * When locked, moving either slider moves the other symmetrically.
 */
export function DepthSlider({
  ancestorDepth,
  descendantDepth,
  maxAncestorDepth,
  maxDescendantDepth,
  onAncestorDepthChange,
  onDescendantDepthChange,
}: DepthSliderProps) {
  const [locked, setLocked] = useState(true);

  const handleAncestorChange = useCallback(
    (value: number) => {
      onAncestorDepthChange(value);
      if (locked) {
        onDescendantDepthChange(Math.min(value, maxDescendantDepth));
      }
    },
    [locked, maxDescendantDepth, onAncestorDepthChange, onDescendantDepthChange],
  );

  const handleDescendantChange = useCallback(
    (value: number) => {
      onDescendantDepthChange(value);
      if (locked) {
        onAncestorDepthChange(Math.min(value, maxAncestorDepth));
      }
    },
    [locked, maxAncestorDepth, onAncestorDepthChange, onDescendantDepthChange],
  );

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200">
      {/* Ancestor slider */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap w-20">
          Ancestors
        </label>
        <input
          type="range"
          min={0}
          max={maxAncestorDepth}
          value={ancestorDepth}
          onChange={(e) => handleAncestorChange(Number(e.target.value))}
          className="w-28 h-1.5 accent-emerald-600"
        />
        <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
          {ancestorDepth} / {maxAncestorDepth}
        </span>
      </div>

      {/* Lock toggle */}
      <button
        onClick={() => setLocked(!locked)}
        className={`p-1.5 rounded-md transition-colors ${
          locked
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title={locked ? 'Sliders locked (symmetric)' : 'Sliders unlocked (independent)'}
      >
        {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
      </button>

      {/* Descendant slider */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-600 whitespace-nowrap w-24">
          Descendants
        </label>
        <input
          type="range"
          min={0}
          max={maxDescendantDepth}
          value={descendantDepth}
          onChange={(e) => handleDescendantChange(Number(e.target.value))}
          className="w-28 h-1.5 accent-emerald-600"
        />
        <span className="text-xs text-gray-500 w-10 text-right tabular-nums">
          {descendantDepth} / {maxDescendantDepth}
        </span>
      </div>
    </div>
  );
}
