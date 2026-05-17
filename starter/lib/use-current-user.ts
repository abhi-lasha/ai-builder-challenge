"use client";

/**
 * Hook that reads the current user from the role cookie.
 *
 * The cookie is client-only (document.cookie), so we initialise from it
 * after mount to avoid a hydration mismatch.
 */

import { useState, useEffect } from "react";
import { getCurrentUserId, getRole, type Role } from "@/lib/auth";

export type CurrentUser = {
  userId: string;
  role: Role;
  /** True on the server render and first client frame — use to avoid flash. */
  loading: boolean;
};

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    userId: "tech-jane",
    role: "tech",
    loading: true,
  });

  useEffect(() => {
    setState({
      userId: getCurrentUserId(),
      role: getRole(),
      loading: false,
    });
  }, []);

  return state;
}
