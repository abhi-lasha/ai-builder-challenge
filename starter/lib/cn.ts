/**
 * cn — merge Tailwind classes safely.
 *
 * Combines clsx (conditional class joining) with tailwind-merge (conflict
 * resolution). This means later classes win when two utilities target the
 * same CSS property:
 *
 *   cn("px-2 py-1", "px-4")  →  "py-1 px-4"   ✓
 *   clsx("px-2 py-1", "px-4") →  "px-2 py-1 px-4"  ✗ (both applied, last wins but bloated)
 *
 * Use this wherever class names are composed conditionally or merged from
 * a base + override pattern.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
