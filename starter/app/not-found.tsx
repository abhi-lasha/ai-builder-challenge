/**
 * Global 404 — shown whenever notFound() is called or a route doesn't exist.
 *
 * Keeps the app shell (header/nav stay visible) and gives the user two clear
 * paths out: back to the manager list or back to the technician workflows.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      {/* Subtle barcode icon */}
      <svg
        className="h-12 w-12 text-gray-300 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
        />
      </svg>

      <h1 className="text-lg font-semibold text-gray-900">Asset not found</h1>
      <p className="mt-1 text-sm text-gray-500 max-w-xs">
        That tag doesn't exist in the system, or the URL might be wrong.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/manager"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-h-[44px] flex items-center"
        >
          Go to asset list
        </Link>
        <Link
          href="/tech"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-h-[44px] flex items-center"
        >
          Go to scan workflows
        </Link>
      </div>
    </div>
  );
}
