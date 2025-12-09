"use client";

import { useState, useEffect } from "react";
import {
  useHasRole,
  useCurrentUserRoles,
  useAllRoles,
} from "@/hooks/useCurrentUserRoles";

/**
 * Navigation menu with role-based access control
 * Always shows: Dashboard, History, Support
 * Role-based: Patients (before Support), Training, Alora
 */
export default function NavMenu() {
  const [mounted, setMounted] = useState(false);

  // Trigger role fetching on mount
  useCurrentUserRoles();
  useAllRoles();

  const hasPatients = useHasRole(["Patients", "iSleep"]); // iSleep grants patient chart access
  const hasTraining = useHasRole("Trianing"); // Note: typo in database
  const hasAlora = useHasRole("Alora");

  // Only show role-based items after hydration to prevent mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ul className="mt-4 flex flex-col font-medium lg:mt-0 lg:flex-row lg:space-x-8 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="flex lg:ml-0 lg:flex-row lg:space-x-8">
        {/* Always visible */}
        <li>
          <a
            className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/dashboard`}
          >
            Dashboard
          </a>
        </li>

        {/* Always visible */}
        <li>
          <a
            className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/history`}
          >
            History
          </a>
        </li>

        {/* Role-based: Patients */}
        {mounted && hasPatients && (
          <li>
            <a
              className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
              href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/patients`}
            >
              Patients
            </a>
          </li>
        )}

        {/* Always visible */}
        <li>
          <a
            className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/support`}
          >
            Support
          </a>
        </li>

        {/* Role-based: Training */}
        {mounted && hasTraining && (
          <li>
            <a
              className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
              href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/training`}
            >
              Training
            </a>
          </li>
        )}

        {/* Role-based: Alora */}
        {mounted && hasAlora && (
          <li>
            <a
              className="block rounded py-2 pl-3 pr-4 text-gray-900 hover:text-purple-600 dark:text-white dark:hover:text-purple-400 lg:p-0"
              href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/bot`}
            >
              Alora
            </a>
          </li>
        )}
      </div>
    </ul>
  );
}
