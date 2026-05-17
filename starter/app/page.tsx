import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <section className="pt-4">
        <h1 className="text-3xl font-semibold text-gray-900">Lab Asset Tracking</h1>
        <p className="text-gray-500 mt-2 max-w-xl text-sm leading-relaxed">
          Track equipment across all sites — from receiving dock to rack to retirement.
          Three systems, one view. Use the role switcher in the header to act as a
          technician or asset manager.
        </p>
      </section>

      {/* Role entry points */}
      <section className="grid md:grid-cols-2 gap-5">
        {/* Technician */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">T</span>
              <h2 className="text-lg font-semibold text-gray-900">Technician</h2>
            </div>
            <p className="text-sm text-gray-500">
              Mobile scan workflows for dock-side receiving, storage moves, rack deployments, and custody transfers.
            </p>
          </div>

          <ul className="text-sm text-gray-600 space-y-1.5">
            {[
              ["Check in new equipment", "/tech/receive"],
              ["Move to storage", "/tech/store"],
              ["Deploy to a rack", "/tech/deploy"],
              ["Transfer custody", "/tech/transfer"],
            ].map(([label, href]) => (
              <li key={href} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" aria-hidden="true" />
                <Link href={href!} className="hover:text-blue-700 hover:underline transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/tech"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          >
            Open scan workflows
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Manager */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-sm font-bold">M</span>
              <h2 className="text-lg font-semibold text-gray-900">Asset Manager</h2>
            </div>
            <p className="text-sm text-gray-500">
              Desktop dashboard for browsing assets, reviewing event history, and spotting discrepancies across systems.
            </p>
          </div>

          <ul className="text-sm text-gray-600 space-y-1.5">
            {[
              ["Browse all assets", "/manager"],
              ["Asset detail & event log", "/manager/assets/C0000101"],
              ["Reconciliation report", "/manager/reconcile"],
            ].map(([label, href]) => (
              <li key={href} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 flex-shrink-0" aria-hidden="true" />
                <Link href={href!} className="hover:text-purple-700 hover:underline transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/manager"
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 transition-colors"
          >
            Open dashboard
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Test barcodes hint */}
      <section className="rounded-lg border border-gray-100 bg-gray-50 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Need barcodes to scan?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Printable QR codes for all test assets, locations, and badge IDs.
          </p>
        </div>
        <Link
          href="/dev/barcodes"
          className="flex-shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          View barcodes →
        </Link>
      </section>
    </div>
  );
}
