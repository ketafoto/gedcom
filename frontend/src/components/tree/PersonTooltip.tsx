import { createPortal } from 'react-dom';
import type { TreeNode } from '../../types/models';

interface PersonTooltipProps {
  data: TreeNode;
  position: { x: number; y: number };
}

/**
 * Floating tooltip showing the person's life events as a chronological story.
 * Rendered via portal so it's not clipped by React Flow's viewport.
 */
export function PersonTooltip({ data, position }: PersonTooltipProps) {
  // Position the tooltip offset from the cursor, flip if near viewport edge
  const tooltipWidth = 300;
  const tooltipMaxHeight = 320;
  const offsetX = 16;
  const offsetY = 16;

  let left = position.x + offsetX;
  let top = position.y + offsetY;

  // Flip horizontally if it would overflow
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = position.x - tooltipWidth - offsetX;
  }
  // Flip vertically if it would overflow
  if (top + tooltipMaxHeight > window.innerHeight - 20) {
    top = position.y - tooltipMaxHeight - offsetY;
  }

  const formatDate = (exactDate?: string, approxDate?: string): string => {
    if (exactDate) return exactDate;
    if (approxDate) return approxDate;
    return '';
  };

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-gray-200 p-3 max-h-80 overflow-y-auto"
        style={{ width: tooltipWidth }}
      >
        {/* Header */}
        <div className="mb-2 pb-2 border-b border-gray-100">
          <p className="font-semibold text-sm text-gray-900">
            {data.display_name}
          </p>
          {data.gedcom_id && (
            <p className="text-[10px] text-gray-400">{data.gedcom_id}</p>
          )}
        </div>

        {/* Events timeline */}
        <div className="space-y-1.5">
          {data.events.map((event, idx) => {
            const date = formatDate(event.event_date, event.event_date_approx);
            return (
              <div key={idx} className="flex gap-2 text-xs">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <div className="min-w-0">
                  <span className="font-medium text-gray-700">
                    {date && <span className="text-gray-500 mr-1">{date}</span>}
                    {event.event_type}
                  </span>
                  {event.event_place && (
                    <p className="text-gray-400 truncate">{event.event_place}</p>
                  )}
                  {event.description && (
                    <p className="text-gray-400 italic">{event.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {data.events.length === 0 && (
          <p className="text-xs text-gray-400 italic">No events recorded</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
