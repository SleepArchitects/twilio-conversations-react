"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardData {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: "blue" | "green" | "purple" | "amber";
  subtitle?: string;
}

export interface MetricsSummaryCardsProps {
  metrics: MetricCardData[];
  isLoading?: boolean;
  className?: string;
}

const BORDER_COLORS: Record<MetricCardData["color"], string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  purple: "border-l-purple-500",
  amber: "border-l-amber-500",
};

const ICON_COLORS: Record<MetricCardData["color"], string> = {
  blue: "text-blue-400",
  green: "text-green-400",
  purple: "text-purple-400",
  amber: "text-amber-400",
};

function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-lg border-l-4 border-l-gray-600 p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-20 bg-gray-700 rounded" />
          <div className="h-7 w-16 bg-gray-700 rounded" />
          <div className="h-3 w-24 bg-gray-700 rounded" />
        </div>
        <div className="h-8 w-8 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

function isEmptyValue(value: string | number): boolean {
  if (value === 0) return false;
  return !value || value === "" || value === "—" || value === "N/A";
}

function MetricCard({ title, value, icon: Icon, color, subtitle }: MetricCardData) {
  const empty = isEmptyValue(value);

  return (
    <div
      className={cn(
        "group bg-gray-800 rounded-lg border-l-4 p-4 transition-colors hover:bg-gray-750",
        BORDER_COLORS[color],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {title}
          </p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold",
              empty ? "text-gray-500" : "text-white",
            )}
          >
            {empty ? "—" : value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "ml-3 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
            ICON_COLORS[color],
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function MetricsSummaryCards({
  metrics,
  isLoading = false,
  className,
}: MetricsSummaryCardsProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
          className,
        )}
        aria-busy="true"
        aria-label="Loading metrics"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      role="region"
      aria-label="Summary metrics"
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.title} {...metric} />
      ))}
    </div>
  );
}

export default MetricsSummaryCards;
