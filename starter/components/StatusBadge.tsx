/**
 * StatusBadge — displays an asset state as a coloured pill.
 *
 * Uses cva (class-variance-authority) to define the state × size variant
 * matrix. cva is the right tool here because we have two independent variant
 * dimensions (6 states × 2 sizes) and would otherwise need a nested lookup
 * table or string interpolation that Tailwind's JIT can't statically analyse.
 *
 * Accessibility: color is never the only indicator — each state has a
 * distinct text label. The aria-label on the span provides a full sentence
 * for screen readers ("Status: In service").
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { AssetState } from "@/lib/types";

// ── Variant definition ────────────────────────────────────────────────────────

const badge = cva(
  // Base — shared by every variant
  "inline-flex items-center rounded-full font-medium ring-1 ring-inset",
  {
    variants: {
      state: {
        unreceived: "bg-gray-100  text-gray-700  ring-gray-200",
        received:   "bg-blue-50   text-blue-700  ring-blue-200",
        stored:     "bg-amber-50  text-amber-700 ring-amber-200",
        in_service: "bg-green-50  text-green-700 ring-green-200",
        rma_pending:"bg-orange-50 text-orange-700 ring-orange-200",
        disposed:   "bg-red-50    text-red-700   ring-red-200",
      },
      size: {
        sm: "px-2   py-0.5 text-xs",
        md: "px-2.5 py-1   text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ── Label map ────────────────────────────────────────────────────────────────

const STATE_LABEL: Record<AssetState, string> = {
  unreceived:  "Unreceived",
  received:    "Received",
  stored:      "Stored",
  in_service:  "In service",
  rma_pending: "RMA pending",
  disposed:    "Disposed",
};

// ── Component ────────────────────────────────────────────────────────────────

type Props = VariantProps<typeof badge> & {
  /** AssetState string — falls back gracefully for unknown values. */
  state: AssetState | string;
  className?: string;
};

export function StatusBadge({ state, size, className }: Props) {
  const knownState = state as AssetState;
  const label = STATE_LABEL[knownState] ?? state;

  return (
    <span
      className={cn(
        badge({ state: STATE_LABEL[knownState] ? knownState : undefined, size }),
        !STATE_LABEL[knownState] && "bg-gray-100 text-gray-600 ring-gray-200",
        className,
      )}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
