"use client";

/**
 * /tech/deploy — rack an asset into service.
 *
 * Flow:
 *   Step 1 → Scan asset tag → fetch current state
 *   Step 2 → Scan deploy location (must include site + room + rack + ru)
 *            → POST to /api/scans/deploy (server route that also writes
 *              back to Facilities and Finance)
 *
 * Key decisions:
 *   - Location MUST be complete (all 4 fields). We validate client-side
 *     before submitting and show exactly which field is missing.
 *   - The server route handles write-backs — finance + facilities — so the
 *     token never hits the browser, and write-backs are tied to the scan.
 *   - We show the asset's current state before confirming so the tech can
 *     catch "wrong asset" before committing.
 *   - If write-backs fail server-side, the scan still succeeds — we surface
 *     the warning in the UI but don't block the tech.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { labelSm, input as inputCls } from "@/styles/form";
import { api, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/error-messages";
import { isAssetTag, parseLocationBarcode, detectScanMistake, formatLocation, getMissingDeployField } from "@/lib/scan-utils";
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
  | { name: "done"; asset: Asset; writeBackErrors?: string[] };

type PageError = { title: string; detail: string; action: string };

// ── Component ──────────────────────────────────────────────────────────────

export default function TechDeployPage() {
  const { userId } = useCurrentUser();

  const [step, setStep] = useState<Step>({ name: "scan_asset" });
  const [error, setError] = useState<PageError | null>(null);
  const [fetching, setFetching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualLoc, setManualLoc] = useState({ site: "", room: "", row: "", rack: "", ru: "" });

  // ── Step 1: Scan asset ──────────────────────────────────────────────────

  const handleAssetScan = useCallback(async (raw: string) => {
    const value = raw.trim();

    if (!isAssetTag(value)) {
      setError({
        title: "Not an asset tag",
        detail: `"${value}" doesn't look like an asset tag.`,
        action: "Scan the asset barcode (C followed by 7 digits).",
      });
      return;
    }

    setError(null);
    setFetching(true);

    try {
      const asset = await api.assets.get(value);

      if (asset.state === "disposed") {
        setError({
          title: "Asset is disposed",
          detail: "Disposed assets cannot be deployed.",
          action: "Contact your manager.",
        });
        return;
      }
      if (asset.state === "rma_pending") {
        setError({
          title: "Asset is pending RMA",
          detail: "This asset is awaiting return to the manufacturer.",
          action: "Contact your manager before deploying it.",
        });
        return;
      }
      if (asset.state === "in_service") {
        setError({
          title: "Already deployed",
          detail: `This asset is already in service at ${formatLocation(asset.location)}.`,
          action: "Use Transfer to change custodian, or Store to de-rack it first.",
        });
        return;
      }

      setStep({ name: "scan_location", asset });
    } catch (err) {
      if (err instanceof ApiError && err.code === "unknown_asset") {
        setError({
          title: "Asset not found",
          detail: `No asset with tag "${value}" found.`,
          action: "Use the Receive workflow if this is a new asset.",
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
    if (step.name !== "scan_location") return;
    const value = raw.trim();

    const mistake = detectScanMistake(value, "location");
    if (mistake?.kind === "asset_tag_in_location_field") {
      setError({
        title: "That looks like an asset tag",
        detail: "You scanned an asset tag into the location field.",
        action: "Scan a location barcode instead.",
      });
      return;
    }

    const loc = parseLocationBarcode(value);
    if (!loc) {
      setError({
        title: "Unrecognised location",
        detail: `"${value}" isn't a valid location barcode.`,
        action: "Scan the rack location label, or enter the location manually.",
      });
      return;
    }

    const missing = getMissingDeployField(loc);
    if (missing) {
      setError({
        title: "Incomplete location",
        detail: `To deploy, you need the building, room, rack, and rack unit. Missing: ${missing.replace(/_/g, " ")}.`,
        action: "Re-scan the location barcode or enter the missing field manually.",
      });
      return;
    }

    setError(null);
    commitDeploy(step.asset, loc);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commit ──────────────────────────────────────────────────────────────

  async function commitDeploy(asset: Asset, location: Location) {
    setStep({ name: "submitting", asset, location });
    setError(null);

    try {
      const res = await fetch("/api/scans/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_tag: asset.asset_tag,
          location,
          user_id: userId,
          scan_payload: asset.asset_tag,
        }),
      });

      const data = await res.json() as {
        asset?: Asset;
        writeBackErrors?: string[];
        error?: { code: string; message: string; details?: Record<string, unknown> };
      };

      if (!res.ok || data.error) {
        throw new ApiError(
          res.status,
          data.error?.code ?? "internal_error",
          data.error?.message ?? "Deploy failed.",
          data.error?.details,
        );
      }

      setStep({
        name: "done",
        asset: data.asset!,
        writeBackErrors: data.writeBackErrors,
      });
    } catch (err) {
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

  // ── Manual location submit ──────────────────────────────────────────────

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.name !== "scan_location") return;

    const loc: Location = {
      site: manualLoc.site.trim(),
      room: manualLoc.room.trim() || null,
      row: manualLoc.row.trim() || null,
      rack: manualLoc.rack.trim() || null,
      ru: manualLoc.ru.trim() || null,
    };

    const missing = getMissingDeployField(loc);
    if (missing) {
      setError({
        title: "Incomplete location",
        detail: `The "${missing.replace(/_/g, " ")}" field is required to deploy to a rack.`,
        action: "Fill in all location fields — building, room, rack, and rack unit.",
      });
      return;
    }

    setError(null);
    commitDeploy(step.asset, loc);
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  function reset() {
    setStep({ name: "scan_asset" });
    setError(null);
    setManualLoc({ site: "", room: "", row: "", rack: "", ru: "" });
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
          <h1 className="text-xl font-semibold text-gray-900">Deploy asset</h1>
          <p className="text-sm text-gray-500">Scan the asset, then scan the full rack location.</p>
        </div>
      </div>

      {/* Step indicator */}
      <DeployStepIndicator current={
        step.name === "scan_asset" ? 0
        : step.name === "scan_location" ? 1
        : step.name === "submitting" ? 1
        : 2
      } />

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
            />
          )}
        </section>
      )}

      {/* ── Step 2: Scan location ── */}
      {(step.name === "scan_location" || step.name === "submitting") && (
        <section aria-label="Scan deploy location" className="space-y-4">
          {/* Asset card */}
          <AssetSummaryCard asset={step.asset} onRescan={reset} />

          {/* Location requirement callout */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
            <span className="font-semibold">Deploy requires a full location:</span> site · room · rack · rack unit (RU)
          </div>

          {isSubmitting ? (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
              <Spinner label="Deploying asset…" />
              <span className="text-sm" aria-hidden="true">Deploying asset…</span>
            </div>
          ) : (
            <>
              <CameraScanner
                onScan={handleLocationScan}
                inputPlaceholder="Scan the rack location label or type the location…"
                inputLabel="Deploy location"
              />

              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="text-sm text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded min-h-[44px]"
              >
                {showManual ? "Hide manual entry" : "Enter location manually instead"}
              </button>

              {showManual && (
                <form onSubmit={handleManualSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4">
                  {(["site", "room", "row", "rack", "ru"] as const).map((field) => (
                    <div key={field}>
                      <label htmlFor={`deploy-${field}`} className={`${labelSm} capitalize`}>
                        {field === "ru" ? "Rack unit (RU)" : field.charAt(0).toUpperCase() + field.slice(1)}
                        {["site", "room", "rack", "ru"].includes(field) && (
                          <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>
                        )}
                      </label>
                      <input
                        id={`deploy-${field}`}
                        type="text"
                        value={manualLoc[field]}
                        onChange={(e) => setManualLoc((p) => ({ ...p, [field]: e.target.value }))}
                        required={["site", "room", "rack", "ru"].includes(field)}
                        placeholder={
                          field === "site" ? "e.g. Lab-Building-A"
                          : field === "room" ? "e.g. LAB-B"
                          : field === "row" ? "e.g. ROW-2"
                          : field === "rack" ? "e.g. RACK-4"
                          : "e.g. 12"
                        }
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={!manualLoc.site || !manualLoc.room || !manualLoc.rack || !manualLoc.ru}
                    className="w-full rounded-lg bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 min-h-[44px]"
                  >
                    Deploy to this rack
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Done ── */}
      {step.name === "done" && (
        <section aria-label="Deploy complete" className="space-y-4">
          <SuccessBanner
            title="Asset deployed"
            detail={`${step.asset.asset_tag} is now in service at ${formatLocation(step.asset.location)}.`}
          />

          {/* Write-back warning (non-blocking) */}
          {step.writeBackErrors && step.writeBackErrors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3" role="note">
              <p className="text-sm font-medium text-amber-800">Deploy recorded — heads up for your manager</p>
              <p className="text-xs text-amber-700 mt-1">
                The asset is now in service, but a background update didn't complete. Your manager will see this in the reconciliation report.
              </p>
            </div>
          )}

          <AssetSummaryCard asset={step.asset} />
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border-2 border-green-600 bg-white py-3 text-sm font-semibold text-green-700 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
          >
            Deploy another asset
          </button>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DeployStepIndicator({ current }: { current: number }) {
  const steps = ["Scan asset", "Scan location", "Deployed"];
  return (
    <nav aria-label="Workflow steps">
      <ol className="flex items-center">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border-2 transition-colors ${
                    done ? "border-green-600 bg-green-600 text-white"
                    : active ? "border-green-600 bg-white text-green-700"
                    : "border-gray-200 bg-white text-gray-400"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : i + 1}
                </span>
                <span className={`mt-1 text-xs ${active ? "font-medium text-gray-900" : "text-gray-400"}`}>{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${done ? "bg-green-600" : "bg-gray-200"}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function AssetSummaryCard({ asset, onRescan }: { asset: Asset; onRescan?: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
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
      <p className="text-xs text-gray-500">
        <span className="font-medium">Location:</span> {formatLocation(asset.location)}
      </p>
      <p className="text-xs text-gray-500">
        <span className="font-medium">Custodian:</span> {asset.custodian}
      </p>
    </div>
  );
}
