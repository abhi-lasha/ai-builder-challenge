/**
 * Button class variants.
 *
 * Three base intents × two sizes. Every button in the app maps to one of
 * these — page-specific overrides (border colour, width) are composed on
 * top via cn().
 *
 * Decision: kept as plain strings rather than cva() because the variants here
 * are simple enough that a Record<> lookup is clearer. cva shines when you
 * have 3+ variant dimensions with combinatorial defaults; two flat maps don't
 * need the extra abstraction.
 */
import { focusRing } from "./focus";

// ── Base ──────────────────────────────────────────────────────────────────────

const base = `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${focusRing}`;

// ── Intent variants ───────────────────────────────────────────────────────────

export const btn = {
  /**
   * Primary action — filled, high contrast.
   * Use for the main CTA on a screen (Submit, Deploy, etc.).
   */
  primary: `${base} bg-blue-600 text-white hover:bg-blue-700`,

  /**
   * Secondary action — outlined, low emphasis.
   * Use for supporting actions (Refresh, Print, Reconcile link).
   */
  secondary: `${base} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`,

  /**
   * Ghost / text-only — minimal chrome.
   * Use for destructive-but-reversible actions (Clear filters, Re-scan).
   */
  ghost: `${base} text-gray-500 hover:text-gray-700 hover:underline`,
} as const;

// ── Size variants ─────────────────────────────────────────────────────────────

export const btnSize = {
  /** Full-width scan workflow buttons — glove-friendly 44 px touch target. */
  lg: "w-full py-3 text-sm min-h-[44px]",
  /** Standard toolbar / filter bar buttons. */
  md: "px-4 py-2 text-sm min-h-[44px]",
  /** Compact inline buttons (filter chips, table actions). */
  sm: "px-3 py-1.5 text-sm min-h-[36px]",
} as const;
