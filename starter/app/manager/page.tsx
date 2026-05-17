"use client";

/**
 * /manager — asset list dashboard.
 *
 * Layout:
 *   1. Summary cards — state filter shortcuts (no counts — avoids 6 extra fetches)
 *   2. State tabs — one-click filter by lifecycle state
 *   3. Filter bar — site dropdown + custodian text input + "Save as default" button
 *   4. Paginated table — Tag/Model · State · Site · Custodian · Last updated
 *
 * Filter preferences are persisted in localStorage so the manager's last-used
 * (or explicitly saved) view survives page reloads.
 *
 * Data strategy:
 *   - Asset list: one request with the active filters — server-filtered
 *     (API supports state / site / custodian query params)
 *   - "X assets" header count: derived from the list result, zero extra fetch
 *   - Pagination: client-side within the filtered result set (25 per page)
 *   - Unique sites for dropdown: derived from the current result set
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { btn, btnSize } from "@/styles/button";
import { labelSm, select as selectCls, input as inputCls } from "@/styles/form";
import { StatusBadge } from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatRelativeTime, formatAbsoluteDate } from "@/lib/format";
import { formatLocation } from "@/lib/scan-utils";
import type { Asset, AssetState } from "@/lib/types";

// ── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const PREFS_KEY = "manager-filter-prefs";

const STATE_OPTIONS: { value: AssetState | ""; label: string }[] = [
  { value: "", label: "All states" },
  { value: "received", label: "Received" },
  { value: "stored", label: "Stored" },
  { value: "in_service", label: "In service" },
  { value: "rma_pending", label: "RMA" },
  { value: "disposed", label: "Disposed" },
];

type Filters = {
  state: AssetState | "";
  site: string;
  custodian: string;
};

const DEFAULT_FILTERS: Filters = { state: "", site: "", custodian: "" };

// ── localStorage helpers ────────────────────────────────────────────────────

function loadSavedFilters(): Filters {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f: Filters): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(f));
  } catch {
    // localStorage blocked (private mode, storage full) — silently ignore
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ManagerPage() {
  // Start with default filters; overwrite from localStorage after mount
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [savedFilters, setSavedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Accumulate all seen sites across fetches so the site dropdown never
  // shrinks when a filter is active — avoids the "select All then re-select" trap
  const [knownSites, setKnownSites] = useState<string[]>([]);

  // ── Load saved preferences on mount ──────────────────────────────────────
  useEffect(() => {
    const saved = loadSavedFilters();
    setFilters(saved);
    setSavedFilters(saved);
    setPrefsLoaded(true);
  }, []);

  // ── Fetch filtered asset list ─────────────────────────────────────────────
  const fetchList = useCallback(async (f: Filters) => {
    setLoadingList(true);
    setListError(null);
    try {
      const result = await api.assets.list({
        state: f.state || undefined,
        site: f.site || undefined,
        custodian: f.custodian || undefined,
      });
      // Sort newest-updated first (API has no sort param)
      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setAssets(result);
      setPage(1);
      // Grow the known-sites set — never shrink it so the dropdown stays complete
      setKnownSites((prev) => {
        const merged = new Set([...prev, ...result.map((a) => a.location.site).filter(Boolean)]);
        return Array.from(merged).sort();
      });
    } catch {
      setListError("Could not load assets. Check your connection and try again.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Trigger list fetch whenever filters change (after prefs are loaded)
  useEffect(() => {
    if (!prefsLoaded) return;
    fetchList(filters);
  }, [filters, prefsLoaded, fetchList]);

  // ── Filter helpers ────────────────────────────────────────────────────────
  function applyFilter(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }


  // ── Save / reset preferences ──────────────────────────────────────────────
  const filtersMatchSaved =
    filters.state === savedFilters.state &&
    filters.site === savedFilters.site &&
    filters.custodian === savedFilters.custodian;

  function handleSavePrefs() {
    saveFilters(filters);
    setSavedFilters({ ...filters });
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(assets.length / PAGE_SIZE);
  const pageAssets = assets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Header subtitle ───────────────────────────────────────────────────────
  const isFiltered = !!(filters.state || filters.site || filters.custodian);
  const headerSubtitle = loadingList
    ? "Loading…"
    : isFiltered
      ? `${assets.length.toLocaleString()} asset${assets.length !== 1 ? "s" : ""} matching filters`
      : `${assets.length.toLocaleString()} asset${assets.length !== 1 ? "s" : ""} across all sites`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{headerSubtitle}</p>
        </div>
        <Link
          href="/manager/reconcile"
          className={cn(btn.secondary, btnSize.md)}
        >
          <svg className="h-4 w-4 text-gray-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
          Reconcile
        </Link>
      </div>

      {/* Summary cards — filter shortcuts, no counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="In service" color="green"
          onClick={() => applyFilter({ state: filters.state === "in_service" ? "" : "in_service" })}
          active={filters.state === "in_service"} />
        <SummaryCard label="Stored" color="amber"
          onClick={() => applyFilter({ state: filters.state === "stored" ? "" : "stored" })}
          active={filters.state === "stored"} />
        <SummaryCard label="Received" color="blue"
          onClick={() => applyFilter({ state: filters.state === "received" ? "" : "received" })}
          active={filters.state === "received"} />
        <SummaryCard label="Disposed" color="red"
          onClick={() => applyFilter({ state: filters.state === "disposed" ? "" : "disposed" })}
          active={filters.state === "disposed"} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* State */}
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="filter-state" className={labelSm}>State</label>
          <select
            id="filter-state"
            value={filters.state}
            onChange={(e) => applyFilter({ state: e.target.value as AssetState | "" })}
            className={selectCls}
          >
            {STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Site */}
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="filter-site" className={labelSm}>Site</label>
          <select
            id="filter-site"
            value={filters.site}
            onChange={(e) => applyFilter({ site: e.target.value })}
            className={selectCls}
          >
            <option value="">All sites</option>
            {knownSites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Custodian */}
        <div className="flex-1 min-w-[160px]">
          <label htmlFor="filter-custodian" className={labelSm}>Custodian</label>
          <input
            id="filter-custodian"
            type="text"
            value={filters.custodian}
            onChange={(e) => applyFilter({ custodian: e.target.value })}
            placeholder="e.g. tech-jane"
            className={cn(inputCls, "min-h-[36px]")}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className={cn(btn.ghost, btnSize.sm)}
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={handleSavePrefs}
            disabled={filtersMatchSaved}
            title={filtersMatchSaved ? "This is already your default view" : "Save current filters as your default view"}
            className={cn(btn.secondary, btnSize.sm)}
          >
            <svg className="h-3.5 w-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3v4H7V3M12 12v6m-3-3h6" />
            </svg>
            {filtersMatchSaved ? "Default saved" : "Save as default"}
          </button>
        </div>
      </div>

      {/* List error */}
      {listError && (
        <ErrorBanner title="Failed to load assets" detail={listError} action="Refresh the page or try again." onDismiss={() => setListError(null)} />
      )}

      {/* Table — outer live region covers empty, loading, and result states */}
      <div aria-live="polite" aria-atomic="false">
      {loadingList ? (
        <TableSkeleton rows={8} />
      ) : assets.length === 0 ? (
        <EmptyState filters={filters} onClear={handleResetFilters} />
      ) : (
        <>
          {/* Result count */}
          <p className="text-sm text-gray-500" aria-live="polite">
            Showing {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, assets.length).toLocaleString()} of{" "}
            <strong className="text-gray-700">{assets.length.toLocaleString()}</strong> assets
            {isFiltered ? " matching filters" : ""}
          </p>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Asset / Model</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">State</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Site</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Custodian</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pageAssets.map((asset) => (
                  <tr key={asset.asset_tag} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/manager/assets/${asset.asset_tag}`} className="group focus:outline-none">
                        <div className="font-mono text-sm font-semibold text-blue-700 group-hover:underline">
                          {asset.asset_tag}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                          {asset.manufacturer} · {asset.model}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge state={asset.state} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {asset.location.site || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {asset.custodian}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <time
                        dateTime={asset.updated_at}
                        title={formatAbsoluteDate(asset.updated_at)}
                        className="text-xs text-gray-400"
                      >
                        {formatRelativeTime(asset.updated_at)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination current={page} total={totalPages} onChange={setPage} />
          )}
        </>
      )}
      </div>{/* end aria-live region */}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/**
 * Filter shortcut card. Click to toggle a state filter — no count displayed,
 * which means zero extra API requests on mount.
 */
function SummaryCard({
  label, color, onClick, active,
}: {
  label: string;
  color: "green" | "amber" | "blue" | "red";
  onClick: () => void;
  active: boolean;
}) {
  const colors = {
    green: { bg: "bg-green-50", text: "text-green-700", activeBorder: "border-green-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-700", activeBorder: "border-amber-500" },
    blue:  { bg: "bg-blue-50",  text: "text-blue-700",  activeBorder: "border-blue-500"  },
    red:   { bg: "bg-red-50",   text: "text-red-700",   activeBorder: "border-red-500"   },
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border-2 px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        active
          ? `${colors.activeBorder} ${colors.bg}`
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className={`flex items-center gap-2 ${active ? colors.text : "text-gray-600"}`}>
        {/* Colour dot */}
        <span
          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
            color === "green" ? "bg-green-500" :
            color === "amber" ? "bg-amber-500" :
            color === "blue"  ? "bg-blue-500"  : "bg-red-500"
          }`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{label}</span>
        {active && (
          <span className="ml-auto text-xs font-normal opacity-70">✕ clear</span>
        )}
      </div>
    </button>
  );
}

function EmptyState({ filters, onClear }: { filters: Filters; onClear: () => void }) {
  const hasFilters = filters.state || filters.site || filters.custodian;
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
      <svg className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      <p className="mt-4 text-sm font-medium text-gray-900">
        {hasFilters ? "No assets match these filters" : "No assets found"}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try adjusting the state, site, or custodian filters."
          : "The asset database appears to be empty."}
      </p>
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className={cn(btn.secondary, btnSize.md, "mt-4")}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function Pagination({ current, total, onChange }: { current: number; total: number; onChange: (p: number) => void }) {
  return (
    <nav className="flex items-center justify-between" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className={cn(btn.secondary, btnSize.sm)}
      >
        <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Previous
      </button>

      <span className="text-sm text-gray-500">
        Page <strong className="text-gray-900">{current}</strong> of <strong className="text-gray-900">{total}</strong>
      </span>

      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className={cn(btn.secondary, btnSize.sm)}
      >
        Next
        <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </nav>
  );
}
