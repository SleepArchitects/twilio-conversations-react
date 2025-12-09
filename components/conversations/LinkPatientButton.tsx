"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatPhoneNumber, formatDisplayPhoneNumber } from "@/lib/validation";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface LinkPatientButtonProps {
  /** Conversation ID to link patient to */
  conversationId: string;
  /** Callback when patient is successfully linked */
  onPatientLinked?: (patientId: string) => void;
  /** Optional className for styling */
  className?: string;
}

/** Patient record from SleepConnect /api/patients endpoint */
interface Patient {
  people_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  dob?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PATIENT_SEARCH_DEBOUNCE_MS = 300;
const PATIENT_SEARCH_MIN_CHARS = 2;

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function LinkIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
    </svg>
  );
}

function SearchIcon({ className, ...props }: IconProps) {
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
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-5 w-5 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="45 30"
      />
    </svg>
  );
}

function CloseIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

// =============================================================================
// LinkPatientButton Component
// =============================================================================

/**
 * Link Patient Button Component
 *
 * Shows when a conversation is not linked to a patient record.
 * Allows coordinators to search for and link a patient to the conversation.
 *
 * Uses patient search API from SleepConnect: GET /api/patients?search=
 *
 * @see FR-041 - Link patient to conversation
 * @see T201 - Link patient button implementation
 */
export function LinkPatientButton({
  conversationId,
  onPatientLinked,
  className,
}: LinkPatientButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Patient[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isLinking, setIsLinking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Focus search input when modal opens
  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isDropdown = dropdownRef.current?.contains(target);
      const isSearchInput = searchInputRef.current?.contains(target);

      if (!isDropdown && !isSearchInput && searchResults.length > 0) {
        setSearchResults([]);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, searchResults.length]);

  // Search for patients
  const searchPatients = React.useCallback(async (query: string) => {
    if (query.length < PATIENT_SEARCH_MIN_CHARS) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Call SleepConnect's patient API endpoint directly (cross-zone call)
      const searchParams = new URLSearchParams({ search: query });
      const response = await fetch(`/api/patients?${searchParams.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Patient search failed: ${response.status}`);
      }

      const data = (await response.json()) as Patient[];
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error searching patients:", err);
      setError("Failed to search patients. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search input with debounce
  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchQuery(value);
      setError(null);

      // Clear previous debounce
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      // Debounce the search
      searchDebounceRef.current = setTimeout(() => {
        searchPatients(value);
      }, PATIENT_SEARCH_DEBOUNCE_MS);
    },
    [searchPatients],
  );

  // Link patient to conversation
  const handlePatientSelect = React.useCallback(
    async (patient: Patient) => {
      setIsLinking(true);
      setError(null);

      try {
        // Call API to link patient to conversation
        await api.patch(
          `/api/outreach/conversations/${conversationId}/patient`,
          {
            patient_id: patient.people_id,
          },
        );

        // Success - close modal and notify parent
        setIsOpen(false);
        setSearchQuery("");
        setSearchResults([]);
        onPatientLinked?.(patient.people_id);
      } catch (err) {
        console.error("Error linking patient:", err);
        setError("Failed to link patient. Please try again.");
      } finally {
        setIsLinking(false);
      }
    },
    [conversationId, onPatientLinked],
  );

  // Close modal
  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
  }, []);

  if (!isOpen) {
    return (
      <div
        className={cn(
          "flex items-center justify-center px-4 py-3",
          "bg-yellow-900/20 border-b border-yellow-800/50",
          className,
        )}
      >
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
            "text-yellow-300 bg-yellow-900/30 border border-yellow-700/50",
            "hover:bg-yellow-900/50 hover:border-yellow-600/50 hover:text-yellow-200",
            "focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-900",
            "transition-all",
          )}
        >
          <LinkIcon className="h-4 w-4" aria-hidden="true" />
          Link Patient
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-4 py-3 bg-yellow-900/20 border-b border-yellow-800/50",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="relative">
            <SearchIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search patient to link..."
              disabled={isLinking}
              className={cn(
                "w-full pl-10 pr-10 py-2 rounded-lg text-sm",
                "bg-gray-900 text-white placeholder:text-gray-500",
                "border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <SpinnerIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-20 w-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto"
            >
              {searchResults.map((patient) => (
                <button
                  key={patient.people_id}
                  type="button"
                  onClick={() => handlePatientSelect(patient)}
                  disabled={isLinking}
                  className={cn(
                    "w-full px-4 py-2.5 text-left",
                    "hover:bg-gray-700 focus:bg-gray-700 focus:outline-none",
                    "transition-colors border-b border-gray-700 last:border-b-0",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {patient.first_name} {patient.last_name}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-gray-400">{patient.email}</p>
                      )}
                    </div>
                    {patient.phone && (
                      <span className="text-xs text-gray-400 tabular-nums">
                        {formatDisplayPhoneNumber(
                          formatPhoneNumber(patient.phone),
                        ) || patient.phone}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {searchQuery.length >= PATIENT_SEARCH_MIN_CHARS &&
            searchResults.length === 0 &&
            !isSearching && (
              <div className="absolute z-20 w-full mt-1 bg-gray-900 border border-gray-600 rounded-lg shadow-xl">
                <p className="px-4 py-3 text-sm text-gray-400">
                  No patients found
                </p>
              </div>
            )}
        </div>

        <button
          onClick={handleClose}
          disabled={isLinking}
          className={cn(
            "p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-gray-500",
            "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          aria-label="Cancel"
        >
          <CloseIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default LinkPatientButton;
