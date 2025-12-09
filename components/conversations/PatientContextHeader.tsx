"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPatientDob, formatPatientName } from "@/lib/format";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface PatientContextHeaderProps {
  /** Patient's SAX ID for profile link */
  patientId: string;
  /** Patient's first name */
  firstName: string | null;
  /** Patient's last name */
  lastName: string | null;
  /** Patient's date of birth (ISO 8601) */
  dateOfBirth: string | null;
  /** Optional className for styling */
  className?: string;
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/** User icon for patient name display */
function UserIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  );
}

/** Calendar icon for DOB display */
function CalendarIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** External link icon for profile link */
function ArrowTopRightOnSquareIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5ZM6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// PatientContextHeader Component
// =============================================================================

/**
 * Patient Context Header Component
 *
 * Displays patient clinical context at the top of a conversation view.
 * Shows patient name, date of birth, and link to patient profile in SleepConnect.
 *
 * Uses hard navigation (<a href>) for cross-zone navigation per NFR-005.
 *
 * @see FR-039 - Patient context display in conversation header
 * @see FR-040 - Cross-zone navigation to patient profile
 * @see T200 - Patient context header implementation
 */
export function PatientContextHeader({
  patientId,
  firstName,
  lastName,
  dateOfBirth,
  className,
}: PatientContextHeaderProps) {
  const patientName = formatPatientName(firstName, lastName);

  // Format DOB for display
  let formattedDob: string | null = null;
  if (dateOfBirth) {
    try {
      formattedDob = formatPatientDob(dateOfBirth);
    } catch (error) {
      console.error("Error formatting patient DOB:", error);
      formattedDob = null;
    }
  }

  // Patient profile URL - uses hard navigation for cross-zone (SleepConnect)
  // Patient profile is in the main SleepConnect zone, not /outreach
  const profileUrl = `/patients/${patientId}`;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        "bg-blue-900/20 border-b border-blue-800/50",
        className,
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Patient Name */}
        <div className="flex items-center gap-2 min-w-0">
          <UserIcon
            className="text-blue-400 flex-shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {patientName}
            </p>
            <p className="text-xs text-gray-400">Patient</p>
          </div>
        </div>

        {/* Date of Birth */}
        {formattedDob && (
          <>
            <div
              className="h-8 w-px bg-gray-700 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <CalendarIcon
                className="text-blue-400 flex-shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm text-gray-300">{formattedDob}</p>
                <p className="text-xs text-gray-500">DOB</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Profile Link - Cross-Zone Navigation */}
      <a
        href={profileUrl}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
          "text-blue-300 bg-blue-900/30 border border-blue-700/50",
          "hover:bg-blue-900/50 hover:border-blue-600/50 hover:text-blue-200",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900",
          "transition-all flex-shrink-0",
        )}
      >
        View Profile
        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}

export default PatientContextHeader;
