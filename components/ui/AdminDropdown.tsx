"use client";

import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from "flowbite-react";
import Link from "next/link";
import { AdminMenuIcon } from "@/components/icons";
import {
  useHasRole,
  useCurrentUserRoles,
  useAllRoles,
} from "@/hooks/useCurrentUserRoles";
import { customDropdownTheme } from "@/lib/flowbite-theme";

export default function AdminDropdown() {
  // Trigger role fetching on mount
  useCurrentUserRoles();
  useAllRoles();

  // Role checks for admin items (using "Manage X" role names)
  const hasTenants = useHasRole("Manage Tenants");
  const hasPractices = useHasRole("Manage Practices");
  const hasPeople = useHasRole("Manage People");
  const hasAssets = useHasRole("Manage Assets");
  const hasRoles = useHasRole("Manage Roles");
  const hasPermissions = useHasRole("Manage Permissions");
  const hasLabsShortcut = useHasRole("Labs"); // Labs role for experimental features and development tools
  const hasSupportTickets = useHasRole("Task Center"); // Task Center access

  // Hide entire dropdown if user has no access to any admin items
  const hasAnyAdminAccess =
    hasTenants ||
    hasPractices ||
    hasPeople ||
    hasAssets ||
    hasRoles ||
    hasPermissions ||
    hasLabsShortcut ||
    hasSupportTickets;

  if (!hasAnyAdminAccess) {
    return null;
  }

  return (
    <div>
      <Dropdown
        arrowIcon={false}
        inline
        theme={customDropdownTheme}
        label={
          <div className="cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-purple-50 focus:outline-none focus:ring-0 dark:text-gray-400 dark:hover:bg-purple-900/30 transition-colors">
            <span className="sr-only">Admin menu</span>
            <AdminMenuIcon className="h-6 w-6" />
          </div>
        }
      >
        <DropdownHeader>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            Admin
          </span>
        </DropdownHeader>
        {hasTenants && (
          <DropdownItem as={Link} href="/organizations">
            Tenants
          </DropdownItem>
        )}
        {hasPractices && (
          <DropdownItem as={Link} href="/practices">
            Practices
          </DropdownItem>
        )}
        {hasPeople && (
          <DropdownItem as={Link} href="/people">
            People
          </DropdownItem>
        )}
        {hasAssets && (
          <DropdownItem as={Link} href="/assets">
            Assets
          </DropdownItem>
        )}
        {hasRoles && (
          <DropdownItem as={Link} href="/roles">
            Roles
          </DropdownItem>
        )}
        {hasPermissions && (
          <DropdownItem as={Link} href="/permissions">
            Permissions
          </DropdownItem>
        )}
        {hasSupportTickets && (
          <>
            <DropdownDivider />
            <DropdownItem as={Link} href="/task-center">
              Task Center
            </DropdownItem>
          </>
        )}
        {hasLabsShortcut && (
          <>
            <DropdownDivider />
            <DropdownItem as={Link} href="/labs">
              Labs
            </DropdownItem>
          </>
        )}
      </Dropdown>
    </div>
  );
}
