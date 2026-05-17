"use client";

/**
 * ErrorBanner — surface API errors and network failures to the user.
 *
 * Uses role="alert" so screen readers announce it immediately.
 * Color is paired with an icon, never color alone.
 */

type Props = {
  title: string;
  detail?: string;
  action?: string;
  onDismiss?: () => void;
};

export function ErrorBanner({ title, detail, action, onDismiss }: Props) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <div className="flex items-start gap-3">
        {/* Icon — paired with text, not color alone */}
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-800">{title}</p>
          {detail && (
            <p className="mt-1 text-sm text-red-700">{detail}</p>
          )}
          {action && (
            <p className="mt-1 text-sm text-red-600 font-medium">{action}</p>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="flex-shrink-0 rounded-md p-1 text-red-400 hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
