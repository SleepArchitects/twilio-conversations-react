"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/datetime";
import type { Conversation, SlaStatus } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ConversationListItemProps {
  /** Conversation data to display */
  conversation: Conversation;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Click handler for selecting conversation */
  onClick?: (conversation: Conversation) => void;
}

// =============================================================================
// SLA Indicator Component
// =============================================================================

interface SlaIndicatorProps {
  status: SlaStatus;
  className?: string;
}

const SLA_CONFIG: Record<
  SlaStatus,
  { color: string; bgColor: string; label: string }
> = {
  ok: {
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    label: "On track",
  },
  warning: {
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    label: "Approaching SLA",
  },
  breached: {
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    label: "SLA breached",
  },
};

function SlaIndicator({ status, className }: SlaIndicatorProps) {
  const config = SLA_CONFIG[status] || SLA_CONFIG.ok; // Default to 'ok' if status is undefined

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        config.bgColor,
        config.color,
        className,
      )}
      role="status"
      aria-label={config.label}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-green-400": status === "ok",
          "bg-yellow-400": status === "warning",
          "bg-red-400 animate-pulse": status === "breached",
        })}
        aria-hidden="true"
      />
      <span className="sr-only">{config.label}</span>
    </div>
  );
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function UserCircleIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-10 w-10", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArchiveIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-4 w-4", className)}
      {...props}
    >
      <path d="M2 3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2Z" />
      <path
        fillRule="evenodd"
        d="M2 7.5h16l-.811 7.71a2 2 0 0 1-1.99 1.79H4.802a2 2 0 0 1-1.99-1.79L2 7.5Zm5.22 1.72a.75.75 0 0 1 1.06 0L10 10.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NoSymbolIcon({ className, ...props }: IconProps) {
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
        d="M5.965 4.904l9.131 9.131a6.5 6.5 0 0 0-9.131-9.131Zm8.07 10.192L4.904 5.965a6.5 6.5 0 0 0 9.131 9.131ZM4.343 4.343a8 8 0 1 1 11.314 11.314A8 8 0 0 1 4.343 4.343Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// ConversationListItem Component
// =============================================================================

/**
 * Individual conversation item in the conversation list.
 * Displays patient name/phone, last message preview, timestamp,
 * unread count badge, and SLA status indicator.
 */
export function ConversationListItem({
  conversation,
  isSelected = false,
  onClick,
}: ConversationListItemProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(conversation);
  }, [conversation, onClick]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.(conversation);
      }
    },
    [conversation, onClick],
  );

  // Format the timestamp
  const timeDisplay = conversation.lastMessageAt
    ? formatRelativeTime(conversation.lastMessageAt)
    : "";

  // Truncate preview to prevent layout issues
  const preview = conversation.lastMessagePreview
    ? conversation.lastMessagePreview.length > 80
      ? `${conversation.lastMessagePreview.slice(0, 80)}...`
      : conversation.lastMessagePreview
    : "No messages yet";

  const isArchived = conversation.status === "archived";
  const isOptedOut = conversation.optedOut === true;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer",
        "transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
        isSelected
          ? "bg-purple-600/20 border border-purple-500/30"
          : "hover:bg-gray-700/50 border border-transparent",
        isArchived && "opacity-60",
      )}
      aria-pressed={isSelected}
      aria-label={`Conversation with ${conversation.friendlyName}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <UserCircleIcon
          className={cn(
            "text-gray-500",
            isSelected && "text-purple-400",
            isOptedOut && "text-red-400/50",
          )}
          aria-hidden="true"
        />
        {/* Unread badge */}
        {conversation.unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1",
              "flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1",
              "bg-purple-500 text-white text-xs font-bold rounded-full",
            )}
            aria-label={`${conversation.unreadCount} unread messages`}
          >
            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              className={cn(
                "text-sm font-medium truncate",
                isSelected ? "text-white" : "text-gray-200",
                conversation.unreadCount > 0 && "font-semibold",
              )}
            >
              {conversation.friendlyName}
            </h3>
            {isArchived && (
              <ArchiveIcon
                className="text-gray-500 flex-shrink-0"
                aria-label="Archived"
              />
            )}
            {isOptedOut && (
              <NoSymbolIcon
                className="text-red-400 flex-shrink-0"
                aria-label="Opted out"
              />
            )}
          </div>
          <span
            className={cn(
              "text-xs flex-shrink-0",
              conversation.unreadCount > 0
                ? "text-purple-400"
                : "text-gray-500",
            )}
          >
            {timeDisplay}
          </span>
        </div>

        {/* Phone number */}
        <p className="text-xs text-gray-500 mb-1">
          {conversation.patientPhone}
        </p>

        {/* Preview row */}
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-sm truncate",
              conversation.unreadCount > 0 ? "text-gray-300" : "text-gray-500",
            )}
          >
            {preview}
          </p>
          {/* SLA indicator - only show for active conversations with warning/breached */}
          {!isArchived && conversation.slaStatus !== "ok" && (
            <SlaIndicator
              status={conversation.slaStatus}
              className="flex-shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationListItem;
