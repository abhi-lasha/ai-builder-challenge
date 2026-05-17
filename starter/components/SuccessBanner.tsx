"use client";

/**
 * SuccessBanner — confirms a completed scan action.
 *
 * Uses role="status" (polite announcement) since success is good news,
 * not an interruption. The tech can keep working without it grabbing focus.
 */

type Props = {
  title: string;
  detail?: string;
  onDismiss?: () => void;
};

export function SuccessBanner({ title, detail, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-green-200 bg-green-50 p-4"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800">{title}</p>
          {detail && (
            <p className="mt-1 text-sm text-green-700">{detail}</p>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss confirmation"
            className="flex-shrink-0 rounded-md p-1 text-green-400 hover:bg-green-100 hover:text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg
              className="h-4 w-4"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
