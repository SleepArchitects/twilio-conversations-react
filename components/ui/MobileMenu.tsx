"use client";

import Link from "next/link";
import { useState } from "react";
import UserDropdown from "./UserDropdown";
import { MenuIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import type { Auth0User } from "@/hooks/useAuth";
import {
  useHasRole,
  useCurrentUserRoles,
  useAllRoles,
} from "@/hooks/useCurrentUserRoles";

export default function MobileMenu({
  user,
  profileImageUrl,
}: {
  // Accept null from upstream (useUser can yield null) to satisfy ClientHeader usage
  user?: Auth0User | null;
  profileImageUrl?: string | null;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [manageExpanded, setManageExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  const { user: authUser } = useAuth();

  // Use Auth0 user if available, otherwise use passed user prop
  const currentUser = authUser || user;

  // Trigger role fetching on mount
  useCurrentUserRoles();
  useAllRoles();

  // Navigation role checks
  const hasPatients = useHasRole(["Patients", "iSleep"]); // iSleep grants patient chart access
  const hasTraining = useHasRole("Trianing"); // Note: typo in database
  const hasAlora = useHasRole("Alora");

  // Manage dropdown role checks
  const hasManageCharts = useHasRole("Manage Charts");
  const hasManageVOB = useHasRole("Manage VOB");
  const hasManageHST = useHasRole("Manage HST");
  const hasManagePreauth = useHasRole("Manage PreAuth");
  const hasManagePrezo = useHasRole("Manage Prezo");
  const hasManageConsult = useHasRole("Manage Consult");
  const hasManageTreatment = useHasRole("Manage Treatment");
  const hasManagePayers = useHasRole("Manage Payers");

  // Admin dropdown role checks
  const hasTenants = useHasRole("Manage Tenants");
  const hasPractices = useHasRole("Manage Practices");
  const hasPeople = useHasRole("Manage People");
  const hasAssets = useHasRole("Manage Assets");
  const hasRoles = useHasRole("Manage Roles");
  const hasPermissions = useHasRole("Manage Permissions");
  const hasLabsShortcut = useHasRole("Labs"); // Labs role for experimental features and development tools
  const hasSupportTickets = useHasRole("Task Center"); // Task Center access

  // Check if user has any manage or admin access
  const hasAnyManageAccess =
    hasManageCharts ||
    hasManageVOB ||
    hasManageHST ||
    hasManagePreauth ||
    hasManagePrezo ||
    hasManageConsult ||
    hasManageTreatment ||
    hasManagePayers;

  const hasAnyAdminAccess =
    hasTenants ||
    hasPractices ||
    hasPeople ||
    hasAssets ||
    hasRoles ||
    hasPermissions ||
    hasLabsShortcut ||
    hasSupportTickets;

  const closeMenu = () => {
    setIsMenuOpen(false);
    setManageExpanded(false);
    setAdminExpanded(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        aria-controls="navbar-hamburger"
        aria-expanded={isMenuOpen}
        className="inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600 lg:hidden"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        type="button"
      >
        <span className="sr-only">Open main menu</span>
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* Mobile menu */}
      <div
        className={`${isMenuOpen ? "block" : "hidden"} absolute left-0 top-[72px] z-10 w-full bg-white dark:bg-gray-900 lg:hidden max-h-[calc(100vh-72px)] overflow-y-auto`}
        id="navbar-hamburger"
      >
        {/* Mobile actions */}
        <div className="flex items-center justify-center border-b border-gray-200 p-4 dark:border-gray-700">
          <UserDropdown
            isMobile={true}
            user={currentUser}
            profileImageUrl={profileImageUrl}
          />
        </div>

        {/* Mobile navigation links */}
        <ul className="flex flex-col font-medium">
          {/* Always visible */}
          <li>
            <Link
              className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
              href="/dashboard"
              onClick={closeMenu}
            >
              Dashboard
            </Link>
          </li>

          {/* Always visible */}
          <li>
            <Link
              className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
              href="/history"
              onClick={closeMenu}
            >
              History
            </Link>
          </li>

          {/* Role-based: Patients */}
          {hasPatients && (
            <li>
              <Link
                className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                href="/patients"
                onClick={closeMenu}
              >
                Patients
              </Link>
            </li>
          )}

          {/* Always visible */}
          <li>
            <Link
              className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
              href="/support"
              onClick={closeMenu}
            >
              Support
            </Link>
          </li>

          {/* Role-based: Training */}
          {hasTraining && (
            <li>
              <Link
                className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                href="/training"
                onClick={closeMenu}
              >
                Training
              </Link>
            </li>
          )}

          {/* Role-based: Alora */}
          {hasAlora && (
            <li>
              <Link
                className="block border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                href="/bot"
                onClick={closeMenu}
              >
                Alora
              </Link>
            </li>
          )}

          {/* Manage Section - Collapsible */}
          {hasAnyManageAccess && (
            <li>
              <button
                className="flex w-full items-center justify-between border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                onClick={() => setManageExpanded(!manageExpanded)}
                type="button"
              >
                <span className="font-semibold">Manage</span>
                {manageExpanded ? (
                  <ChevronUpIcon className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5" />
                )}
              </button>

              {manageExpanded && (
                <ul className="bg-gray-50 dark:bg-gray-800">
                  {hasManageCharts && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-charts"
                        onClick={closeMenu}
                      >
                        Charts
                      </Link>
                    </li>
                  )}
                  {hasManageVOB && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-vob"
                        onClick={closeMenu}
                      >
                        VOB
                      </Link>
                    </li>
                  )}
                  {hasManageHST && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-hst"
                        onClick={closeMenu}
                      >
                        HST
                      </Link>
                    </li>
                  )}
                  {hasManagePreauth && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-preauth"
                        onClick={closeMenu}
                      >
                        Preauth
                      </Link>
                    </li>
                  )}
                  {hasManagePrezo && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-prezo"
                        onClick={closeMenu}
                      >
                        Prezo
                      </Link>
                    </li>
                  )}
                  {hasManageConsult && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-consult"
                        onClick={closeMenu}
                      >
                        Consult
                      </Link>
                    </li>
                  )}
                  {hasManageTreatment && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-treatment"
                        onClick={closeMenu}
                      >
                        Treatment
                      </Link>
                    </li>
                  )}
                  {hasManagePayers && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/admin/manage-payers"
                        onClick={closeMenu}
                      >
                        Payers
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )}

          {/* Admin Section - Collapsible */}
          {hasAnyAdminAccess && (
            <li>
              <button
                className="flex w-full items-center justify-between border-b border-gray-100 py-2 pl-3 pr-4 text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700"
                onClick={() => setAdminExpanded(!adminExpanded)}
                type="button"
              >
                <span className="font-semibold">Admin</span>
                {adminExpanded ? (
                  <ChevronUpIcon className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5" />
                )}
              </button>

              {adminExpanded && (
                <ul className="bg-gray-50 dark:bg-gray-800">
                  {hasTenants && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/organizations"
                        onClick={closeMenu}
                      >
                        Tenants
                      </Link>
                    </li>
                  )}
                  {hasPractices && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/practices"
                        onClick={closeMenu}
                      >
                        Practices
                      </Link>
                    </li>
                  )}
                  {hasPeople && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/people"
                        onClick={closeMenu}
                      >
                        People
                      </Link>
                    </li>
                  )}
                  {hasAssets && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/assets"
                        onClick={closeMenu}
                      >
                        Assets
                      </Link>
                    </li>
                  )}
                  {hasRoles && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/roles"
                        onClick={closeMenu}
                      >
                        Roles
                      </Link>
                    </li>
                  )}
                  {hasPermissions && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/permissions"
                        onClick={closeMenu}
                      >
                        Permissions
                      </Link>
                    </li>
                  )}
                  {hasSupportTickets && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/task-center"
                        onClick={closeMenu}
                      >
                        Task Center
                      </Link>
                    </li>
                  )}
                  {hasLabsShortcut && (
                    <li>
                      <Link
                        className="block border-b border-gray-100 py-2 pl-8 pr-4 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        href="/labs"
                        onClick={closeMenu}
                      >
                        Labs
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
