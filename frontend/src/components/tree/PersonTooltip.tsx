import { createPortal } from 'react-dom';
import { sortEventsChronologically } from '../../utils/eventSort';
import type { TreeNode, TreeNodeName } from '../../types/models';

interface PersonTooltipProps {
  data: TreeNode;
  position: { x: number; y: number };
}

const NAME_TYPE_LABELS: Record<string, string> = {
  birth: 'Birth name',
  maiden: 'Maiden name',
  married: 'Married name',
  aka: 'Also known as',
};

function getNameTypeLabel(nameType?: string): string {
  if (!nameType?.trim()) return 'Name';
  const key = nameType.trim().toLowerCase();
  if (NAME_TYPE_LABELS[key]) return NAME_TYPE_LABELS[key];
  if (key.includes('maiden')) return 'Maiden name';
  if (key.includes('married')) return 'Married name';
  if (key.includes('aka') || key.includes('also known')) return 'Also known as';
  if (key.includes('birth')) return 'Birth name';
  return nameType;
}

/**
 * Floating tooltip showing a person's summary: names, birth, death, life events, notes.
 * Rendered via portal so it's not clipped by React Flow's viewport.
 */
export function PersonTooltip({ data, position }: PersonTooltipProps) {
  const tooltipWidth = 300;
  const tooltipMaxHeight = 380;
  const offsetX = 16;
  const offsetY = 16;

  let left = position.x + offsetX;
  let top = position.y + offsetY;

  if (left + tooltipWidth > window.innerWidth - 20) {
    left = position.x - tooltipWidth - offsetX;
  }
  if (top + tooltipMaxHeight > window.innerHeight - 20) {
    top = position.y - tooltipMaxHeight - offsetY;
  }

  const formatDate = (exactDate?: string, approxDate?: string): string => {
    if (exactDate) return exactDate;
    if (approxDate) return approxDate;
    return '';
  };

  const displayName = (data.display_name || '').trim();
  const names: TreeNodeName[] = (data.names ?? []).filter(
    (n) => (n.formatted || '').trim() && (n.formatted || '').trim() !== displayName
  );
  const birthDate = formatDate(data.birth_date, data.birth_date_approx);
  const deathDate = formatDate(data.death_date, data.death_date_approx);
  const hasNames = names.length > 0;
  const hasBirth = birthDate || data.birth_place;
  const hasDeath = deathDate || data.death_place;
  const hasEvents = data.events.length > 0;
  const hasNotes = !!data.notes;
  const hasAnyContent = hasNames || hasBirth || hasDeath || hasEvents || hasNotes;

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
        <div className={hasAnyContent ? "mb-2 pb-2 border-b border-gray-100" : ""}>
          <p className="font-semibold text-sm text-gray-900">
            {data.display_name}
          </p>
          {data.gedcom_id && (
            <p className="text-[10px] text-gray-400">{data.gedcom_id}</p>
          )}
        </div>

        {/* All names (birth, maiden, married, aka, etc.) */}
        {hasNames && (
          <div className="mb-1.5 space-y-1">
            {names.map((n, idx) => (
              <div key={idx} className="text-xs">
                <span className="font-medium text-gray-700">
                  {getNameTypeLabel(n.name_type)}:
                </span>
                <span className="text-gray-600 ml-1">{n.formatted}</span>
              </div>
            ))}
          </div>
        )}

        {/* Birth */}
        {hasBirth && (
          <div className={`mb-1.5 text-xs ${hasNames ? 'mt-2 pt-2 border-t border-gray-100' : ''}`}>
            <span className="font-medium text-gray-700">Born</span>
            {birthDate && <span className="text-gray-500 ml-1">{birthDate}</span>}
            {data.birth_place && (
              <span className="text-gray-400 ml-1">— {data.birth_place}</span>
            )}
          </div>
        )}

        {/* Death */}
        {hasDeath && (
          <div className="mb-1.5 text-xs">
            <span className="font-medium text-gray-700">Died</span>
            {deathDate && <span className="text-gray-500 ml-1">{deathDate}</span>}
            {data.death_place && (
              <span className="text-gray-400 ml-1">— {data.death_place}</span>
            )}
          </div>
        )}

        {/* Events */}
        {hasEvents && (
          <div className={(hasBirth || hasDeath) ? "mt-2 pt-2 border-t border-gray-100 space-y-1.5" : "space-y-1.5"}>
            {sortEventsChronologically(data.events).map((event, idx) => {
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
        )}

        {/* Notes */}
        {hasNotes && (
          <div className={(hasBirth || hasDeath || hasEvents) ? "mt-2 pt-2 border-t border-gray-100" : ""}>
            <p className="text-xs text-gray-400 italic whitespace-pre-line line-clamp-4">
              {data.notes}
            </p>
          </div>
        )}

        {!hasAnyContent && (
          <p className="text-xs text-gray-400 italic">No details recorded</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
