"use client";

import * as React from "react";
import type { Message, SlaStatus } from "@/types/sms";

// =============================================================================
// Constants
// =============================================================================

/** SLA threshold in milliseconds (10 minutes) */
const SLA_THRESHOLD_MS = 10 * 60 * 1000;

/** Warning threshold in milliseconds (7 minutes = 70% of SLA) */
const WARNING_THRESHOLD_MS = 7 * 60 * 1000;

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface UseSlaMonitorOptions {
  /** Messages to monitor for SLA calculation */
  messages: Message[];
  /** Whether to auto-calculate on mount and message changes */
  autoCalculate?: boolean;
  /** Custom SLA threshold in milliseconds (default: 10 minutes) */
  slaThresholdMs?: number;
  /** Custom warning threshold in milliseconds (default: 7 minutes) */
  warningThresholdMs?: number;
}

export interface UseSlaMonitorReturn {
  /** Current SLA status: 'ok', 'warning', or 'breached' */
  slaStatus: SlaStatus;
  /** Time elapsed since last patient message in milliseconds */
  elapsedMs: number;
  /** Time remaining until SLA breach in milliseconds (negative if breached) */
  timeRemainingMs: number;
  /** Whether the SLA is currently at risk (warning or breached) */
  isAtRisk: boolean;
  /** Whether a response is overdue (breached status) */
  isOverdue: boolean;
  /** Human-readable time remaining string */
  timeRemainingDisplay: string;
  /** Refresh SLA calculation */
  refresh: () => void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate SLA status based on elapsed time and thresholds.
 *
 * @param elapsedMs - Time elapsed since last patient message
 * @param warningThresholdMs - Threshold for warning state (default: 7 minutes)
 * @param slaThresholdMs - Threshold for breach state (default: 10 minutes)
 * @returns SLA status: 'ok', 'warning', or 'breached'
 */
function calculateSlaStatus(
  elapsedMs: number,
  warningThresholdMs: number = WARNING_THRESHOLD_MS,
  slaThresholdMs: number = SLA_THRESHOLD_MS,
): SlaStatus {
  if (elapsedMs >= slaThresholdMs) {
    return "breached";
  }
  if (elapsedMs >= warningThresholdMs) {
    return "warning";
  }
  return "ok";
}

/**
 * Format milliseconds into human-readable time remaining string.
 *
 * @param timeRemainingMs - Time remaining in milliseconds (negative if overdue)
 * @returns Formatted time string (e.g., "2m 30s remaining", "Overdue by 5m")
 */
function formatTimeRemaining(timeRemainingMs: number): string {
  const absMs = Math.abs(timeRemainingMs);
  const minutes = Math.floor(absMs / (60 * 1000));
  const seconds = Math.floor((absMs % (60 * 1000)) / 1000);

  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  if (timeRemainingMs < 0) {
    return `Overdue by ${timeStr}`;
  }

  return `${timeStr} remaining`;
}

/**
 * Find the last patient message (inbound) in the message list.
 *
 * @param messages - Array of messages to search
 * @returns The most recent inbound message, or null if none found
 */
function findLastPatientMessage(messages: Message[]): Message | null {
  const patientMessages = messages
    .filter((msg) => msg.direction === "inbound")
    .sort(
      (a, b) =>
        new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime(),
    );

  return patientMessages.length > 0 ? patientMessages[0] : null;
}

/**
 * Check if there has been a coordinator response since the given message.
 *
 * @param messages - Array of all messages
 * @param referenceMessage - Message to check responses against
 * @returns True if there's an outbound message after the reference message
 */
function hasCoordinatorResponse(
  messages: Message[],
  referenceMessage: Message,
): boolean {
  const referenceTime = new Date(referenceMessage.createdOn).getTime();

  return messages.some(
    (msg) =>
      msg.direction === "outbound" &&
      new Date(msg.createdOn).getTime() > referenceTime,
  );
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for monitoring SLA (Service Level Agreement) compliance in conversations.
 *
 * This hook calculates SLA status based on the time elapsed since the last patient message
 * and whether a coordinator has responded. It provides real-time monitoring with three states:
 * - 'ok': Response time is under 7 minutes
 * - 'warning': Response time is between 7-10 minutes
 * - 'breached': Response time is over 10 minutes
 *
 * The calculation is performed client-side for immediate UI feedback and real-time updates.
 *
 * @param options - Configuration options for the SLA monitor
 * @returns SLA monitoring state and utilities
 *
 * @example
 * ```tsx
 * const {
 *   slaStatus,
 *   elapsedMs,
 *   timeRemainingMs,
 *   isAtRisk,
 *   isOverdue,
 *   timeRemainingDisplay,
 *   refresh
 * } = useSlaMonitor({
 *   messages,
 *   autoCalculate: true
 * });
 *
 * // Use in component
 * <div className={`sla-indicator ${slaStatus}`}>
 *   {timeRemainingDisplay}
 * </div>
 * ```
 *
 * @reasoning Following research.md pattern for client-side SLA calculation:
 * - Uses 10-minute response time threshold
 * - Shows warning at 7+ minutes (70% of threshold)
 * - Shows breach at 10+ minutes (100% of threshold)
 * - Calculates based on last patient message timestamp
 * - Checks for coordinator response to determine if SLA applies
 */
export function useSlaMonitor(
  options: UseSlaMonitorOptions,
): UseSlaMonitorReturn {
  const {
    messages,
    autoCalculate = true,
    slaThresholdMs = SLA_THRESHOLD_MS,
    warningThresholdMs = WARNING_THRESHOLD_MS,
  } = options;

  // ==========================================================================
  // State & Refs
  // ==========================================================================

  const [slaStatus, setSlaStatus] = React.useState<SlaStatus>("ok");
  const [elapsedMs, setElapsedMs] = React.useState<number>(0);
  const [timeRemainingMs, setTimeRemainingMs] =
    React.useState<number>(slaThresholdMs);
  const [isAtRisk, setIsAtRisk] = React.useState<boolean>(false);
  const [isOverdue, setIsOverdue] = React.useState<boolean>(false);
  const [timeRemainingDisplay, setTimeRemainingDisplay] =
    React.useState<string>("");

  // Refs for interval management and latest values
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const latestMessagesRef = React.useRef<Message[]>(messages);
  const latestThresholdsRef = React.useRef({
    slaThresholdMs,
    warningThresholdMs,
  });

  // ==========================================================================
  // Update Refs
  // ==========================================================================

  React.useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    latestThresholdsRef.current = {
      slaThresholdMs,
      warningThresholdMs,
    };
  }, [slaThresholdMs, warningThresholdMs]);

  // ==========================================================================
  // SLA Calculation Logic
  // ==========================================================================

  /**
   * Calculate current SLA status and update all derived values.
   * This function encapsulates the core SLA monitoring logic.
   */
  const calculateSla = React.useCallback(() => {
    const currentMessages = latestMessagesRef.current;
    const { slaThresholdMs, warningThresholdMs } = latestThresholdsRef.current;

    // Find the last patient message
    const lastPatientMessage = findLastPatientMessage(currentMessages);

    // If no patient message found, SLA doesn't apply
    if (!lastPatientMessage) {
      setSlaStatus("ok");
      setElapsedMs(0);
      setTimeRemainingMs(slaThresholdMs);
      setIsAtRisk(false);
      setIsOverdue(false);
      setTimeRemainingDisplay("No patient messages");
      return;
    }

    // Check if there's already a coordinator response
    const hasResponse = hasCoordinatorResponse(
      currentMessages,
      lastPatientMessage,
    );

    // If coordinator has responded, SLA is met
    if (hasResponse) {
      setSlaStatus("ok");
      setElapsedMs(0);
      setTimeRemainingMs(slaThresholdMs);
      setIsAtRisk(false);
      setIsOverdue(false);
      setTimeRemainingDisplay("Response sent");
      return;
    }

    // Calculate elapsed time since last patient message
    const now = Date.now();
    const messageTime = new Date(lastPatientMessage.createdOn).getTime();
    const currentElapsed = now - messageTime;

    // Calculate SLA status
    const currentStatus = calculateSlaStatus(
      currentElapsed,
      warningThresholdMs,
      slaThresholdMs,
    );

    // Calculate time remaining (negative if overdue)
    const remaining = slaThresholdMs - currentElapsed;

    // Update all state values
    setSlaStatus(currentStatus);
    setElapsedMs(currentElapsed);
    setTimeRemainingMs(remaining);
    setIsAtRisk(currentStatus !== "ok");
    setIsOverdue(currentStatus === "breached");
    setTimeRemainingDisplay(formatTimeRemaining(remaining));
  }, []);

  // ==========================================================================
  // Manual Refresh
  // ==========================================================================

  const refresh = React.useCallback(() => {
    calculateSla();
  }, [calculateSla]);

  // ==========================================================================
  // Auto-calculation Effects
  // ==========================================================================

  // Initial calculation
  React.useEffect(() => {
    if (autoCalculate) {
      calculateSla();
    }
  }, [autoCalculate, calculateSla]);

  // Recalculate when messages change
  React.useEffect(() => {
    if (autoCalculate) {
      calculateSla();
    }
  }, [messages, autoCalculate, calculateSla]);

  // Set up polling interval for real-time updates
  React.useEffect(() => {
    if (!autoCalculate) return;

    // Update every 30 seconds for real-time UI updates
    intervalRef.current = setInterval(() => {
      calculateSla();
    }, 30 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoCalculate, calculateSla]);

  // ==========================================================================
  // Return Value
  // ==========================================================================

  return {
    slaStatus,
    elapsedMs,
    timeRemainingMs,
    isAtRisk,
    isOverdue,
    timeRemainingDisplay,
    refresh,
  };
}

export default useSlaMonitor;
