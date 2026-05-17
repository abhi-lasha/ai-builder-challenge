import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/api-client";

/**
 * POST /api/scans/store
 *
 * Server-side wrapper around the upstream store scan.
 * When storing an asset that was previously in_service (de-racking),
 * removes it from Facilities by setting rack_location: null.
 *
 * Store from received state does NOT write to Facilities — those assets
 * were never racked, so there's nothing to remove.
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

  const { asset_tag, location, user_id, scan_payload, from_state } = body as {
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
    from_state?: string; // client tells us the asset's state before this scan
  };

  if (!asset_tag || !location || !user_id || !scan_payload) {
    return NextResponse.json(
      { error: { code: "invalid_payload", message: "Missing required fields." } },
      { status: 400 },
    );
  }

  // ── 1. Call upstream store ───────────────────────────────────────────────

  let asset;
  try {
    asset = await api.scans.store({
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
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code ?? "internal_error";
    const message = (err as Error).message ?? "Upstream store failed.";
    const details = (err as { details?: unknown }).details;

    return NextResponse.json(
      { error: { code, message, details } },
      { status },
    );
  }

  // ── 2. Facilities write-back (only when de-racking from in_service) ──────

  const writeBackErrors: string[] = [];

  if (from_state === "in_service") {
    try {
      await api.mock.updateFacilities({
        tagged_id: asset_tag,
        rack_location: null, // null removes the row from Facilities
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[store] Facilities de-rack write-back failed for ${asset_tag}:`, msg);
      writeBackErrors.push(`facilities: ${msg}`);
    }
  }

  return NextResponse.json(
    {
      asset,
      writeBackErrors: writeBackErrors.length > 0 ? writeBackErrors : undefined,
    },
    { status: 200 },
  );
}
