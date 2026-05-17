"use client";

/**
 * Manager segment error boundary.
 *
 * Next.js renders this whenever an unhandled error bubbles up from any
 * component inside app/manager/** during render or in a Server Component.
 * Client-side fetch errors caught inside try/catch don't reach here — those
 * are handled by the page's own error state. This catches the unexpected:
 * bad API response shapes, null-pointer during render, third-party library
 * crashes, etc.
 *
 * The `reset` function re-renders the segment from scratch — equivalent to
 * the user refreshing but without a full page reload.
 */

import { useEffect } from "react";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your error reporting service here (Sentry, Datadog, etc.)
    console.error("[manager] unhandled render error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <svg
        className="h-10 w-10 text-red-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>

      <h1 className="text-base font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">
        An unexpected error occurred while loading this page. Your data is safe — this is a display problem.
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-gray-400">
          Error ID: {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-h-[44px]"
      >
        Try again
      </button>
    </div>
  );
}
