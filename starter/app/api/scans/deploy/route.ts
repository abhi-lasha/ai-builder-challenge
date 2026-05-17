import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/api-client";

/**
 * POST /api/scans/deploy
 *
 * Server-side wrapper around the upstream deploy scan.
 * After a successful deploy, writes back to Facilities and Finance
 * so those systems stay in sync with Operations.
 *
 * Why this lives server-side (not in the browser):
 *   The same token-security argument that applies to /api/reconcile applies here.
 *   All three upstream calls happen server-to-server; the API_TOKEN never reaches
 *   the browser. The browser makes exactly one request — to this route.
 *
 * Write-back failure policy:
 *   If Facilities or Finance write-back fails, we log it but still return the
 *   successful deploy to the client. The tech's scan is recorded correctly.
 *   The reconciliation report will surface any resulting drift.
 *   We don't block the tech on a secondary-system failure.
 */

const api = createApiClient();

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_payload", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const { asset_tag, location, user_id, scan_payload } = body as {
    asset_tag?: string;
    location?: {
      site?: string;
      room?: string | null;
      row?: string | null;
      rack?: string | null;
      ru?: string | null;
    };
    user_id?: string;
    scan_payload?: string;
  };

  if (!asset_tag || !location || !user_id || !scan_payload) {
    return NextResponse.json(
      { error: { code: "invalid_payload", message: "Missing required fields." } },
      { status: 400 },
    );
  }

  // ── 1. Call upstream deploy ──────────────────────────────────────────────

  let asset;
  try {
    asset = await api.scans.deploy({
      asset_tag,
      location: {
        site: location.site ?? "",
        room: location.room ?? null,
        row: location.row ?? null,
        rack: location.rack ?? null,
        ru: location.ru ?? null,
      },
      user_id,
      scan_payload,
    });
  } catch (err) {
    // Pass upstream errors straight through to the client
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code ?? "internal_error";
    const message = (err as Error).message ?? "Upstream deploy failed.";
    const details = (err as { details?: unknown }).details;

    return NextResponse.json(
      { error: { code, message, details } },
      { status },
    );
  }

  // ── 2. Write-backs (best-effort, don't block the tech) ───────────────────

  const writeBackErrors: string[] = [];

  // Facilities: set rack location
  const rackLocation = [
    asset.location.site,
    asset.location.room,
    asset.location.row,
    asset.location.rack,
    asset.location.ru,
  ]
    .filter(Boolean)
    .join("/");

  try {
    await api.mock.updateFacilities({
      tagged_id: asset_tag,
      rack_location: rackLocation,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[deploy] Facilities write-back failed for ${asset_tag}:`, msg);
    writeBackErrors.push(`facilities: ${msg}`);
  }

  // Finance: mark as capitalized
  try {
    await api.mock.updateFinance({
      tag: asset_tag,
      site: asset.location.site,
      status: "capitalized",
      capitalized_on: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[deploy] Finance write-back failed for ${asset_tag}:`, msg);
    writeBackErrors.push(`finance: ${msg}`);
  }

  // ── 3. Return the asset (+ optional write-back warnings) ─────────────────

  return NextResponse.json(
    {
      asset,
      writeBackErrors: writeBackErrors.length > 0 ? writeBackErrors : undefined,
    },
    { status: 200 },
  );
}
