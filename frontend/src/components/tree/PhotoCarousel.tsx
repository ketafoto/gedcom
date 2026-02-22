import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TreeNodePhoto } from '../../types/models';

const PREFERRED_AGE = 35;

interface PhotoCarouselProps {
  photos: TreeNodePhoto[];
  alt: string;
  isHovering: boolean;
  intervalMs?: number;
  className?: string;
}

function findRestIndex(photos: TreeNodePhoto[]): number {
  const explicitIdx = photos.findIndex((p) => p.is_default);
  if (explicitIdx >= 0) return explicitIdx;

  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < photos.length; i++) {
    if (photos[i].age != null) {
      const diff = Math.abs(photos[i].age! - PREFERRED_AGE);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

/**
 * Cycles through photos on hover with a cross-fade transition.
 * At rest shows the default photo, or the one closest to age 35.
 */
export function PhotoCarousel({
  photos,
  alt,
  isHovering,
  intervalMs = 2000,
  className = '',
}: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const restIndex = useMemo(() => findRestIndex(photos), [photos]);

  useEffect(() => {
    if (isHovering && photos.length > 1) {
      setIndex(0);
      timerRef.current = setInterval(() => {
        setIndex((prev) => (prev + 1) % photos.length);
      }, intervalMs);
    } else {
      clearInterval(timerRef.current);
      setIndex(restIndex);
    }
    return () => clearInterval(timerRef.current);
  }, [isHovering, photos.length, intervalMs, restIndex]);

  if (photos.length === 0) return null;

  const photo = photos[index];

  return (
    <div className={`relative w-full h-full ${className}`}>
      <AnimatePresence mode="wait">
        <motion.img
          key={photo.url}
          src={photo.url}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>

      {/* Age label shown during carousel */}
      {isHovering && photos.length > 1 && photo.age != null && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[8px]
                     leading-none px-1 py-0.5 rounded"
        >
          {photo.age}y
        </motion.span>
      )}
    </div>
  );
}
