"use client";

import { Dropdown, DropdownHeader, DropdownItem } from "flowbite-react";
import Link from "next/link";
import { ClipboardIcon } from "@/components/icons";
import {
  useHasRole,
  useCurrentUserRoles,
  useAllRoles,
} from "@/hooks/useCurrentUserRoles";
import { customDropdownTheme } from "@/lib/flowbite-theme";

export default function ManageDropdown() {
  // Trigger role fetching on mount
  useCurrentUserRoles();
  useAllRoles();

  // Role checks for manage items
  const hasManageCharts = useHasRole("Manage Charts");
  const hasManageVOB = useHasRole("Manage VOB");
  const hasManageHST = useHasRole("Manage HST");
  const hasManagePreauth = useHasRole("Manage PreAuth"); // Match database role name
  const hasManagePrezo = useHasRole("Manage Prezo");
  const hasManageConsult = useHasRole("Manage Consult");
  const hasManageTreatment = useHasRole("Manage Treatment");
  const hasManagePayers = useHasRole("Manage Payers");

  // Hide entire dropdown if user has no access to any manage items
  const hasAnyManageAccess =
    hasManageCharts ||
    hasManageVOB ||
    hasManageHST ||
    hasManagePreauth ||
    hasManagePrezo ||
    hasManageConsult ||
    hasManageTreatment ||
    hasManagePayers;

  if (!hasAnyManageAccess) {
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
            <span className="sr-only">Manage menu</span>
            <ClipboardIcon className="h-6 w-6" />
          </div>
        }
      >
        <DropdownHeader>
          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
            Manage
          </span>
        </DropdownHeader>
        {hasManageCharts && (
          <DropdownItem as={Link} href="/admin/manage-charts">
            Charts
          </DropdownItem>
        )}
        {hasManageVOB && (
          <DropdownItem as={Link} href="/admin/manage-vob">
            VOB
          </DropdownItem>
        )}
        {hasManageHST && (
          <DropdownItem as={Link} href="/admin/manage-hst">
            HST
          </DropdownItem>
        )}
        {hasManagePreauth && (
          <DropdownItem as={Link} href="/admin/manage-preauth">
            Preauth
          </DropdownItem>
        )}
        {hasManagePrezo && (
          <DropdownItem as={Link} href="/admin/manage-prezo">
            Prezo
          </DropdownItem>
        )}
        {hasManageConsult && (
          <DropdownItem as={Link} href="/admin/manage-consult">
            Consult
          </DropdownItem>
        )}
        {hasManageTreatment && (
          <DropdownItem as={Link} href="/admin/manage-treatment">
            Treatment
          </DropdownItem>
        )}
        {hasManagePayers && (
          <DropdownItem as={Link} href="/admin/manage-payers">
            Payers
          </DropdownItem>
        )}
      </Dropdown>
    </div>
  );
}
