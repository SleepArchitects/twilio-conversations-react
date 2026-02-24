"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  options: Array<{ value: string; label: string }>;
  value?: string;
  onSelect: (value: string) => void;
  onCreateNew?: (name: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export function CategorySelect({
  options,
  value,
  onSelect,
  onCreateNew,
  placeholder = "Select...",
  disabled = false,
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || placeholder;

  // Capitalize first letter of a string
  const capitalizeFirstLetter = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchValue.toLowerCase()),
  );

  const handleSelect = (optionValue: string) => {
    onSelect(optionValue);
    setIsOpen(false);
    setSearchValue("");
  };

  const canCreateNew =
    onCreateNew &&
    searchValue &&
    !options.some((o) => o.label.toLowerCase() === searchValue.toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          // Layout
          "flex h-10 w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm",
          // Visual - light mode
          "border border-gray-300 bg-gray-50 text-gray-900",
          // Visual - dark mode
          "dark:border-gray-600 dark:bg-gray-700 dark:text-white",
          // Focus states
          "focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:focus:border-blue-500 dark:focus:ring-blue-500",
          // Interactive states
          "disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          isOpen && "ring-2 ring-blue-500 border-blue-500",
        )}
      >
        <span className={cn(!value && "text-gray-500 dark:text-gray-400")}>
          {value ? capitalizeFirstLetter(selectedLabel) : selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            // Layout
            "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl p-1",
            // Visual - shadow and colors
            "shadow-xl bg-white dark:bg-gray-800",
            // Border
            "border border-gray-200 dark:border-gray-700",
            // Text
            "text-sm text-gray-700 dark:text-gray-200",
          )}
        >
          {/* Search Input */}
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search..."
            className={cn(
              // Layout
              "h-9 w-full rounded-lg px-3 py-2 text-sm",
              // Visual - light mode
              "bg-gray-50 text-gray-900 border border-gray-300",
              // Visual - dark mode
              "dark:bg-gray-700 dark:text-white dark:border-gray-600",
              // Placeholder
              "placeholder:text-gray-500 dark:placeholder:text-gray-400",
              // Focus
              "focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none",
              "dark:focus:border-blue-500 dark:focus:ring-blue-500",
            )}
            autoFocus
          />

          <div className="mt-1">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  // Layout
                  "relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm",
                  // Default state
                  "text-gray-700 dark:text-gray-200",
                  // Hover/focus states - purple accent
                  "hover:bg-purple-50 focus:bg-purple-50 focus:outline-none",
                  "dark:hover:bg-purple-900/30 dark:focus:bg-purple-900/30",
                  // Transition
                  "transition-colors duration-150",
                  // Selected state
                  value === option.value &&
                    "bg-purple-50 dark:bg-purple-900/20",
                )}
              >
                <span>{capitalizeFirstLetter(option.label)}</span>
                {value === option.value && (
                  <span className="ml-auto text-purple-600 dark:text-purple-400">
                    ✓
                  </span>
                )}
              </button>
            ))}

            {canCreateNew && (
              <button
                type="button"
                onClick={async () => {
                  await onCreateNew?.(searchValue);
                  setSearchValue("");
                  setIsOpen(false);
                }}
                className={cn(
                  // Layout
                  "relative flex w-full cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm",
                  // Default state
                  "text-gray-700 dark:text-gray-200",
                  // Hover/focus states - purple accent
                  "hover:bg-purple-50 focus:bg-purple-50 focus:outline-none",
                  "dark:hover:bg-purple-900/30 dark:focus:bg-purple-900/30",
                  // Transition
                  "transition-colors duration-150",
                )}
              >
                {`Create "${searchValue}"`}
              </button>
            )}

            {filteredOptions.length === 0 && !canCreateNew && (
              <div className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                No options found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
