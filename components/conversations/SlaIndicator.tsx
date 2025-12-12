"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SlaStatus } from "@/types/sms";

export interface SlaIndicatorProps {
  status: SlaStatus;
  /** Timestamp of last inbound message to calculate time remaining */
  lastMessageAt?: string | null;
  /** SLA threshold in seconds (default: 3600 = 1 hour) */
  slaThresholdSeconds?: number;
  /** Display mode: 'compact' (dot only), 'badge' (dot + label), 'full' (time remaining) */
  variant?: "compact" | "badge" | "full";
  className?: string;
}

const SLA_CONFIG: Record<
  SlaStatus,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    description: string;
    icon: string;
  }
> = {
  ok: {
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
    label: "Responded",
    description: "Response sent within target time",
    icon: "✓",
  },
  warning: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    label: "Needs Reply",
    description: "Patient message waiting for response",
    icon: "⏱",
  },
  breached: {
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    label: "Overdue",
    description: "Response time exceeded target",
    icon: "!",
  },
};

const DEFAULT_SLA_THRESHOLD = 3600; // 1 hour in seconds

/**
 * Calculate time remaining until SLA breach
 * Returns object with minutes/hours remaining and whether breached
 */
function calculateTimeRemaining(
  lastMessageAt: string | null,
  thresholdSeconds: number,
): {
  minutesRemaining: number;
  hoursRemaining: number;
  isBreached: boolean;
  timeString: string;
} | null {
  if (!lastMessageAt) return null;

  const now = new Date();
  const messageTime = new Date(lastMessageAt);
  const elapsedSeconds = Math.floor(
    (now.getTime() - messageTime.getTime()) / 1000,
  );
  const remainingSeconds = thresholdSeconds - elapsedSeconds;

  const isBreached = remainingSeconds <= 0;
  const absRemaining = Math.abs(remainingSeconds);
  const minutesRemaining = Math.floor(absRemaining / 60);
  const hoursRemaining = Math.floor(absRemaining / 3600);

  let timeString = "";
  if (isBreached) {
    if (hoursRemaining > 0) {
      timeString = `${hoursRemaining}h overdue`;
    } else {
      timeString = `${minutesRemaining}m overdue`;
    }
  } else {
    if (hoursRemaining > 0) {
      const remainingMins = minutesRemaining % 60;
      timeString =
        remainingMins > 0
          ? `${hoursRemaining}h ${remainingMins}m left`
          : `${hoursRemaining}h left`;
    } else {
      timeString = `${minutesRemaining}m left`;
    }
  }

  return {
    minutesRemaining: isBreached ? -minutesRemaining : minutesRemaining,
    hoursRemaining: isBreached ? -hoursRemaining : hoursRemaining,
    isBreached,
    timeString,
  };
}

export function SlaIndicator({
  status,
  lastMessageAt,
  slaThresholdSeconds = DEFAULT_SLA_THRESHOLD,
  variant = "badge",
  className,
}: SlaIndicatorProps): React.ReactElement {
  const config = SLA_CONFIG[status] || SLA_CONFIG.ok;
  const timeInfo =
    variant === "full" && status === "warning" && lastMessageAt
      ? calculateTimeRemaining(lastMessageAt, slaThresholdSeconds)
      : null;

  // Compact variant: just the dot
  if (variant === "compact") {
    return (
      <div
        className={cn("inline-flex items-center", className)}
        role="status"
        aria-label={config.label}
        title={config.description}
      >
        <span
          className={cn("h-2 w-2 rounded-full", {
            "bg-green-400": status === "ok",
            "bg-yellow-400": status === "warning",
            "bg-red-400 animate-pulse": status === "breached",
          })}
          aria-hidden="true"
        />
      </div>
    );
  }

  // Badge variant: dot + label
  if (variant === "badge") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
          config.bgColor,
          config.color,
          config.borderColor,
          className,
        )}
        role="status"
        aria-label={config.label}
        title={config.description}
      >
        <span
          className={cn("text-sm", {
            "": status === "ok",
            "": status === "warning",
            "animate-pulse": status === "breached",
          })}
          aria-hidden="true"
        >
          {config.icon}
        </span>
        <span className="font-medium">{config.label}</span>
      </div>
    );
  }

  // Full variant: includes time remaining for warning status
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border",
        config.bgColor,
        config.color,
        config.borderColor,
        className,
      )}
      role="status"
      aria-label={`${config.label}${timeInfo ? ` - ${timeInfo.timeString}` : ""}`}
      title={config.description}
    >
      <span
        className={cn("text-sm", {
          "": status === "ok",
          "": status === "warning",
          "animate-pulse": status === "breached",
        })}
        aria-hidden="true"
      >
        {config.icon}
      </span>
      <div className="flex flex-col">
        <span className="font-medium leading-tight">{config.label}</span>
        {timeInfo && status === "warning" && (
          <span className="text-[10px] opacity-80 leading-tight">
            {timeInfo.timeString}
          </span>
        )}
      </div>
    </div>
  );
}

export default SlaIndicator;
