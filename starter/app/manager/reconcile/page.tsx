"use client";

/**
 * /manager/reconcile — three-way reconciliation report.
 *
 * Fetches /api/reconcile on mount (and on manual refresh).
 * Renders a summary card per bucket, then a filterable table of items.
 * Most-actionable buckets are shown first.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { btn, btnSize } from "@/styles/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Spinner } from "@/components/Spinner";
import { TableSkeleton } from "@/components/TableSkeleton";
import { formatRelativeTime, formatAbsoluteDate } from "@/lib/format";
import type { ReconcileBucket, ReconcileItem, ReconcileResult } from "@/app/api/reconcile/route";

// ── Bucket metadata ────────────────────────────────────────────────────────────

type BucketMeta = {
  bucket: ReconcileBucket | "all";
  label: string;
  icon: React.ReactNode;
  color: string;
  cardBg: string;
  cardBorder: string;
  description: string;
};

const BUCKET_META: BucketMeta[] = [
  {
    bucket: "ghost",
    label: "Orphaned records",
    icon: (
      <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    color: "text-gray-700",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-300",
    description: "In Facilities/Finance but not in Operations",
  },
  {
    bucket: "both_drift",
    label: "Both systems drifted",
    icon: (
      <svg className="h-3.5 w-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    color: "text-orange-700",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-300",
    description: "Location AND Finance both out of sync",
  },
  {
    bucket: "location_drift",
    label: "Location mismatch",
    icon: (
      <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    color: "text-amber-700",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-300",
    description: "Ops location ≠ Facilities rack location",
  },
  {
    bucket: "finance_drift",
    label: "Finance mismatch",
    icon: (
      <svg className="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
      </svg>
    ),
    color: "text-blue-700",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-200",
    description: "Finance status doesn't match asset state",
  },
  {
    bucket: "synced",
    label: "Reconciled",
    icon: (
      <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "text-green-700",
    cardBg: "bg-green-50",
    cardBorder: "border-green-200",
    description: "All systems agree",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryCard({
  meta,
  count,
  active,
  onClick,
}: {
  meta: BucketMeta;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${
        active
          ? `${meta.cardBg} ${meta.cardBorder} ring-2 ring-offset-1 ring-blue-400`
          : `bg-white border-gray-200 hover:${meta.cardBg} hover:${meta.cardBorder}`
      }`}
      aria-pressed={active}
      title={meta.description}
    >
      <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
        <span aria-hidden="true" className="flex-shrink-0">{meta.icon}</span>
        {meta.label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${meta.color}`}>{count}</p>
    </button>
  );
}

function IssueList({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="text-xs text-gray-600 space-y-0.5 list-none">
      {issues.map((issue, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="text-amber-500 flex-shrink-0" aria-hidden="true">•</span>
          {issue}
        </li>
      ))}
    </ul>
  );
}

function BucketPill({ bucket }: { bucket: ReconcileBucket }) {
  const meta = BUCKET_META.find((m) => m.bucket === bucket);
  if (!meta || bucket === "synced") return null;
  const colorMap: Record<string, string> = {
    ghost: "bg-gray-100 text-gray-700 ring-gray-300",
    both_drift: "bg-orange-50 text-orange-700 ring-orange-300",
    location_drift: "bg-amber-50 text-amber-700 ring-amber-300",
    finance_drift: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${colorMap[bucket] ?? "bg-gray-100 text-gray-600"}`}
    >
      <span aria-hidden="true" className="flex-shrink-0">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-3xl mb-2" aria-hidden="true">✅</p>
      <p className="text-sm font-medium text-gray-600">
        {filtered ? "No items in this bucket" : "Everything is in sync!"}
      </p>
      {!filtered && (
        <p className="text-xs text-gray-400 mt-1">
          All three systems agree on every asset.
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReconcilePage() {
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<ReconcileBucket | "all">("all");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reconcile");
      const json = await res.json() as ReconcileResult & { error?: { message: string } };
      if (!res.ok) {
        setError(json.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      setResult(json);
      setFetchedAt(new Date().toISOString());
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredItems: ReconcileItem[] = result
    ? activeBucket === "all"
      ? result.items
      : result.items.filter((i) => i.bucket === activeBucket)
    : [];

  const isFiltered = activeBucket !== "all";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-16">
      {/* ── Back link ── */}
      <Link
        href="/manager"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to asset list
      </Link>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reconciliation report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Three-way comparison: Operations × Facilities × Finance
          </p>
          {fetchedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Last fetched{" "}
              <time dateTime={fetchedAt} title={formatAbsoluteDate(fetchedAt)}>
                {formatRelativeTime(fetchedAt)}
              </time>
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className={cn(btn.secondary, btnSize.md, "disabled:opacity-50")}
        >
          {loading ? (
            <Spinner size="sm" label="Refreshing..." />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <ErrorBanner
          title="Failed to load reconciliation data"
          detail={error}
          action="Check that the API is running and try refreshing."
          onDismiss={() => setError(null)}
        />
      )}

      {/* ── Loading skeleton ── */}
      {loading && !result && (
        <TableSkeleton variant="reconcile" rows={6} />
      )}

      {/* ── Summary cards ── */}
      {result && (
        <>
          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" className="sr-only">Reconciliation summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {BUCKET_META.map((meta) => (
                <SummaryCard
                  key={meta.bucket}
                  meta={meta}
                  count={result.summary[meta.bucket as ReconcileBucket]}
                  active={activeBucket === meta.bucket}
                  onClick={() =>
                    setActiveBucket(
                      activeBucket === meta.bucket ? "all" : meta.bucket as ReconcileBucket,
                    )
                  }
                />
              ))}
            </div>
            {isFiltered && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Showing {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} in{" "}
                  <strong>{BUCKET_META.find((m) => m.bucket === activeBucket)?.label}</strong>
                </p>
                <button
                  onClick={() => setActiveBucket("all")}
                  className={cn(btn.ghost, "text-xs text-blue-600 hover:text-blue-800")}
                >
                  Clear filter
                </button>
              </div>
            )}
          </section>

          {/* ── Items table ── */}
          <section aria-labelledby="items-heading">
            <h2 id="items-heading" className="sr-only">Reconciliation items</h2>

            {filteredItems.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white">
                <EmptyState filtered={isFiltered} />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Asset tag
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Model
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Ops state
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Issues
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredItems.map((item) => (
                        <tr
                          key={item.asset_tag}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Tag */}
                          <td className="px-4 py-3">
                            {item.asset ? (
                              <Link
                                href={`/manager/assets/${item.asset_tag}`}
                                className="font-mono text-blue-600 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                              >
                                {item.asset_tag}
                              </Link>
                            ) : (
                              <span className="font-mono text-gray-500">{item.asset_tag}</span>
                            )}
                          </td>

                          {/* Model */}
                          <td className="px-4 py-3 text-gray-700">
                            {item.asset ? (
                              <span>
                                <span className="text-gray-400 text-xs">{item.asset.manufacturer} </span>
                                {item.asset.model}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-xs">Not in Operations</span>
                            )}
                          </td>

                          {/* State */}
                          <td className="px-4 py-3">
                            {item.asset ? (
                              <StatusBadge state={item.asset.state} size="sm" />
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                          {/* Bucket pill */}
                          <td className="px-4 py-3">
                            {item.bucket === "synced" ? (
                              <span className="text-green-600 text-xs font-medium">✅ In sync</span>
                            ) : (
                              <BucketPill bucket={item.bucket} />
                            )}
                          </td>

                          {/* Issues */}
                          <td className="px-4 py-3 max-w-sm">
                            <IssueList issues={item.issues} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.asset_tag}
                      className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          {item.asset ? (
                            <Link
                              href={`/manager/assets/${item.asset_tag}`}
                              className="font-mono text-sm text-blue-600 hover:underline"
                            >
                              {item.asset_tag}
                            </Link>
                          ) : (
                            <span className="font-mono text-sm text-gray-500">{item.asset_tag}</span>
                          )}
                          {item.asset && (
                            <p className="text-xs text-gray-500 mt-0.5">{item.asset.manufacturer} {item.asset.model}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.asset && <StatusBadge state={item.asset.state} size="sm" />}
                          {item.bucket === "synced" ? (
                            <span className="text-green-600 text-xs">✅ In sync</span>
                          ) : (
                            <BucketPill bucket={item.bucket} />
                          )}
                        </div>
                      </div>
                      <IssueList issues={item.issues} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
