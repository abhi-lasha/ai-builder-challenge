/**
 * Canonical focus ring strings.
 *
 * A single source of truth for keyboard-focus styles. Every interactive
 * element in the app references one of these rather than hand-rolling its own
 * ring colour, width, or offset.
 *
 * Why a separate file: the focus ring appeared 27+ times across components
 * and pages. Centralising it means one change updates the whole app and makes
 * it impossible to accidentally omit focus:outline-none (which causes the
 * browser default to stack on top of the custom ring).
 */

/** Standard blue focus ring — use on most interactive elements. */
export const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1";

/** Inset ring — for elements that sit flush with a border (tabs, table rows). */
export const focusRingInset =
  "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500";

/** Green ring — for the deploy workflow's primary actions. */
export const focusRingGreen =
  "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1";

/** Purple ring — for the transfer workflow's primary actions. */
export const focusRingPurple =
  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1";
