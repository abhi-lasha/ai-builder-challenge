"use client";

import { useEffect, useState } from "react";
import { getRole, setRole, type Role } from "@/lib/auth";

export function RoleSwitcher() {
  const [role, setRoleState] = useState<Role>("tech");

  useEffect(() => {
    // Derive the current role from the URL — the pathname is the ground truth.
    // A stored preference that contradicts where the user actually is would
    // show the wrong label (e.g. "Switch to manager view" while on /manager).
    const fromPath = window.location.pathname.startsWith("/manager")
      ? "manager"
      : window.location.pathname.startsWith("/tech")
        ? "tech"
        : getRole(); // "/" or unknown — fall back to stored preference
    setRoleState(fromPath);
    setRole(fromPath); // keep storage in sync
  }, []);

  function handleClick(): void {
    const next: Role = role === "tech" ? "manager" : "tech";
    setRole(next);
    setRoleState(next);
    // Navigate to the new role's home — reloading in place would keep the
    // user on a page that belongs to the old role (e.g. /manager/reconcile
    // while now acting as a tech).
    window.location.href = next === "tech" ? "/tech" : "/manager";
  }

  const label =
    role === "tech" ? "Switch to manager view" : "Switch to tech view";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 min-h-[44px]"
      aria-label={label}
    >
      <span className="text-gray-500 mr-2">role: {role}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
