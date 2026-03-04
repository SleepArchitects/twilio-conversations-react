"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Tooltip } from "flowbite-react";
import { cn } from "@/lib/utils";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";

function formatDeliveryRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface StatTileProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  warning?: boolean;
}

function StatTile({
  label,
  value,
  icon: Icon,
  warning = false,
}: StatTileProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0",
          warning ? "text-red-400" : "text-purple-400",
        )}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 leading-none">
          {label}
        </p>
        <p
          className={cn(
            "text-sm font-semibold leading-none tabular-nums",
            warning ? "text-red-300" : "text-gray-100",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <div className="h-3.5 w-3.5 rounded bg-gray-700 flex-shrink-0" />
      <div className="flex flex-col gap-0.5">
        <div className="h-2 w-12 rounded bg-gray-700" />
        <div className="h-3 w-8 rounded bg-gray-700" />
      </div>
    </div>
  );
}

export interface MetricsSummaryStripProps {
  className?: string;
  showOnlyMine?: boolean;
  saxId?: number;
  activeCountOverride?: number;
}

export function MetricsSummaryStrip({
  className,
  showOnlyMine,
  saxId,
  activeCountOverride,
}: MetricsSummaryStripProps) {
  const { data, isLoading, isError } = useDashboardAnalytics({
    showOnlyMine,
    saxId,
  });

  if (isError) return null;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2",
        "bg-gray-800/80 border-b border-gray-700/60",
        className,
      )}
      role="region"
      aria-label="Metrics summary"
    >
      <div className="flex items-center divide-x divide-gray-700/60">
        {isLoading ? (
          <>
            <div className="pr-5">
              <SkeletonTile />
            </div>
            <div className="px-5">
              <SkeletonTile />
            </div>
            <div className="pl-5">
              <SkeletonTile />
            </div>
          </>
        ) : data ? (
          <>
            <div className="pr-5">
              <Tooltip
                content={
                  showOnlyMine
                    ? "Conversations currently active and assigned to you"
                    : "Total conversations currently active across your team"
                }
              >
                <StatTile
                  label="Active"
                  value={activeCountOverride ?? data.activeConversations}
                  icon={Users}
                />
              </Tooltip>
            </div>
            <div className="px-5">
              <Tooltip content="Percentage of messages successfully delivered to patients">
                <StatTile
                  label="Delivery"
                  value={formatDeliveryRate(data.deliveryRate)}
                  icon={TrendingUp}
                  warning={data.deliveryRate === 0}
                />
              </Tooltip>
            </div>
            <div className="pl-5">
              <Tooltip content="Average time to first response across active conversations">
                <StatTile
                  label="Avg Response"
                  value={formatResponseTime(data.avgResponseTimeMinutes)}
                  icon={Clock}
                />
              </Tooltip>
            </div>
          </>
        ) : null}
      </div>

      <Link
        href="/conversations/metrics"
        className={cn(
          "flex items-center gap-1.5 flex-shrink-0",
          "px-2.5 py-1 rounded",
          "border border-gray-700/60 bg-gray-700/30",
          "text-xs text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-700/60",
          "transition-colors duration-150",
        )}
        aria-label="View full metrics dashboard"
      >
        <span className="hidden sm:inline">Full metrics</span>
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default MetricsSummaryStrip;
