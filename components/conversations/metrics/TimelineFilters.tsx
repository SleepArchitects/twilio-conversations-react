"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TimelineFiltersProps {
  activeFilters: string[];
  onFilterChange: (filters: string[]) => void;
}

export function TimelineFilters({ activeFilters, onFilterChange }: TimelineFiltersProps) {
  const toggleFilter = (filterType: string) => {
    if (activeFilters.includes(filterType)) {
      onFilterChange([]);
    } else {
      onFilterChange([filterType]);
    }
  };

  const filters = [
    { id: "all", label: "All", value: "" },
    { id: "sms", label: "SMS", value: "sms" },
    { id: "patient_event", label: "Patient Events", value: "patient_event" },
  ];

  return (
    <div className="flex gap-2 mb-6">
      {filters.map((filter) => {
        const isActive =
          filter.id === "all"
            ? activeFilters.length === 0
            : activeFilters.includes(filter.value);

        return (
          <button
            key={filter.id}
            onClick={() =>
              filter.id === "all" ? onFilterChange([]) : toggleFilter(filter.value)
            }
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
              isActive
                ? "bg-blue-600 text-white"
                : "bg-transparent border border-gray-600 text-gray-400 hover:text-white hover:border-gray-500"
            )}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
