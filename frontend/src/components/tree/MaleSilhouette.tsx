/**
 * Male silhouette SVG used as a placeholder when no photo is available.
 */
export function MaleSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="50" fill="#e5e7eb" />
      {/* Head */}
      <circle cx="50" cy="36" r="16" fill="#9ca3af" />
      {/* Shoulders / body */}
      <path
        d="M20 88 C20 66 35 58 50 58 C65 58 80 66 80 88"
        fill="#9ca3af"
      />
    </svg>
  );
}
