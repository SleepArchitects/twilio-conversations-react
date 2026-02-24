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
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "ring-2 ring-ring ring-offset-2",
        )}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value ? capitalizeFirstLetter(selectedLabel) : selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {/* Search Input */}
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search..."
            className="h-9 w-full rounded-sm bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />

          <div className="mt-1">
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground",
                  value === option.value && "bg-accent text-accent-foreground",
                )}
              >
                <span>{capitalizeFirstLetter(option.label)}</span>
                {value === option.value && <span className="ml-auto">✓</span>}
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
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              >
                {`Create "${searchValue}"`}
              </button>
            )}

            {filteredOptions.length === 0 && !canCreateNew && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No options found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
