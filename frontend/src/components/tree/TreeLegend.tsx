/**
 * Legend panel explaining the different connector styles in the family tree.
 * Displayed in the bottom-right corner of the tree canvas.
 */
export function TreeLegend() {
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
        Legend
      </p>
      <div className="space-y-1.5">
        {/* Biological parent-child */}
        <div className="flex items-center gap-2">
          <svg width="28" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#9ca3af" strokeWidth="2" />
          </svg>
          <span className="text-[10px] text-gray-600">Biological</span>
        </div>

        {/* Non-biological parent-child */}
        <div className="flex items-center gap-2">
          <svg width="28" height="8" className="flex-shrink-0">
            <line
              x1="0" y1="4" x2="28" y2="4"
              stroke="#f9a8d4"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </svg>
          <span className="text-[10px] text-gray-600">Non-biological</span>
        </div>

        {/* Marriage connector */}
        <div className="flex items-center gap-2">
          <svg width="28" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="28" y2="4" stroke="#fb7185" strokeWidth="2" />
          </svg>
          <span className="text-[10px] text-gray-600">Marriage</span>
        </div>

        {/* Unmarried partner connector */}
        <div className="flex items-center gap-2">
          <svg width="28" height="8" className="flex-shrink-0">
            <line
              x1="0" y1="4" x2="28" y2="4"
              stroke="#c084fc"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          </svg>
          <span className="text-[10px] text-gray-600">Partnership</span>
        </div>

        {/* Focus person */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full ring-2 ring-amber-400 bg-amber-50 flex-shrink-0" />
          <span className="text-[10px] text-gray-600">Focus person</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
        Click a person to re-center the tree on them.
      </p>
    </div>
  );
}
