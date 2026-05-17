/**
 * Form element class constants.
 *
 * Labels, inputs, selects, and fieldsets share a consistent look across all
 * four scan workflow pages. Defining them once here means a single edit
 * updates every form in the app.
 *
 * Note: JSX (e.g. the required asterisk markup) stays in components — this
 * file is pure strings so it can be imported anywhere without a JSX transform.
 */
import { focusRing } from "./focus";

/** Field label above an input. */
export const label =
  "block text-sm font-medium text-gray-700 mb-1";

/** Compact label used in filter bars and secondary forms. */
export const labelSm =
  "block text-xs font-medium text-gray-600 mb-1";

/** Standard single-line text / number input. */
export const input =
  `w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 ${focusRing} focus:border-blue-600 min-h-[44px]`;

/** Select / dropdown — same geometry as input. */
export const select =
  `w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${focusRing} focus:border-blue-600 min-h-[36px]`;

/** Visually groups a set of related inputs (e.g. the location fields). */
export const fieldset =
  "rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3";
