"use client";

/**
 * BarcodeDrawer — floating QR code reference panel.
 *
 * A "QR" button sits fixed in the bottom-right corner of every page.
 * Clicking it slides open a drawer with all test barcodes so reviewers
 * and devs don't have to navigate back to /dev/barcodes mid-workflow.
 *
 * Only rendered client-side — qrcode.react and the data are loaded lazily
 * so they don't inflate the server bundle.
 */

import { useState } from "react";
import { usePathname } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { encodeLocationBarcode } from "@/lib/scan-utils";
import type { Location } from "@/lib/types";

// ── Data (mirrors /dev/barcodes) ──────────────────────────────────────────

const ASSETS = [
  { tag: "C9990099", label: "Test asset", state: "received" },
  { tag: "C0000107", label: "Seeded: received", state: "received" },
  { tag: "C0000104", label: "Seeded: stored", state: "stored" },
  { tag: "C0000101", label: "Seeded: in service", state: "in_service" },
  { tag: "C0000109", label: "Seeded: disposed", state: "disposed" },
];

const LOCATIONS: { loc: Location; label: string }[] = [
  {
    loc: { site: "Lab-Building-A", room: "Storage-A", row: null, rack: null, ru: null },
    label: "Storage location",
  },
  {
    loc: { site: "Lab-Building-A", room: "LAB-B", row: "ROW-1", rack: "RACK-3", ru: "7" },
    label: "Deploy location A",
  },
  {
    loc: { site: "Lab-Building-B", room: "LAB-C", row: "ROW-2", rack: "RACK-5", ru: "12" },
    label: "Deploy location B",
  },
];

const BADGES = [
  { id: "tech-mike", label: "Badge: tech-mike" },
  { id: "tech-carlos", label: "Badge: tech-carlos" },
  { id: "manager-paul", label: "Badge: manager-paul" },
];

const STATE_COLOR: Record<string, string> = {
  received:   "bg-blue-50 text-blue-700 ring-blue-200",
  stored:     "bg-amber-50 text-amber-700 ring-amber-200",
  in_service: "bg-green-50 text-green-700 ring-green-200",
  disposed:   "bg-red-50 text-red-700 ring-red-200",
};

// ── Component ─────────────────────────────────────────────────────────────

export function BarcodeDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // No point showing a barcode drawer on the barcode page itself
  if (pathname === "/dev/barcodes") return null;

  return (
    <>
      {/* Floating toggle */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open barcode reference panel"
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px] print:hidden"
      >
        {/* QR icon */}
        <svg className="h-4 w-4 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
        QR codes
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 print:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Barcode reference panel"
        className={[
          "fixed top-0 right-0 z-50 flex h-full w-80 flex-col bg-white shadow-xl",
          "transform transition-transform duration-200 ease-in-out print:hidden",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono text-gray-600">DEV</span>
              <h2 className="text-sm font-semibold text-gray-900">Test barcodes</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Scan from screen or type the value below</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close barcode panel"
            className="ml-4 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

          {/* Asset tags */}
          <section aria-labelledby="drawer-assets-heading">
            <h3 id="drawer-assets-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-gray-900 text-xs text-white font-bold">A</span>
              Asset tags
            </h3>
            <div className="space-y-3">
              {ASSETS.map((a) => (
                <DrawerCard key={a.tag} value={a.tag} label={a.label}>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_COLOR[a.state] ?? "bg-gray-100 text-gray-600"}`}>
                    {a.state.replace("_", " ")}
                  </span>
                </DrawerCard>
              ))}
            </div>
          </section>

          {/* Location barcodes */}
          <section aria-labelledby="drawer-locations-heading">
            <h3 id="drawer-locations-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-600 text-xs text-white font-bold">L</span>
              Locations
            </h3>
            <div className="space-y-3">
              {LOCATIONS.map((l) => {
                const encoded = encodeLocationBarcode(l.loc);
                const isDeployLoc = !!(l.loc.rack && l.loc.ru);
                return (
                  <DrawerCard key={encoded} value={encoded} label={l.label}>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isDeployLoc ? "bg-green-50 text-green-700 ring-green-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                      {isDeployLoc ? "deploy" : "storage"}
                    </span>
                  </DrawerCard>
                );
              })}
            </div>
          </section>

          {/* Badges */}
          <section aria-labelledby="drawer-badges-heading">
            <h3 id="drawer-badges-heading" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-600 text-xs text-white font-bold">B</span>
              Badge IDs
            </h3>
            <div className="space-y-3">
              {BADGES.map((b) => (
                <DrawerCard key={b.id} value={b.id} label={b.label}>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-200">
                    badge
                  </span>
                </DrawerCard>
              ))}
            </div>
          </section>

          {/* Footer link */}
          <div className="border-t pt-4">
            <a
              href="/dev/barcodes"
              className="text-xs text-blue-600 hover:underline"
            >
              Open full barcodes page →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

// ── DrawerCard ─────────────────────────────────────────────────────────────

function DrawerCard({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      {/* QR code — compact size for drawer */}
      <div className="flex-shrink-0">
        <QRCodeSVG
          value={value}
          size={72}
          level="M"
          aria-label={`QR code for ${label}`}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        {children}
        <p className="text-xs font-medium text-gray-900 leading-snug">{label}</p>
        <p className="text-xs font-mono text-gray-500 break-all leading-snug">{value}</p>
      </div>
    </div>
  );
}
