"use client";

/**
 * Tech segment error boundary.
 *
 * Same rationale as app/manager/error.tsx — catches unexpected render errors
 * inside any page under app/tech/**. The messaging is tailored to a
 * technician: skip the "your data is safe" framing and focus on the action
 * (re-scan, or grab a manager if something is seriously wrong).
 */

import { useEffect } from "react";
import Link from "next/link";

export default function TechError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[tech] unhandled render error:", error);
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
        This page couldn't load. Try again — if it keeps happening, contact your manager.
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-gray-400">
          Error ID: {error.digest}
        </p>
      )}

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-h-[44px]"
        >
          Try again
        </button>
        <Link
          href="/tech"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-h-[44px] flex items-center"
        >
          Back to workflows
        </Link>
      </div>
    </div>
  );
}
