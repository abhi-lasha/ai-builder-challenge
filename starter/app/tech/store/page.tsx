"use client";

/**
 * /tech/store — move an asset into storage.
 *
 * Flow:
 *   Step 1 → Scan asset tag → fetch current asset state (show it so tech can verify)
 *   Step 2 → Scan storage location → confirm + commit
 *
 * Key decisions:
 *   - We show the asset's CURRENT state between steps. If an asset is in_service,
 *     we warn the tech they're de-racking it (facilities write-back happens on
 *     deploy page — store from in_service intentionally removes it from facilities).
 *   - Location for store does NOT require rack/ru — just site is enough.
 *   - On error we keep both scanned values so tech doesn't re-scan everything.
 *   - Scan mistake detection: alert if they scan an asset tag into the location field.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { labelSm, input as inputCls } from "@/styles/form";
import { api, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/error-messages";
import { isAssetTag, parseLocationBarcode, detectScanMistake, formatLocation } from "@/lib/scan-utils";
import { useCurrentUser } from "@/lib/use-current-user";
import { CameraScanner } from "@/components/CameraScanner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import type { Asset, Location } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Step =
  | { name: "scan_asset" }
  | { name: "scan_location"; asset: Asset }
  | { name: "submitting"; asset: Asset; location: Location }
  | { name: "done"; asset: Asset };

type PageError = { title: string; detail: string; action: string };

// ── Helpers ────────────────────────────────────────────────────────────────

/** States that cannot be stored — give a clear message for each. */
function getTransitionBlock(state: string): PageError | null {
  if (state === "disposed") {
    return {
      title: "Asset is disposed",
      detail: "Disposed assets cannot be stored.",
      action: "If this is a mistake, contact your manager.",
    };
  }
  if (state === "rma_pending") {
    return {
      title: "Asset is pending RMA",
      detail: "This asset is awaiting return to the manufacturer.",
      action: "Contact your manager before moving it.",
    };
  }
  if (state === "stored") {
    // We allow re-store to a different location — return null to let it through
    return null;
  }
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TechStorePage() {
  const { userId } = useCurrentUser();

  const [step, setStep] = useState<Step>({ name: "scan_asset" });
  const [error, setError] = useState<PageError | null>(null);
  const [fetching, setFetching] = useState(false);

  // ── Step 1: Scan asset tag ──────────────────────────────────────────────

  const handleAssetScan = useCallback(async (raw: string) => {
    const value = raw.trim();

    if (!isAssetTag(value)) {
      setError({
        title: "Not an asset tag",
        detail: `"${value}" doesn't look like an asset tag. Tags start with C followed by 7 digits.`,
        action: "Check you're scanning the asset barcode.",
      });
      return;
    }

    setError(null);
    setFetching(true);

    try {
      const asset = await api.assets.get(value);

      // Check if this state can be stored
      const block = getTransitionBlock(asset.state);
      if (block) {
        // Special case: "stored" — allow re-store to a different location
        if (asset.state !== "stored") {
          setError(block);
          setFetching(false);
          return;
        }
      }

      setStep({ name: "scan_location", asset });
    } catch (err) {
      if (err instanceof ApiError && err.code === "unknown_asset") {
        setError({
          title: "Asset not found",
          detail: `No asset with tag "${value}" is in the system.`,
          action: "Use the Receive workflow if this is a new arrival.",
        });
      } else {
        setError({
          title: "Connection problem",
          detail: "We couldn't reach the server.",
          action: "Check your connection and try again.",
        });
      }
    } finally {
      setFetching(false);
    }
  }, []);

  // ── Step 2: Scan location ───────────────────────────────────────────────

  const handleLocationScan = useCallback((raw: string) => {
    const value = raw.trim();

    // Detect mistake: asset tag scanned into location field
    const mistake = detectScanMistake(value, "location");
    if (mistake?.kind === "asset_tag_in_location_field") {
      setError({
        title: "That looks like an asset tag",
        detail: "You scanned an asset tag into the location field.",
        action: "Scan a location barcode instead — it's the label on the shelf or rack.",
      });
      return;
    }

    const loc = parseLocationBarcode(value);
    if (!loc || !loc.site) {
      setError({
        title: "Unrecognised location",
        detail: `"${value}" isn't a valid location barcode.`,
        action: "Scan the location label on the shelf or rack, or enter the location manually.",
      });
      return;
    }

    if (step.name !== "scan_location") return;
    setError(null);
    commitStore(step.asset, loc);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commit ──────────────────────────────────────────────────────────────

  async function commitStore(asset: Asset, location: Location) {
    setStep({ name: "submitting", asset, location });
    setError(null);

    try {
      // Use server-side route so write-back logic (de-rack from Facilities when
      // storing from in_service) stays server-side with the API token.
      const res = await fetch("/api/scans/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_tag: asset.asset_tag,
          location,
          user_id: userId,
          scan_payload: asset.asset_tag,
          from_state: asset.state, // tells the route whether to de-rack
        }),
      });

      const data = await res.json() as { asset?: Asset; error?: { code: string; message: string; details?: Record<string, unknown> } };

      if (!res.ok || data.error) {
        throw new ApiError(
          res.status,
          data.error?.code ?? "internal_error",
          data.error?.message ?? "Store failed.",
          data.error?.details,
        );
      }

      setStep({ name: "done", asset: data.asset! });
    } catch (err) {
      // Restore to scan_location so the tech can retry without re-scanning the asset
      setStep({ name: "scan_location", asset });

      if (err instanceof ApiError) {
        const msg = getApiErrorMessage(err.code, { currentState: asset.state });
        setError(msg);
      } else {
        setError({
          title: "Connection problem",
          detail: "We couldn't reach the server. Your scan was not saved.",
          action: "Check your connection and try again.",
        });
      }
    }
  }

  // ── Manual location form ────────────────────────────────────────────────

  const [manualLoc, setManualLoc] = useState({ site: "", room: "", rack: "" });
  const [showManual, setShowManual] = useState(false);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.name !== "scan_location") return;
    if (!manualLoc.site.trim()) return;

    commitStore(step.asset, {
      site: manualLoc.site.trim(),
      room: manualLoc.room.trim() || null,
      row: null,
      rack: manualLoc.rack.trim() || null,
      ru: null,
    });
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  function reset() {
    setStep({ name: "scan_asset" });
    setError(null);
    setManualLoc({ site: "", room: "", rack: "" });
    setShowManual(false);
  }

  const isSubmitting = step.name === "submitting";

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/tech"
          className="rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Back to scan workflows"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Store asset</h1>
          <p className="text-sm text-gray-500">Scan the asset, then scan the storage location.</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator
        steps={["Scan asset", "Scan location", "Done"]}
        current={
          step.name === "scan_asset" ? 0
          : step.name === "scan_location" ? 1
          : step.name === "submitting" ? 1
          : 2
        }
      />

      {/* Error */}
      {error && (
        <ErrorBanner
          title={error.title}
          detail={error.detail}
          action={error.action}
          onDismiss={() => setError(null)}
        />
      )}

      {/* ── Step 1: Scan asset ── */}
      {step.name === "scan_asset" && (
        <section aria-label="Scan asset tag">
          {fetching ? (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
              <Spinner label="Looking up asset…" />
              <span className="text-sm" aria-hidden="true">Looking up asset…</span>
            </div>
          ) : (
            <CameraScanner
              onScan={handleAssetScan}
              inputPlaceholder="Scan asset tag (e.g. C0001234)…"
              inputLabel="Asset tag"
              disabled={fetching}
            />
          )}
        </section>
      )}

      {/* ── Step 2: Scan location ── */}
      {(step.name === "scan_location" || step.name === "submitting") && (
        <section aria-label="Scan storage location" className="space-y-4">
          {/* Asset summary card — shows what was scanned + current state */}
          <AssetCard asset={step.asset} onRescan={reset} />

          {/* De-rack warning */}
          {step.asset.state === "in_service" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4" role="note">
              <p className="text-sm font-medium text-amber-800">
                ⚠️ This asset is currently deployed. Storing it will remove it from its rack.
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Location: {formatLocation(step.asset.location)}
              </p>
            </div>
          )}

          {isSubmitting ? (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
              <Spinner label="Storing asset…" />
              <span className="text-sm" aria-hidden="true">Storing asset…</span>
            </div>
          ) : (
            <>
              <CameraScanner
                onScan={handleLocationScan}
                inputPlaceholder="Scan the location label or type the location…"
                inputLabel="Storage location"
                disabled={isSubmitting}
              />

              {/* Manual location fallback */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded min-h-[44px]"
                >
                  {showManual ? "Hide manual entry" : "Enter location manually instead"}
                </button>

                {showManual && (
                  <form onSubmit={handleManualSubmit} className="mt-3 space-y-3 rounded-lg border border-gray-200 p-4">
                    <div>
                      <label htmlFor="manual-site" className={labelSm}>
                        Site <span className="text-red-500" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="manual-site"
                        type="text"
                        value={manualLoc.site}
                        onChange={(e) => setManualLoc((p) => ({ ...p, site: e.target.value }))}
                        required
                        placeholder="e.g. Lab-Building-A"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-room" className={labelSm}>Room</label>
                      <input
                        id="manual-room"
                        type="text"
                        value={manualLoc.room}
                        onChange={(e) => setManualLoc((p) => ({ ...p, room: e.target.value }))}
                        placeholder="e.g. Storage-B"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-rack" className={labelSm}>Rack / Bay</label>
                      <input
                        id="manual-rack"
                        type="text"
                        value={manualLoc.rack}
                        onChange={(e) => setManualLoc((p) => ({ ...p, rack: e.target.value }))}
                        placeholder="e.g. SHELF-3"
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!manualLoc.site.trim()}
                      className="w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 min-h-[44px]"
                    >
                      Store here
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Done ── */}
      {step.name === "done" && (
        <section aria-label="Store complete" className="space-y-4">
          <SuccessBanner
            title="Asset stored"
            detail={`${step.asset.asset_tag} is now in storage at ${formatLocation(step.asset.location)}.`}
          />
          <AssetCard asset={step.asset} />
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border-2 border-amber-600 bg-white py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
          >
            Store another asset
          </button>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** Step progress indicator */
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Workflow steps">
      <ol className="flex items-center gap-0">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors ${
                    done
                      ? "border-amber-600 bg-amber-600 text-white"
                      : active
                      ? "border-amber-600 bg-white text-amber-700"
                      : "border-gray-200 bg-white text-gray-400"
                  }`}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${done ? "Completed: " : active ? "Current: " : ""}Step ${i + 1}, ${label}`}
                >
                  {done ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`mt-1 text-xs ${active ? "font-medium text-gray-900" : "text-gray-400"}`}>
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${done ? "bg-amber-600" : "bg-gray-200"}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Shows the looked-up asset's key fields between scan steps. */
function AssetCard({ asset, onRescan }: { asset: Asset; onRescan?: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-gray-900">{asset.asset_tag}</p>
          <p className="text-sm text-gray-600">{asset.manufacturer} · {asset.model}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge state={asset.state} size="sm" />
          {onRescan && (
            <button
              type="button"
              onClick={onRescan}
              className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 min-h-[44px]"
            >
              Re-scan
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        <span className="font-medium">Current location:</span> {formatLocation(asset.location)}
      </div>
      <div className="text-xs text-gray-500">
        <span className="font-medium">Custodian:</span> {asset.custodian}
      </div>
    </div>
  );
}
