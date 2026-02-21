import { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TreeNode } from '../../types/models';
import { MaleSilhouette } from './MaleSilhouette';
import { FemaleSilhouette } from './FemaleSilhouette';
import { PersonTooltip } from './PersonTooltip';

interface PersonNodeData extends TreeNode {
  isFocus: boolean;
}

/**
 * Custom React Flow node for rendering a person in the family tree.
 * Shows a rectangular (slightly rounded) portrait, name, and birth/death years.
 */
export const PersonNode = memo(function PersonNode({
  data,
}: {
  data: PersonNodeData;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setShowTooltip(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  // Format year from date string (e.g. "1950-05-15" → "1950", or "ABT 1970" → "~1970")
  const formatYear = (
    exactDate?: string,
    approxDate?: string,
  ): string => {
    if (exactDate) {
      return exactDate.substring(0, 4);
    }
    if (approxDate) {
      const parts = approxDate.split(/\s+/);
      for (const part of parts.reverse()) {
        if (/^\d{4}$/.test(part)) return `~${part}`;
      }
      return approxDate;
    }
    return '?';
  };

  const birthYear = formatYear(data.birth_date, data.birth_date_approx);
  const deathYear = data.death_date || data.death_date_approx
    ? formatYear(data.death_date, data.death_date_approx)
    : null;

  const lifespan = deathYear ? `${birthYear} – ${deathYear}` : birthYear !== '?' ? `b. ${birthYear}` : '';

  const borderColor = data.isFocus
    ? 'ring-amber-400 ring-4'
    : 'ring-gray-300 ring-2';

  return (
    <>
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />

      <div
        className="flex flex-col items-center gap-1 cursor-pointer select-none group"
        style={{ width: 140 }}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Portrait: rectangular with slightly rounded corners */}
        <div
          className={`w-[88px] h-[110px] rounded-xl overflow-hidden ring ${borderColor} ${
            data.isFocus ? 'shadow-lg shadow-amber-200' : ''
          } bg-white transition-shadow group-hover:shadow-md`}
        >
          {data.photo_url ? (
            <img
              src={data.photo_url}
              alt={data.display_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : data.sex_code === 'F' ? (
            <FemaleSilhouette className="w-full h-full" />
          ) : (
            <MaleSilhouette className="w-full h-full" />
          )}
        </div>

        {/* Name */}
        <div className="text-center leading-tight max-w-[140px]">
          <p className="text-xs font-semibold text-gray-800 truncate" title={data.display_name}>
            {data.display_name}
          </p>
          {lifespan && (
            <p className="text-[10px] text-gray-500">{lifespan}</p>
          )}
        </div>
      </div>

      {/* Tooltip portal */}
      {showTooltip && data.events.length > 0 && (
        <PersonTooltip
          data={data}
          position={tooltipPos}
        />
      )}
    </>
  );
});
