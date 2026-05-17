"use client";

/**
 * CameraScanner — camera-based barcode scanner using @zxing/browser.
 *
 * Design decisions:
 * - Always provides a keyboard fallback (ScanInput) even when camera is active.
 *   A tech may switch mid-workflow without reloading.
 * - Debounces repeated scans of the same value (2s window) to prevent
 *   the continuous decode loop from firing onScan dozens of times per second.
 * - Camera stream is released on unmount via IScannerControls.stop() —
 *   no zombie streams left open when navigating away.
 * - Camera errors (permission denied, no device) degrade gracefully to
 *   text input only — the page never crashes or blocks the workflow.
 * - Uses facingMode: "environment" (rear camera) as default on mobile.
 *   Falls back to any camera if environment mode isn't available.
 *
 * Accessibility:
 * - Camera status changes announced via aria-live region.
 * - Video element labelled for screen readers.
 * - All interactive controls meet 44px minimum touch target.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { IScannerControls } from "@zxing/browser";
import { ScanInput } from "./ScanInput";

type CameraStatus =
  | "idle"       // camera not started
  | "starting"   // getUserMedia in progress
  | "active"     // decoding continuously
  | "denied"     // permission refused
  | "unavailable"; // no camera device found

type Props = {
  /** Called with the decoded barcode value. Debounced — won't fire twice for same value within 2s. */
  onScan: (value: string) => void;
  /** Placeholder text for the fallback text input */
  inputPlaceholder?: string;
  /** Label shown above the fallback text input */
  inputLabel?: string;
  /** When true, neither camera nor input is interactive (e.g. while a request is in-flight). */
  disabled?: boolean;
};

const DEBOUNCE_MS = 2000;

export function CameraScanner({
  onScan,
  inputPlaceholder = "Scan or type and press Enter…",
  inputLabel,
  disabled = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Keep onScan in a ref so the decode callback never captures a stale closure
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef<{ value: string; time: number }>({
    value: "",
    time: 0,
  });

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraOpen, setCameraOpen] = useState(false);

  // Keep the callback ref current without restarting the scanner
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Debounced scan handler — shared between camera and keyboard paths
  const handleScan = useCallback((value: string) => {
    const now = Date.now();
    const last = lastScanRef.current;
    if (value === last.value && now - last.time < DEBOUNCE_MS) return;
    lastScanRef.current = { value, time: now };
    onScanRef.current(value);
  }, []);

  // Start / stop the camera based on cameraOpen flag
  useEffect(() => {
    if (!cameraOpen) return;

    let mounted = true;
    setCameraStatus("starting");

    async function startCamera() {
      try {
        // Dynamically import so the module only loads when the camera is requested
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        if (!mounted || !videoRef.current) return;

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
            },
          },
          videoRef.current,
          (result) => {
            if (!mounted) return;
            if (result) {
              handleScan(result.getText());
            }
            // Errors in the callback are mostly NotFoundException (no barcode in
            // frame) — expected noise, not worth surfacing.
          },
        );

        if (!mounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraStatus("active");
      } catch (err) {
        if (!mounted) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraStatus("denied");
        } else {
          setCameraStatus("unavailable");
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [cameraOpen, handleScan]);

  // Stop camera when disabled externally
  useEffect(() => {
    if (disabled && controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
      setCameraOpen(false);
      setCameraStatus("idle");
    }
  }, [disabled]);

  function toggleCamera() {
    if (cameraOpen) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      setCameraOpen(false);
      setCameraStatus("idle");
    } else {
      setCameraOpen(true);
    }
  }

  const showDegradedMessage =
    cameraOpen && (cameraStatus === "denied" || cameraStatus === "unavailable");

  return (
    <div className="space-y-3">
      {/* Camera toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {cameraStatus === "active"
            ? "Camera active — point at barcode"
            : cameraStatus === "starting"
            ? "Starting camera…"
            : "Use camera or type below"}
        </span>
        <button
          type="button"
          onClick={toggleCamera}
          disabled={disabled}
          aria-pressed={cameraOpen}
          aria-label={cameraOpen ? "Close camera scanner" : "Open camera scanner"}
          className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg
            className="h-4 w-4"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
            />
          </svg>
          {cameraOpen ? "Close camera" : "Use camera"}
        </button>
      </div>

      {/* Camera viewfinder */}
      {cameraOpen && (
        <div className="relative">
          {/* aria-live region announces camera status changes */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {cameraStatus === "active" && "Camera active. Point at barcode to scan."}
            {cameraStatus === "starting" && "Starting camera."}
            {cameraStatus === "denied" && "Camera access denied. Use text input below."}
            {cameraStatus === "unavailable" && "No camera available. Use text input below."}
          </div>

          {showDegradedMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {cameraStatus === "denied"
                ? "Camera access was denied. Use the text input below to scan or type a barcode."
                : "No camera was found on this device. Use the text input below."}
            </div>
          ) : (
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                aria-label="Camera viewfinder — point at barcode to scan"
                muted
                playsInline
              />

              {/* Targeting overlay */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="h-36 w-64 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>

              {/* Starting overlay */}
              {cameraStatus === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <p className="text-sm text-white">Starting camera…</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Keyboard / USB scanner input — always present */}
      <ScanInput
        onScan={handleScan}
        placeholder={inputPlaceholder}
        label={inputLabel}
        disabled={disabled}
        autoFocus={!cameraOpen}
      />
    </div>
  );
}
