/**
 * Date / time formatting utilities.
 * Kept separate from scan-utils so each module has a single responsibility.
 */

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "5m ago", "3h ago", "2d ago", "Apr 12"
 */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns a full absolute date + time string for tooltips.
 * e.g. "May 16, 2026 at 11:42 PM"
 */
export function formatAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
