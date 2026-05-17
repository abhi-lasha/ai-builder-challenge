"use client";

/**
 * /tech/transfer — custody handoff between two people.
 *
 * Flow:
 *   Step 1 → Scan asset tag → fetch current state + custodian
 *   Step 2 → Scan recipient's badge → commit transfer
 *
 * Key decisions:
 *   - The logged-in user is automatically the FROM custodian. Only the
 *     receiving badge needs an explicit scan.
 *   - State does NOT change — only the custodian field changes.
 *   - We detect if the tech accidentally scans an asset tag or location
 *     barcode into the badge field and give a specific error.
 *   - If the recipient badge equals the current custodian, we catch
 *     same_custodian before the API call when possible.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/error-messages";
import { formatLocation } from "@/lib/scan-utils";
import { isAssetTag, detectScanMistake } from "@/lib/scan-utils";
import { useCurrentUser } from "@/lib/use-current-user";
import { CameraScanner } from "@/components/CameraScanner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { Spinner } from "@/components/Spinner";
import { StatusBadge } from "@/components/StatusBadge";
import type { Asset } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Step =
  | { name: "scan_asset" }
  | { name: "scan_badge"; asset: Asset }
  | { name: "submitting"; asset: Asset; badge: string }
  | { name: "done"; asset: Asset; fromCustodian: string; toCustodian: string };

type PageError = { title: string; detail: string; action: string };

// ── Component ──────────────────────────────────────────────────────────────

export default function TechTransferPage() {
  const { userId } = useCurrentUser();

  const [step, setStep] = useState<Step>({ name: "scan_asset" });
  const [error, setError] = useState<PageError | null>(null);
  const [fetching, setFetching] = useState(false);
  const [manualBadge, setManualBadge] = useState("");

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
          detail: "Disposed assets cannot be transferred.",
          action: "Contact your manager.",
        });
        return;
      }
      if (asset.state === "unreceived") {
        setError({
          title: "Asset not yet received",
          detail: "This asset hasn't been received into the system yet.",
          action: "Use the Receive workflow first.",
        });
        return;
      }
      if (asset.state === "rma_pending") {
        setError({
          title: "Asset is pending RMA",
          detail: "Assets pending RMA cannot be transferred.",
          action: "Contact your manager.",
        });
        return;
      }

      setStep({ name: "scan_badge", asset });
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

  // ── Step 2: Scan badge ──────────────────────────────────────────────────

  const handleBadgeScan = useCallback((raw: string) => {
    if (step.name !== "scan_badge") return;
    const value = raw.trim();

    // Detect scan mistakes
    const mistake = detectScanMistake(value, "badge");
    if (mistake?.kind === "asset_tag_in_badge_field") {
      setError({
        title: "That's an asset tag, not a badge",
        detail: "You scanned an asset barcode into the badge field.",
        action: "Scan the recipient's badge instead.",
      });
      return;
    }
    if (mistake?.kind === "location_in_badge_field") {
      setError({
        title: "That's a location barcode, not a badge",
        detail: "You scanned a location barcode into the badge field.",
        action: "Scan the recipient's badge instead.",
      });
      return;
    }

    // Client-side same-custodian check
    if (value === step.asset.custodian) {
      setError({
        title: "Already the custodian",
        detail: `${value} is already the custodian of this asset.`,
        action: "Scan a different badge.",
      });
      return;
    }

    setError(null);
    commitTransfer(step.asset, value);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commit ──────────────────────────────────────────────────────────────

  async function commitTransfer(asset: Asset, badge: string) {
    setStep({ name: "submitting", asset, badge });
    setError(null);

    try {
      const updated = await api.scans.transfer({
        asset_tag: asset.asset_tag,
        to_custodian: badge,
        user_id: userId,
        scan_payload: badge,
      });

      setStep({
        name: "done",
        asset: updated,
        fromCustodian: asset.custodian,
        toCustodian: badge,
      });
    } catch (err) {
      setStep({ name: "scan_badge", asset });

      if (err instanceof ApiError) {
        const msg = getApiErrorMessage(err.code, {
          currentState: asset.state,
          currentCustodian: asset.custodian,
        });
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

  // ── Manual badge submit ─────────────────────────────────────────────────

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.name !== "scan_badge" || !manualBadge.trim()) return;
    handleBadgeScan(manualBadge.trim());
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  function reset() {
    setStep({ name: "scan_asset" });
    setError(null);
    setManualBadge("");
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
          <h1 className="text-xl font-semibold text-gray-900">Transfer custody</h1>
          <p className="text-sm text-gray-500">Scan the asset, then scan the recipient&apos;s badge.</p>
        </div>
      </div>

      {/* Who's handing off — always visible */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <span className="text-sm text-gray-600">Transferring from:</span>
        <span className="text-sm font-semibold text-gray-900">{userId}</span>
      </div>

      {/* Step indicator */}
      <TransferStepIndicator current={
        step.name === "scan_asset" ? 0
        : (step.name === "scan_badge" || step.name === "submitting") ? 1
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

      {/* ── Step 2: Scan badge ── */}
      {(step.name === "scan_badge" || step.name === "submitting") && (
        <section aria-label="Scan recipient badge" className="space-y-4">
          {/* Asset card */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">{step.asset.asset_tag}</p>
                <p className="text-sm text-gray-600">{step.asset.manufacturer} · {step.asset.model}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge state={step.asset.state} size="sm" />
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 min-h-[44px]"
                >
                  Re-scan
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium">Current custodian:</span> {step.asset.custodian}
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-medium">Location:</span> {formatLocation(step.asset.location)}
            </p>
          </div>

          {isSubmitting ? (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
              <Spinner label="Transferring custody…" />
              <span className="text-sm" aria-hidden="true">Transferring custody…</span>
            </div>
          ) : (
            <CameraScanner
              onScan={handleBadgeScan}
              inputPlaceholder="Scan recipient badge ID (e.g. tech-mike)…"
              inputLabel="Recipient badge"
            />
          )}
        </section>
      )}

      {/* ── Done ── */}
      {step.name === "done" && (
        <section aria-label="Transfer complete" className="space-y-4">
          <SuccessBanner
            title="Custody transferred"
            detail={`${step.asset.asset_tag} transferred from ${step.fromCustodian} to ${step.toCustodian}.`}
          />

          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-semibold text-gray-900">{step.asset.asset_tag}</p>
                <p className="text-sm text-gray-600">{step.asset.manufacturer} · {step.asset.model}</p>
              </div>
              <StatusBadge state={step.asset.state} size="sm" />
            </div>
            {/* Custody handoff summary */}
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-500">{step.fromCustodian}</span>
              <svg className="h-4 w-4 text-gray-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span className="font-semibold text-gray-900">{step.toCustodian}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg border-2 border-purple-600 bg-white py-3 text-sm font-semibold text-purple-700 hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
          >
            Transfer another asset
          </button>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TransferStepIndicator({ current }: { current: number }) {
  const steps = ["Scan asset", "Scan badge", "Done"];
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
                    done ? "border-purple-600 bg-purple-600 text-white"
                    : active ? "border-purple-600 bg-white text-purple-700"
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
                <div className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${done ? "bg-purple-600" : "bg-gray-200"}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
