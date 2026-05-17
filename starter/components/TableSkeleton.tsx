/**
 * TableSkeleton — shimmer placeholder that mirrors a real table's column layout.
 *
 * Two variants:
 *   "assets"     — Asset/Model · State · Site · Custodian · Updated  (manager list)
 *   "reconcile"  — Asset tag · Model · Ops state · Status · Issues   (reconcile report)
 *
 * Keeping both variants in one component avoids duplicate shimmer logic while
 * staying close enough to each table's real columns that there's no layout
 * shift when data arrives.
 *
 * Uses Tailwind's `animate-pulse` (CSS only — no JS timer, zero overhead).
 * `aria-busy` + `aria-label` give screen readers enough context without
 * announcing a fake table structure.
 */

type Variant = "assets" | "reconcile";

export function TableSkeleton({
  rows = 8,
  variant = "assets",
}: {
  rows?: number;
  variant?: Variant;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-gray-200"
      aria-label={variant === "reconcile" ? "Loading reconciliation data" : "Loading assets"}
      aria-busy="true"
    >
      <table className="min-w-full divide-y divide-gray-200" role="presentation">
        <thead className="bg-gray-50">
          <tr>
            {variant === "assets" ? (
              <>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset / Model</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Site</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Custodian</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Updated</th>
              </>
            ) : (
              <>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset tag</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Ops state</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Issues</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white animate-pulse">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {variant === "assets" ? (
                <>
                  {/* Asset / Model — two lines */}
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 rounded bg-gray-200 mb-1.5" />
                    <div className="h-3 w-32 rounded bg-gray-100" />
                  </td>
                  {/* State badge */}
                  <td className="px-4 py-3">
                    <div className="h-5 w-16 rounded-full bg-gray-200" />
                  </td>
                  {/* Site */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-4 w-24 rounded bg-gray-200" />
                  </td>
                  {/* Custodian */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </td>
                  {/* Updated */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-3 w-12 rounded bg-gray-100" />
                  </td>
                </>
              ) : (
                <>
                  {/* Asset tag — monospace-width pill */}
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 rounded bg-gray-200" />
                  </td>
                  {/* Model — two lines: manufacturer + model */}
                  <td className="px-4 py-3">
                    <div className="h-3 w-16 rounded bg-gray-100 mb-1.5" />
                    <div className="h-4 w-28 rounded bg-gray-200" />
                  </td>
                  {/* Ops state badge */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="h-5 w-16 rounded-full bg-gray-200" />
                  </td>
                  {/* Bucket pill */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="h-5 w-24 rounded-full bg-gray-200" />
                  </td>
                  {/* Issues — two short lines */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="h-3 w-40 rounded bg-gray-100 mb-1" />
                    <div className="h-3 w-28 rounded bg-gray-100" />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
