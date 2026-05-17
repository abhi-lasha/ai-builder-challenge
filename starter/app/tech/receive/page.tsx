"use client";

/**
 * /tech/receive — dock-side asset intake.
 *
 * Three outcomes the API can return and how we surface each:
 *   1. New tag (201)            → green SuccessBanner, invite next scan
 *   2. Duplicate + same serial  → blue InfoBanner ("already received — no action needed")
 *   3. Duplicate + diff serial  → red ErrorBanner with BOTH serials side-by-side (409)
 *
 * UX principles:
 *   - Two phases: scan tag → fill details. Form only appears after a valid tag scan.
 *   - Serial input auto-focuses after tag scan so a gloved hand can move straight to it.
 *   - Submit button disabled while in-flight — prevents double-submit.
 *   - On error, form retains all entered values — tech does not retype everything.
 *   - Location can be auto-filled by scanning a LOC| barcode, or typed manually.
 *   - "Receive another" resets only the tag/result; form values are preserved as
 *     defaults (same dock, same batch often means same manufacturer/model).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { btn, btnSize } from "@/styles/button";
import { label as labelCls, labelSm, input as inputCls } from "@/styles/form";
import { getApiErrorMessage } from "@/lib/error-messages";
import { isAssetTag, parseLocationBarcode } from "@/lib/scan-utils";
import { useCurrentUser } from "@/lib/use-current-user";
import { CameraScanner } from "@/components/CameraScanner";
import { ErrorBanner } from "@/components/ErrorBanner";
import { SuccessBanner } from "@/components/SuccessBanner";
import { InfoBanner } from "@/components/InfoBanner";
import { Spinner } from "@/components/Spinner";
import type { Asset, AssetClass } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = "scan_tag" | "fill_details";

type ReceiveResult =
  | { kind: "created"; asset: Asset }
  | { kind: "duplicate"; asset: Asset }
  | { kind: "serial_conflict"; existingSerial: string; providedSerial: string }
  | { kind: "error"; title: string; detail: string; action: string };

type FormValues = {
  serial: string;
  model: string;
  manufacturer: string;
  assetClass: AssetClass | "";
  site: string;
  room: string;
  row: string;
  rack: string;
  ru: string;
};

// ── Constants ──────────────────────────────────────────────────────────────

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "instrument", label: "Instrument" },
  { value: "compute", label: "Compute" },
  { value: "network", label: "Network" },
  { value: "power", label: "Power" },
  { value: "consumable_durable", label: "Consumable / Durable" },
];

const EMPTY_FORM: FormValues = {
  serial: "",
  model: "",
  manufacturer: "",
  assetClass: "",
  site: "",
  room: "Receiving",
  row: "",
  rack: "",
  ru: "",
};

// ── Component ──────────────────────────────────────────────────────────────

export default function TechReceivePage() {
  const { userId } = useCurrentUser();

  const [phase, setPhase] = useState<Phase>("scan_tag");
  const [scannedTag, setScannedTag] = useState("");
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReceiveResult | null>(null);

  const serialInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus serial input when the form appears
  useEffect(() => {
    if (phase === "fill_details") {
      serialInputRef.current?.focus();
    }
  }, [phase]);

  // ── Tag scan handler ──────────────────────────────────────────────────────

  const handleTagScan = useCallback((raw: string) => {
    const value = raw.trim();

    if (!isAssetTag(value)) {
      // Wrong format — could be a location barcode scanned into the wrong field
      setResult({
        kind: "error",
        title: "Invalid asset tag",
        detail: `"${value}" doesn't look like an asset tag. Tags start with C followed by 7 digits (e.g. C0001234).`,
        action: "Check you're scanning the asset barcode, not a location or badge.",
      });
      return;
    }

    setScannedTag(value);
    setResult(null);
    setPhase("fill_details");
  }, []);

  // ── Form field handler ────────────────────────────────────────────────────

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Location barcode auto-fill — tech can scan a LOC| barcode inside the form
  const handleLocationScan = useCallback((raw: string) => {
    const loc = parseLocationBarcode(raw);
    if (!loc) return; // not a location barcode, ignore
    setForm((prev) => ({
      ...prev,
      site: loc.site ?? prev.site,
      room: loc.room ?? prev.room,
      row: loc.row ?? prev.row,
      rack: loc.rack ?? prev.rack,
      ru: loc.ru ?? prev.ru,
    }));
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setResult(null);

    try {
      // Use fetch directly (not the api-client) so we can read the HTTP status.
      // The API returns 201 for a new asset and 200 for an idempotent duplicate
      // receive — both are success responses with the same body shape, so the
      // api-client can't distinguish them. Status code is the only reliable signal.
      const res = await fetch("/api/upstream/scans/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_tag: scannedTag,
          serial: form.serial.trim(),
          model: form.model.trim(),
          manufacturer: form.manufacturer.trim(),
          asset_class: form.assetClass as AssetClass,
          location: {
            site: form.site.trim(),
            room: form.room.trim() || null,
            row: form.row.trim() || null,
            rack: form.rack.trim() || null,
            ru: form.ru.trim() || null,
          },
          user_id: userId,
          scan_payload: scannedTag,
        }),
      });

      const data = await res.json() as Asset & { error?: { code: string; message: string; details?: Record<string, unknown> } };

      if (!res.ok) {
        const code = data.error?.code ?? "internal_error";
        const details = data.error?.details;

        if (code === "and_match_failed") {
          setResult({
            kind: "serial_conflict",
            existingSerial: String(details?.expected_serial ?? "unknown"),
            providedSerial: form.serial.trim(),
          });
        } else {
          const msg = getApiErrorMessage(code);
          setResult({ kind: "error", ...msg });
        }
        return;
      }

      // 201 = new asset created, 200 = idempotent duplicate (same serial already registered)
      setResult(res.status === 201
        ? { kind: "created", asset: data }
        : { kind: "duplicate", asset: data }
      );
    } catch {
      setResult({
        kind: "error",
        title: "Connection problem",
        detail: "We couldn't reach the server. Your scan was not saved.",
        action: "Check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Reset to scan another ─────────────────────────────────────────────────

  function resetForNext() {
    setScannedTag("");
    setResult(null);
    // Keep form values as defaults — same batch often means same manufacturer/model
    setForm((prev) => ({ ...prev, serial: "" }));
    setPhase("scan_tag");
  }

  function resetFull() {
    setScannedTag("");
    setResult(null);
    setForm(EMPTY_FORM);
    setPhase("scan_tag");
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
          <h1 className="text-xl font-semibold text-gray-900">Receive asset</h1>
          <p className="text-sm text-gray-500">Scan the barcode on the incoming box.</p>
        </div>
      </div>

      {/* ── Phase 1: Scan tag ── */}
      {phase === "scan_tag" && (
        <section aria-label="Scan asset tag">
          {result?.kind === "error" && (
            <div className="mb-4">
              <ErrorBanner
                title={result.title}
                detail={result.detail}
                action={result.action}
                onDismiss={() => setResult(null)}
              />
            </div>
          )}
          <CameraScanner
            onScan={handleTagScan}
            inputPlaceholder="Scan asset tag (e.g. C0001234)…"
            inputLabel="Asset tag"
          />
        </section>
      )}

      {/* ── Phase 2: Fill details ── */}
      {phase === "fill_details" && (
        <section aria-label="Asset details form">
          {/* Scanned tag chip with rescan option */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
              <span className="text-sm text-gray-600">Tag:</span>
              <span className="font-mono font-semibold text-gray-900">{scannedTag}</span>
            </div>
            <button
              type="button"
              onClick={resetFull}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 min-h-[44px]"
            >
              Re-scan
            </button>
          </div>

          {/* Result banners */}
          {result?.kind === "created" && (
            <div className="mb-4 space-y-3">
              <SuccessBanner
                title="Asset received"
                detail={`${scannedTag} has been checked in. It's ready to be stored or deployed.`}
              />
              <button
                type="button"
                onClick={resetForNext}
                className="w-full rounded-lg border-2 border-blue-600 bg-white py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                Receive another asset
              </button>
            </div>
          )}

          {result?.kind === "duplicate" && (
            <div className="mb-4 space-y-3">
              <InfoBanner
                title="Already received"
                detail={`${scannedTag} was already checked in with the same serial number. No action needed — you're all set.`}
              />
              <button
                type="button"
                onClick={resetForNext}
                className="w-full rounded-lg border-2 border-blue-600 bg-white py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                Receive another asset
              </button>
            </div>
          )}

          {result?.kind === "serial_conflict" && (
            <div className="mb-4">
              <div role="alert" aria-live="assertive" className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-800">Serial number mismatch</p>
                    <p className="mt-1 text-sm text-red-700">
                      Tag <span className="font-mono font-semibold">{scannedTag}</span> is already registered to a different asset. Compare serials carefully.
                    </p>
                  </div>
                </div>
                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-3 rounded-md bg-white border border-red-200 p-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Registered serial</p>
                    <p className="font-mono text-sm font-semibold text-gray-900 break-all">{result.existingSerial}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">You entered</p>
                    <p className="font-mono text-sm font-semibold text-red-700 break-all">{result.providedSerial}</p>
                  </div>
                </div>
                <p className="text-sm text-red-700 font-medium">
                  Check the physical label. If the asset is genuinely different, contact your manager — do not proceed.
                </p>
              </div>
            </div>
          )}

          {result?.kind === "error" && (
            <div className="mb-4">
              <ErrorBanner
                title={result.title}
                detail={result.detail}
                action={result.action}
                onDismiss={() => setResult(null)}
              />
            </div>
          )}

          {/* Details form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Serial */}
            <div>
              <label htmlFor="serial" className={labelCls}>
                Serial number <span aria-hidden="true" className="text-red-500">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <input
                ref={serialInputRef}
                id="serial"
                type="text"
                value={form.serial}
                onChange={(e) => setField("serial", e.target.value)}
                required
                autoComplete="off"
                spellCheck={false}
                disabled={submitting}
                placeholder="e.g. SN-INST-A001"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-600 focus:outline-none disabled:bg-gray-50 min-h-[44px]"
              />
            </div>

            {/* Manufacturer + Model — side by side on larger screens */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="manufacturer" className={labelCls}>
                  Manufacturer <span aria-hidden="true" className="text-red-500">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="manufacturer"
                  type="text"
                  value={form.manufacturer}
                  onChange={(e) => setField("manufacturer", e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="e.g. BioSystems Inc"
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-600 focus:outline-none disabled:bg-gray-50 min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="model" className={labelCls}>
                  Model <span aria-hidden="true" className="text-red-500">*</span>
                  <span className="sr-only">(required)</span>
                </label>
                <input
                  id="model"
                  type="text"
                  value={form.model}
                  onChange={(e) => setField("model", e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="e.g. Genomics Sequencer 2000"
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-600 focus:outline-none disabled:bg-gray-50 min-h-[44px]"
                />
              </div>
            </div>

            {/* Asset class */}
            <div>
              <label htmlFor="asset-class" className={labelCls}>
                Asset class <span aria-hidden="true" className="text-red-500">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <select
                id="asset-class"
                value={form.assetClass}
                onChange={(e) => setField("assetClass", e.target.value as AssetClass | "")}
                required
                disabled={submitting}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base bg-white focus:border-blue-600 focus:outline-none disabled:bg-gray-50 min-h-[44px]"
              >
                <option value="" disabled>Select a class…</option>
                {ASSET_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <fieldset className="rounded-lg border border-gray-200 p-4 space-y-4">
              <legend className="px-1 text-sm font-medium text-gray-700">
                Receiving location
              </legend>

              {/* Optional: scan a location barcode to auto-fill */}
              <CameraScanner
                onScan={handleLocationScan}
                inputPlaceholder="Scan location barcode to auto-fill…"
                inputLabel="Scan location (optional)"
                disabled={submitting}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="loc-site" className={labelSm}>
                    Site <span aria-hidden="true" className="text-red-500">*</span>
                    <span className="sr-only">(required)</span>
                  </label>
                  <input
                    id="loc-site"
                    type="text"
                    value={form.site}
                    onChange={(e) => setField("site", e.target.value)}
                    required
                    disabled={submitting}
                    placeholder="e.g. Lab-Building-A"
                    className={cn(inputCls, "disabled:bg-gray-50")}
                  />
                </div>
                <div>
                  <label htmlFor="loc-room" className={labelSm}>Room</label>
                  <input
                    id="loc-room"
                    type="text"
                    value={form.room}
                    onChange={(e) => setField("room", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Receiving"
                    className={cn(inputCls, "disabled:bg-gray-50")}
                  />
                </div>
                <div>
                  <label htmlFor="loc-rack" className={labelSm}>Dock / Rack</label>
                  <input
                    id="loc-rack"
                    type="text"
                    value={form.rack}
                    onChange={(e) => setField("rack", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. DOCK-2"
                    className={cn(inputCls, "disabled:bg-gray-50")}
                  />
                </div>
                <div>
                  <label htmlFor="loc-row" className={labelSm}>Row</label>
                  <input
                    id="loc-row"
                    type="text"
                    value={form.row}
                    onChange={(e) => setField("row", e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. ROW-1"
                    className={cn(inputCls, "disabled:bg-gray-50")}
                  />
                </div>
              </div>
            </fieldset>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !form.serial.trim() || !form.model.trim() || !form.manufacturer.trim() || !form.assetClass || !form.site.trim()}
              className="w-full rounded-lg bg-blue-600 py-4 text-base font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" label="Submitting…" />
                  <span>Submitting…</span>
                </>
              ) : (
                "Receive asset"
              )}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
