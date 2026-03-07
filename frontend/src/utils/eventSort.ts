/**
 * Sort key for chronological order (earliest first).
 * Uses event_date when present (ISO sorts correctly), else event_date_approx, else sentinel so no-date is last.
 */
function eventSortKey(ev: { event_date?: string; event_date_approx?: string }): string {
  if (ev.event_date?.trim()) return ev.event_date.trim();
  if (ev.event_date_approx?.trim()) return ev.event_date_approx.trim();
  return '\uFFFF';
}

/** Sorts events chronologically (earliest first). Events without date go last. */
export function sortEventsChronologically<T extends { event_date?: string; event_date_approx?: string }>(
  events: T[]
): T[] {
  return [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
}
