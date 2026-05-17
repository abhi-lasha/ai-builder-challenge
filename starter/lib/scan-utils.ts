/**
 * Utilities for parsing and validating barcode payloads.
 *
 * Location barcode format (our convention):
 *   LOC|<site>|<room>|<row>|<rack>|<ru>
 *
 * Missing fields are empty strings between pipes. Examples:
 *   Full deploy:  LOC|SVL|LAB-B|ROW-2|RACK-4|12
 *   Storage:      LOC|SVL|STORAGE-A|||
 *   Minimal:      LOC|SVL||||
 *
 * Badge format: any non-empty string that isn't a tag or location.
 * Common values from the seed data: tech-jane, manager-paul, tech-mike, etc.
 */

import type { Location } from "@/lib/types";

const ASSET_TAG_RE = /^C\d{7}$/;
const LOCATION_PREFIX = "LOC|";

/** Returns true if the value looks like an asset tag (C followed by 7 digits). */
export function isAssetTag(value: string): boolean {
  return ASSET_TAG_RE.test(value.trim());
}

/** Returns true if the value looks like a location barcode. */
export function isLocationBarcode(value: string): boolean {
  return value.trim().startsWith(LOCATION_PREFIX);
}

/**
 * Returns true if the value looks like a badge / user ID.
 * Badges are anything that isn't a tag or location — we don't validate the
 * exact format because the API accepts any string as to_custodian.
 */
export function isBadgeId(value: string): boolean {
  const v = value.trim();
  return !isAssetTag(v) && !isLocationBarcode(v) && v.length > 0;
}

/**
 * Parses a location barcode string into a Location object.
 * Returns null if the barcode doesn't match the LOC| prefix format.
 *
 * Field order after prefix: site | room | row | rack | ru
 * Empty segments become null (the API expects null, not "").
 */
export function parseLocationBarcode(raw: string): Location | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(LOCATION_PREFIX)) return null;

  const payload = trimmed.slice(LOCATION_PREFIX.length);
  const parts = payload.split("|");

  const toNullable = (s: string | undefined): string | null =>
    s && s.trim() ? s.trim() : null;

  return {
    site: toNullable(parts[0]) ?? "",
    room: toNullable(parts[1]),
    row: toNullable(parts[2]),
    rack: toNullable(parts[3]),
    ru: toNullable(parts[4]),
  };
}

/**
 * Encodes a Location into the LOC| barcode format.
 * Used by the /dev/barcodes page to generate scannable codes.
 */
export function encodeLocationBarcode(loc: Location): string {
  return [
    LOCATION_PREFIX + (loc.site ?? ""),
    loc.room ?? "",
    loc.row ?? "",
    loc.rack ?? "",
    loc.ru ?? "",
  ].join("|");
}

/**
 * Returns a human-readable string for a location.
 * Omits null segments.
 */
export function formatLocation(loc: Location | null | undefined): string {
  if (!loc) return "—";
  const parts = [loc.site, loc.room, loc.row, loc.rack, loc.ru ? `RU ${loc.ru}` : null];
  return parts.filter(Boolean).join(" › ") || "—";
}

/**
 * Validates that a location has all fields required for a deploy scan.
 * Returns the first missing field name, or null if valid.
 */
export function getMissingDeployField(
  loc: Location,
): "site" | "room" | "rack" | "ru" | null {
  if (!loc.site) return "site";
  if (!loc.room) return "room";
  if (!loc.rack) return "rack";
  if (!loc.ru) return "ru";
  return null;
}

/**
 * Detects likely scan mistakes — e.g. scanning an asset tag into a location
 * field, or a location barcode into a badge field.
 */
export type ScanMistake =
  | { kind: "asset_tag_in_location_field" }
  | { kind: "asset_tag_in_badge_field" }
  | { kind: "location_in_badge_field" };

export function detectScanMistake(
  value: string,
  expectedField: "location" | "badge",
): ScanMistake | null {
  const v = value.trim();
  if (expectedField === "location") {
    if (isAssetTag(v)) return { kind: "asset_tag_in_location_field" };
  }
  if (expectedField === "badge") {
    if (isAssetTag(v)) return { kind: "asset_tag_in_badge_field" };
    if (isLocationBarcode(v)) return { kind: "location_in_badge_field" };
  }
  return null;
}
