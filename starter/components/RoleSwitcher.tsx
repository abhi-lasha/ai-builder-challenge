"use client";

import { usePathname } from "next/navigation";
import { setRole, type Role } from "@/lib/auth";

export function RoleSwitcher() {
  const pathname = usePathname();

  // Landing page has its own role entry points — switcher is redundant there
  if (pathname === "/") return null;

  // Derive role directly from the URL — no state, no flash, always correct.
  // The layout keeps this component mounted across navigations so useState
  // would go stale; pathname from usePathname() updates reactively.
  const role: Role = pathname.startsWith("/manager") ? "manager" : "tech";
  const next: Role = role === "manager" ? "tech" : "manager";
  const label = role === "manager" ? "Switch to tech view" : "Switch to manager view";

  function handleClick(): void {
    setRole(next);
    window.location.href = next === "tech" ? "/tech" : "/manager";
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 min-h-[44px]"
      aria-label={label}
    >
      {label}
    </button>
  );
}
