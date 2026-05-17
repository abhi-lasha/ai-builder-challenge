"use client";

/**
 * InfoBanner — neutral informational notice (e.g. "already received — idempotent").
 * Sits between success and error in severity.
 */

type Props = {
  title: string;
  detail?: string;
  onDismiss?: () => void;
};

export function InfoBanner({ title, detail, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800">{title}</p>
          {detail && (
            <p className="mt-1 text-sm text-blue-700">{detail}</p>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="flex-shrink-0 rounded-md p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
