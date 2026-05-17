/**
 * GET /api/reconcile
 *
 * Three-way reconciliation: Operations (our API) × Facilities mock × Finance mock.
 *
 * Bucket definitions:
 *   synced          — all systems agree (or the asset state doesn't require presence
 *                     in Facilities / Finance)
 *   location_drift  — Ops location ≠ Facilities rack_location for in_service assets,
 *                     OR a stored/received asset still shows up in Facilities with a
 *                     rack_location (stale de-rack)
 *   finance_drift   — Finance status doesn't match the expected status for this state
 *   both_drift      — has both a location AND a finance issue
 *   ghost           — record in Facilities or Finance with no matching asset in Ops
 *
 * All three upstream fetches run in parallel. This route is server-only; the
 * token never reaches the browser.
 */

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/api-client";
import type { Asset, FacilitiesRecord, FinanceRecord } from "@/lib/types";

const api = createApiClient();

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReconcileBucket =
  | "synced"
  | "location_drift"
  | "finance_drift"
  | "both_drift"
  | "ghost";

export type ReconcileItem = {
  asset_tag: string;
  bucket: ReconcileBucket;
  issues: string[];
  asset: Asset | null;
  facilities: FacilitiesRecord | null;
  finance: FinanceRecord | null;
};

export type ReconcileResult = {
  summary: Record<ReconcileBucket, number> & { total: number };
  items: ReconcileItem[];
  fetched_at: string;
};

// ── Finance status expectations ────────────────────────────────────────────────

const EXPECTED_FINANCE_STATUS: Partial<Record<Asset["state"], FinanceRecord["status"]>> = {
  in_service: "capitalized",
  disposed: "retired",
  received: "pending_receipt",
  stored: "pending_receipt",
  rma_pending: "impaired",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the canonical rack_location string the same way the deploy write-back does.
 * Used to compare against what Facilities actually has.
 */
function toRackLocation(asset: Asset): string {
  return [
    asset.location.site,
    asset.location.room,
    asset.location.row,
    asset.location.rack,
    asset.location.ru,
  ]
    .filter(Boolean)
    .join("/");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // 1. Fetch all three sources in parallel.
  let assets: Asset[];
  let facilitiesRecords: FacilitiesRecord[];
  let financeRecords: FinanceRecord[];

  try {
    [assets, facilitiesRecords, financeRecords] = await Promise.all([
      api.assets.list(),
      api.mock.facilities(),
      api.mock.finance(),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch upstream data";
    return NextResponse.json(
      { error: { code: "upstream_error", message } },
      { status: 502 },
    );
  }

  // 2. Build lookup maps for O(1) access.
  const facilitiesByTag = new Map<string, FacilitiesRecord>(
    facilitiesRecords.map((r) => [r.tagged_id, r]),
  );
  const financeByTag = new Map<string, FinanceRecord>(
    financeRecords.map((r) => [r.tag, r]),
  );
  const assetTagSet = new Set(assets.map((a) => a.asset_tag));

  // 3. Classify each asset in Operations.
  const items: ReconcileItem[] = [];

  for (const asset of assets) {
    const fac = facilitiesByTag.get(asset.asset_tag) ?? null;
    const fin = financeByTag.get(asset.asset_tag) ?? null;
    const issues: string[] = [];

    // ── Facilities check ────────────────────────────────────────────────────
    if (asset.state === "in_service") {
      // In-service assets MUST have a Facilities record with a matching rack location.
      const opsRack = toRackLocation(asset);
      if (!fac) {
        issues.push("Missing from Facilities (should have a rack location)");
      } else if (fac.rack_location !== opsRack) {
        issues.push(
          `Location drift: Ops has "${opsRack}" but Facilities has "${fac.rack_location}"`,
        );
      }
    } else if (fac && fac.rack_location) {
      // Non-in_service assets should NOT have an active rack_location in Facilities
      // (the store write-back should have cleared it).
      issues.push(
        `Stale Facilities record: asset is ${asset.state} but Facilities still shows rack "${fac.rack_location}"`,
      );
    }

    // ── Finance check ───────────────────────────────────────────────────────
    const expectedFinance = EXPECTED_FINANCE_STATUS[asset.state];
    if (expectedFinance) {
      if (!fin) {
        issues.push(
          `Missing from Finance (expected status: ${expectedFinance})`,
        );
      } else if (fin.status !== expectedFinance) {
        issues.push(
          `Finance drift: expected "${expectedFinance}" but got "${fin.status}"`,
        );
      }
    }

    // ── Bucket ──────────────────────────────────────────────────────────────
    const hasLocationIssue = issues.some(
      (i) => i.includes("Facilities") || i.includes("Location drift") || i.includes("Stale Facilities"),
    );
    const hasFinanceIssue = issues.some(
      (i) => i.includes("Finance"),
    );

    let bucket: ReconcileBucket;
    if (issues.length === 0) {
      bucket = "synced";
    } else if (hasLocationIssue && hasFinanceIssue) {
      bucket = "both_drift";
    } else if (hasLocationIssue) {
      bucket = "location_drift";
    } else {
      bucket = "finance_drift";
    }

    items.push({ asset_tag: asset.asset_tag, bucket, issues, asset, facilities: fac, finance: fin });
  }

  // 4. Ghost detection — records in Facilities or Finance with no Ops asset.
  const seenGhosts = new Set<string>();

  for (const fac of facilitiesRecords) {
    if (!assetTagSet.has(fac.tagged_id) && !seenGhosts.has(fac.tagged_id)) {
      seenGhosts.add(fac.tagged_id);
      items.push({
        asset_tag: fac.tagged_id,
        bucket: "ghost",
        issues: [`Ghost: found in Facilities (tagged_id=${fac.tagged_id}) but not in Operations`],
        asset: null,
        facilities: fac,
        finance: financeByTag.get(fac.tagged_id) ?? null,
      });
    }
  }

  for (const fin of financeRecords) {
    if (!assetTagSet.has(fin.tag) && !seenGhosts.has(fin.tag)) {
      seenGhosts.add(fin.tag);
      items.push({
        asset_tag: fin.tag,
        bucket: "ghost",
        issues: [`Ghost: found in Finance (tag=${fin.tag}) but not in Operations`],
        asset: null,
        facilities: facilitiesByTag.get(fin.tag) ?? null,
        finance: fin,
      });
    }
  }

  // 5. Build summary counts.
  const summary = {
    synced: 0,
    location_drift: 0,
    finance_drift: 0,
    both_drift: 0,
    ghost: 0,
    total: items.length,
  };
  for (const item of items) {
    summary[item.bucket]++;
  }

  // 6. Sort: drifted first (most actionable), then synced.
  const BUCKET_PRIORITY: Record<ReconcileBucket, number> = {
    ghost: 0,
    both_drift: 1,
    location_drift: 2,
    finance_drift: 3,
    synced: 4,
  };
  items.sort((a, b) => BUCKET_PRIORITY[a.bucket] - BUCKET_PRIORITY[b.bucket]);

  const result: ReconcileResult = {
    summary,
    items,
    fetched_at: new Date().toISOString(),
  };

  return NextResponse.json(result);
}
