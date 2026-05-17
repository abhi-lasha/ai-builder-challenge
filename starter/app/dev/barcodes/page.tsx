"use client";

/**
 * /dev/barcodes — scannable test barcodes for every workflow.
 *
 * Purpose: let reviewers and developers test all four scan workflows without
 * needing physical asset labels. Print this page or scan from screen.
 *
 * What's here:
 *   - Asset tags covering every interesting state (received, stored, in_service,
 *     disposed, plus our test asset C9990099)
 *   - Location barcodes in our LOC| format — one storage-only, two full deploy
 *     locations (with rack + ru)
 *   - Badge IDs for testing the transfer workflow
 *
 * Format: QR codes — work with both the CameraScanner component and most phone
 * camera apps. The encoded value is shown below each code so you can also type
 * it directly into the ScanInput.
 *
 * Print tip: Use browser Print → "Background graphics" on to keep the labels.
 */

import { QRCodeSVG } from "qrcode.react";
import { encodeLocationBarcode } from "@/lib/scan-utils";
import type { Location } from "@/lib/types";

// ── Data ───────────────────────────────────────────────────────────────────

type AssetBarcode = {
  tag: string;
  label: string;
  description: string;
  state: string;
};

type LocationBarcode = {
  loc: Location;
  label: string;
  description: string;
};

type BadgeBarcode = {
  id: string;
  label: string;
  description: string;
};

const ASSET_BARCODES: AssetBarcode[] = [
  {
    tag: "C9990099",
    label: "Test asset (received)",
    description: "Created during testing — use for store/deploy/transfer.",
    state: "received",
  },
  {
    tag: "C0000107",
    label: "Seeded: received",
    description: "BioSystems Genomics Sequencer — at the dock.",
    state: "received",
  },
  {
    tag: "C0000104",
    label: "Seeded: stored",
    description: "BioSystems Genomics Sequencer — in storage. Try deploying it.",
    state: "stored",
  },
  {
    tag: "C0000101",
    label: "Seeded: in service",
    description: "BioSystems Genomics Sequencer — deployed to rack. Try storing (de-rack) or transferring.",
    state: "in_service",
  },
  {
    tag: "C0000109",
    label: "Seeded: disposed",
    description: "ChemAnalytics Mass Spec — disposed. Any scan should return a clear error.",
    state: "disposed",
  },
];

const LOCATION_BARCODES: LocationBarcode[] = [
  {
    loc: { site: "Lab-Building-A", room: "Storage-A", row: null, rack: null, ru: null },
    label: "Storage location",
    description: "Use this with the Store workflow. No rack/RU needed.",
  },
  {
    loc: { site: "Lab-Building-A", room: "LAB-B", row: "ROW-1", rack: "RACK-3", ru: "7" },
    label: "Deploy location A",
    description: "Full rack location — use with the Deploy workflow.",
  },
  {
    loc: { site: "Lab-Building-B", room: "LAB-C", row: "ROW-2", rack: "RACK-5", ru: "12" },
    label: "Deploy location B",
    description: "Second deploy location for testing re-deploy or reconciliation drift.",
  },
];

const BADGE_BARCODES: BadgeBarcode[] = [
  {
    id: "tech-mike",
    label: "Badge: tech-mike",
    description: "Scan into Transfer → recipient badge field.",
  },
  {
    id: "tech-carlos",
    label: "Badge: tech-carlos",
    description: "Another tech badge for transfer testing.",
  },
  {
    id: "manager-paul",
    label: "Badge: manager-paul",
    description: "Manager badge — transfer custody to a manager.",
  },
];

// ── State colours ─────────────────────────────────────────────────────────

const STATE_COLOR: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 ring-blue-200",
  stored: "bg-amber-50 text-amber-700 ring-amber-200",
  in_service: "bg-green-50 text-green-700 ring-green-200",
  disposed: "bg-red-50 text-red-700 ring-red-200",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function BarcodesPage() {
  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs font-mono text-gray-600">DEV</span>
            <h1 className="text-2xl font-semibold text-gray-900">Test barcodes</h1>
          </div>
          <p className="text-sm text-gray-500 max-w-xl">
            Scan these QR codes with the camera scanner, or type the value shown below each code
            directly into any scan input field. Print this page for physical testing.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex-shrink-0 flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] print:hidden"
        >
          <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
          </svg>
          Print
        </button>
      </div>

      {/* ── Asset Tags ── */}
      <section aria-labelledby="assets-heading">
        <h2 id="assets-heading" className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-900 text-xs text-white font-bold">A</span>
          Asset tags
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Scan into the asset tag field on Receive, Store, Deploy, or Transfer.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 print:grid-cols-5">
          {ASSET_BARCODES.map((b) => (
            <BarcodeCard
              key={b.tag}
              value={b.tag}
              label={b.label}
              description={b.description}
              badge={
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATE_COLOR[b.state] ?? "bg-gray-100 text-gray-600"}`}>
                  {b.state.replace("_", " ")}
                </span>
              }
            />
          ))}
        </div>
      </section>

      {/* ── Location Barcodes ── */}
      <section aria-labelledby="locations-heading">
        <h2 id="locations-heading" className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-amber-600 text-xs text-white font-bold">L</span>
          Location barcodes
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Scan into the location field on Store or Deploy. Deploy locations require rack + RU.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3">
          {LOCATION_BARCODES.map((b) => {
            const encoded = encodeLocationBarcode(b.loc);
            const needsFullLoc = b.loc.rack && b.loc.ru;
            return (
              <BarcodeCard
                key={encoded}
                value={encoded}
                label={b.label}
                description={b.description}
                badge={
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${needsFullLoc ? "bg-green-50 text-green-700 ring-green-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                    {needsFullLoc ? "deploy" : "storage"}
                  </span>
                }
              />
            );
          })}
        </div>
      </section>

      {/* ── Badge IDs ── */}
      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-purple-600 text-xs text-white font-bold">B</span>
          Badge IDs
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Scan into the recipient badge field on the Transfer workflow.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
          {BADGE_BARCODES.map((b) => (
            <BarcodeCard
              key={b.id}
              value={b.id}
              label={b.label}
              description={b.description}
              badge={
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-purple-50 text-purple-700 ring-purple-200">
                  badge
                </span>
              }
            />
          ))}
        </div>
      </section>

      {/* Format reference */}
      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 print:hidden">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Location barcode format</h2>
        <p className="text-xs text-gray-600 font-mono mb-1">
          LOC|&lt;site&gt;|&lt;room&gt;|&lt;row&gt;|&lt;rack&gt;|&lt;ru&gt;
        </p>
        <p className="text-xs text-gray-500">
          Empty segments are fine — leave rack and ru blank for storage locations. All five pipe-separated segments must be present (empty string is OK).
        </p>
        <div className="mt-2 space-y-1">
          <p className="text-xs font-mono text-gray-500">Storage: <span className="text-gray-800">LOC|Lab-Building-A|Storage-A|||</span></p>
          <p className="text-xs font-mono text-gray-500">Deploy:  <span className="text-gray-800">LOC|Lab-Building-A|LAB-B|ROW-1|RACK-3|7</span></p>
        </div>
      </section>
    </div>
  );
}

// ── BarcodeCard ────────────────────────────────────────────────────────────

function BarcodeCard({
  value,
  label,
  description,
  badge,
}: {
  value: string;
  label: string;
  description: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col items-center gap-3 print:border-gray-300 print:break-inside-avoid">
      {/* QR code */}
      <QRCodeSVG
        value={value}
        size={140}
        level="M"
        aria-label={`QR code for ${label}: ${value}`}
      />

      {/* Label + badge */}
      <div className="w-full text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {badge}
        </div>
        <p className="text-xs font-semibold text-gray-900 leading-tight">{label}</p>
        <p className="text-xs text-gray-500 leading-tight">{description}</p>
      </div>

      {/* Encoded value — for manual typing */}
      <div className="w-full rounded bg-gray-50 border border-gray-200 px-2 py-1.5 text-center">
        <p className="text-xs font-mono text-gray-700 break-all leading-snug">{value}</p>
      </div>
    </div>
  );
}
