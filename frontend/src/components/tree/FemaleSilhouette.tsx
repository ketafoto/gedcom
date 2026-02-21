/**
 * Female silhouette SVG used as a placeholder when no photo is available.
 */
export function FemaleSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="50" fill="#fce7f3" />
      {/* Head */}
      <circle cx="50" cy="34" r="16" fill="#f9a8d4" />
      {/* Hair */}
      <path
        d="M34 34 C34 20 42 14 50 14 C58 14 66 20 66 34 C66 28 60 22 50 22 C40 22 34 28 34 34Z"
        fill="#ec4899"
        opacity="0.4"
      />
      {/* Shoulders / body with slight taper */}
      <path
        d="M22 88 C22 68 36 58 50 58 C64 58 78 68 78 88"
        fill="#f9a8d4"
      />
    </svg>
  );
}
