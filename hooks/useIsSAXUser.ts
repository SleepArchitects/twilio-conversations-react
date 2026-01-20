import { useCurrentUserRoles, useAllRoles } from "./useCurrentUserRoles";
import { useMemo } from "react";
import type { UserRole } from "@/utils/userAssignedRoles/fetchUserRoles";
import type { Role } from "@/components/roles/types";

/**
 * The role name that identifies SAX employees/staff
 * We look this up dynamically from the roles list instead of hardcoding the ID
 */
export const SAX_ROLE_NAME = "Sax";

/**
 * Hook to check if the current logged-in user has the "Sax" role
 *
 * IMPORTANT: This check does NOT bypass for Super Admin
 * User must have the specific "Sax" role to access the Outreach application
 *
 * This is a security requirement - only SAX employees should have access
 * to the Outreach/SMS messaging functionality.
 */
export function useIsSAXUser() {
  const { data: userRoles, isLoading: userRolesLoading } =
    useCurrentUserRoles();
  const { data: allRoles, isLoading: allRolesLoading } = useAllRoles();

  // Combine loading states - if either is loading, we're still loading
  const isLoading = userRolesLoading || allRolesLoading;

  const hasSaxRole = useMemo(() => {
    // First try to use the fetched data
    let userRolesList = userRoles;
    let allRolesList = allRoles;

    // Fallback to localStorage if data not yet loaded
    if (!userRolesList && typeof window !== "undefined") {
      const cachedUserRoles = localStorage.getItem("user_roles");
      if (cachedUserRoles) {
        try {
          userRolesList = JSON.parse(cachedUserRoles);
        } catch {
          console.error("[useIsSAXUser] Failed to parse cached user_roles");
        }
      }
    }

    if (!allRolesList && typeof window !== "undefined") {
      const cachedAllRoles = localStorage.getItem("all_roles");
      if (cachedAllRoles) {
        try {
          allRolesList = JSON.parse(cachedAllRoles);
        } catch {
          console.error("[useIsSAXUser] Failed to parse cached all_roles");
        }
      }
    }

    if (!userRolesList || !allRolesList) {
      console.log("[useIsSAXUser] No roles loaded yet:", {
        hasUserRoles: !!userRolesList,
        hasAllRoles: !!allRolesList,
      });
      return false;
    }

    // Find the SAX role by name (case-insensitive)
    const saxRole = allRolesList.find(
      (r: Role) =>
        r.name.toLowerCase() === SAX_ROLE_NAME.toLowerCase() && r.active,
    );

    if (!saxRole) {
      console.log("[useIsSAXUser] SAX role not found in all roles");
      return false;
    }

    // Filter to only active user roles
    const activeUserRoles = userRolesList.filter((r: UserRole) => r.active);

    console.log("[useIsSAXUser] DEBUG - Role check:", {
      totalUserRoles: userRolesList.length,
      activeUserRoles: activeUserRoles.length,
      saxRoleId: saxRole.role_id,
      saxRoleName: saxRole.name,
    });

    // Check if user has the SAX role by ID (looked up dynamically)
    // NOTE: We do NOT bypass for Super Admin here - must have explicit Sax role
    const hasSax = activeUserRoles.some(
      (ur: UserRole) => ur.role_id === saxRole.role_id,
    );

    console.log("[useIsSAXUser] Final result:", { hasSax });
    return hasSax;
  }, [userRoles, allRoles]);

  return {
    data: hasSaxRole,
    isLoading,
  };
}

/**
 * Synchronous check for SAX role using localStorage
 * Useful for initial checks before React hooks are available
 *
 * @returns true if user has the SAX role, false otherwise
 */
export function checkIsSAXUserFromStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const cachedUserRoles = localStorage.getItem("user_roles");
    const cachedAllRoles = localStorage.getItem("all_roles");

    if (!cachedUserRoles || !cachedAllRoles) {
      console.log("[checkIsSAXUserFromStorage] Missing roles in localStorage");
      return false;
    }

    const userRoles: UserRole[] = JSON.parse(cachedUserRoles);
    const allRoles: Role[] = JSON.parse(cachedAllRoles);

    // Find the SAX role by name
    const saxRole = allRoles.find(
      (r) => r.name.toLowerCase() === SAX_ROLE_NAME.toLowerCase() && r.active,
    );

    if (!saxRole) {
      console.log("[checkIsSAXUserFromStorage] SAX role not found");
      return false;
    }

    const activeRoles = userRoles.filter((r) => r.active);
    const hasSax = activeRoles.some((r) => r.role_id === saxRole.role_id);

    console.log("[checkIsSAXUserFromStorage] Result:", {
      totalRoles: userRoles.length,
      activeRoles: activeRoles.length,
      saxRoleId: saxRole.role_id,
      hasSax,
    });

    return hasSax;
  } catch (error) {
    console.error("[checkIsSAXUserFromStorage] Error:", error);
    return false;
  }
}
