/**
 * /manager/assets/[tag] — read-only asset detail for managers.
 *
 * Server component: fetches asset + full event history in parallel.
 * Layout: asset info grid (top) → newest-first event log (bottom).
 *
 * Error handling:
 *   - 404 from upstream  → notFound() → Next.js default 404 page
 *   - Other API errors   → inline error card with tag + message
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { formatRelativeTime, formatAbsoluteDate } from "@/lib/format";
import { formatLocation } from "@/lib/scan-utils";
import { formatState, formatEventType } from "@/lib/error-messages";
import { StatusBadge } from "@/components/StatusBadge";
import type { Asset, AssetClass, Event, EventType } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAssetClass(cls: AssetClass): string {
  const map: Record<AssetClass, string> = {
    instrument: "Instrument",
    compute: "Compute",
    network: "Network",
    power: "Power",
    consumable_durable: "Consumable / Durable",
  };
  return map[cls] ?? cls;
}

const EVENT_PILL_COLORS: Record<EventType, string> = {
  receive: "bg-blue-50 text-blue-700 ring-blue-200",
  store: "bg-amber-50 text-amber-700 ring-amber-200",
  deploy: "bg-green-50 text-green-700 ring-green-200",
  transfer_custody: "bg-purple-50 text-purple-700 ring-purple-200",
  rma_open: "bg-orange-50 text-orange-700 ring-orange-200",
  rma_receive_back: "bg-teal-50 text-teal-700 ring-teal-200",
  dispose: "bg-red-50 text-red-700 ring-red-200",
  duplicate_receive: "bg-gray-100 text-gray-600 ring-gray-200",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:gap-4">
      <dt className="w-40 flex-shrink-0 text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 break-words min-w-0">{children}</dd>
    </div>
  );
}

function EventTypePill({ type }: { type: EventType }) {
  const color = EVENT_PILL_COLORS[type] ?? "bg-gray-100 text-gray-600 ring-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${color}`}
    >
      {formatEventType(type)}
    </span>
  );
}

function StatePill({ state }: { state: string }) {
  return <StatusBadge state={state as Asset["state"]} size="sm" />;
}

function EmptyEvents() {
  return (
    <div className="text-center py-12 text-gray-500">
      <svg
        className="mx-auto h-8 w-8 text-gray-300 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <p className="text-sm">No events recorded yet.</p>
    </div>
  );
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return { title: tag };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ManagerAssetDetailPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<React.ReactElement> {
  const { tag } = await params;

  // Fetch in parallel; 404 becomes Next.js not-found, other errors bubble up.
  let asset: Asset;
  let events: Event[];

  try {
    [asset, events] = await Promise.all([
      api.assets.get(tag),
      api.assets.history(tag),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    // Surface any other error inline so managers see what went wrong.
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="space-y-4">
        <BackLink />
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-800">
            Could not load asset {tag}
          </p>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
      </div>
    );
  }

  // Newest-first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const currentLocation = formatLocation(asset.location);

  return (
    <div className="space-y-6 pb-16">
      {/* ── Back ── */}
      <BackLink />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold font-mono text-gray-900 tracking-tight">
              {asset.asset_tag}
            </h1>
            <StatusBadge state={asset.state} size="md" />
          </div>
          <p className="text-sm text-gray-500">
            Last updated{" "}
            <time
              dateTime={asset.updated_at}
              title={formatAbsoluteDate(asset.updated_at)}
            >
              {formatRelativeTime(asset.updated_at)}
            </time>
          </p>
        </div>
      </div>

      {/* ── Asset info ── */}
      <section aria-labelledby="info-heading">
        <h2
          id="info-heading"
          className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1"
        >
          Asset information
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white px-4 divide-y divide-gray-100">
          <dl>
            <InfoRow label="Asset tag">
              <span className="font-mono">{asset.asset_tag}</span>
            </InfoRow>
            <InfoRow label="Serial number">
              <span className="font-mono">{asset.serial}</span>
            </InfoRow>
            <InfoRow label="Manufacturer">{asset.manufacturer}</InfoRow>
            <InfoRow label="Model">{asset.model}</InfoRow>
            <InfoRow label="Asset class">
              {formatAssetClass(asset.asset_class)}
            </InfoRow>
            <InfoRow label="State">
              <span>{formatState(asset.state)}</span>
            </InfoRow>
            <InfoRow label="Custodian">
              <span className="font-mono">{asset.custodian}</span>
            </InfoRow>
            <InfoRow label="Location">
              {currentLocation || (
                <span className="text-gray-400 italic">No location set</span>
              )}
            </InfoRow>
            {asset.parent_asset_tag && (
              <InfoRow label="Parent asset">
                <Link
                  href={`/manager/assets/${asset.parent_asset_tag}`}
                  className="font-mono text-blue-600 hover:underline"
                >
                  {asset.parent_asset_tag}
                </Link>
              </InfoRow>
            )}
            {asset.procurement_note && (
              <InfoRow label="Procurement note">{asset.procurement_note}</InfoRow>
            )}
            <InfoRow label="Received">
              <time
                dateTime={asset.created_at}
                title={formatAbsoluteDate(asset.created_at)}
              >
                {formatAbsoluteDate(asset.created_at)}
              </time>
            </InfoRow>
          </dl>
        </div>
      </section>

      {/* ── Event history ── */}
      <section aria-labelledby="events-heading">
        <h2
          id="events-heading"
          className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1"
        >
          Event history
          <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
            {events.length}
          </span>
        </h2>

        {sortedEvents.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white">
            <EmptyEvents />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36"
                    >
                      Time
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      Event
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      State change
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      Performed by
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                      {/* Time */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        <time
                          dateTime={ev.timestamp}
                          title={formatAbsoluteDate(ev.timestamp)}
                        >
                          {formatRelativeTime(ev.timestamp)}
                        </time>
                      </td>

                      {/* Event type */}
                      <td className="px-4 py-3">
                        <EventTypePill type={ev.event_type} />
                      </td>

                      {/* State change */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ev.from_state ? (
                            <>
                              <StatePill state={ev.from_state} />
                              <span className="text-gray-400" aria-hidden="true">
                                →
                              </span>
                            </>
                          ) : null}
                          <StatePill state={ev.to_state} />
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {ev.to_location
                          ? formatLocation(ev.to_location)
                          : <span className="text-gray-400">—</span>}
                      </td>

                      {/* User */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {ev.user_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {sortedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <EventTypePill type={ev.event_type} />
                    <time
                      dateTime={ev.timestamp}
                      title={formatAbsoluteDate(ev.timestamp)}
                      className="text-xs text-gray-500"
                    >
                      {formatRelativeTime(ev.timestamp)}
                    </time>
                  </div>

                  {/* State transition */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {ev.from_state ? (
                      <>
                        <StatePill state={ev.from_state} />
                        <span className="text-gray-400 text-xs" aria-hidden="true">
                          →
                        </span>
                      </>
                    ) : null}
                    <StatePill state={ev.to_state} />
                  </div>

                  {/* Location */}
                  {ev.to_location && (
                    <p className="text-xs text-gray-600">
                      <span className="text-gray-400">Location: </span>
                      {formatLocation(ev.to_location)}
                    </p>
                  )}

                  {/* Performed by */}
                  <p className="text-xs text-gray-500">
                    By{" "}
                    <span className="font-mono text-gray-700">{ev.user_id}</span>
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ── BackLink ──────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/manager"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to asset list
    </Link>
  );
}
