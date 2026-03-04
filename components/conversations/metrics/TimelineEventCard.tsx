"use client";

import {
  ArrowUpRight,
  ArrowDownLeft,
  Image as ImageIcon,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/types/sms";

interface TimelineEventCardProps {
  event: TimelineEvent;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: "bg-green-500/20 text-green-400",
  sent: "bg-blue-500/20 text-blue-400",
  read: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  sending: "bg-yellow-500/20 text-yellow-400",
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400",
      )}
    >
      {status}
    </span>
  );
}

function SmsCard({ event }: { event: TimelineEvent }) {
  const isOutbound = event.direction === "outbound";
  const DirectionIcon = isOutbound ? ArrowUpRight : ArrowDownLeft;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <DirectionIcon
            className={cn(
              "h-4 w-4 shrink-0",
              isOutbound ? "text-blue-400" : "text-green-400",
            )}
          />
          <span className="text-xs text-gray-400 truncate">
            {isOutbound ? "Outbound" : "Inbound"}
            {event.senderName && ` · ${event.senderName}`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {event.mediaUrl && (
            <ImageIcon className="h-3.5 w-3.5 text-gray-500" />
          )}
          {event.status && <StatusBadge status={event.status} />}
        </div>
      </div>

      {event.body && (
        <p className="mt-2 text-sm text-gray-200 line-clamp-2">{event.body}</p>
      )}
    </>
  );
}

function PatientEventCard({ event }: { event: TimelineEvent }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Tag className="h-4 w-4 shrink-0 text-purple-400" />
          {event.category && (
            <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-400">
              {event.category}
            </span>
          )}
        </div>
      </div>

      {event.eventTitle && (
        <p className="mt-2 text-sm font-medium text-gray-200">
          {event.eventTitle}
        </p>
      )}
      {event.eventDetail && (
        <p className="mt-1 text-xs text-gray-400 line-clamp-2">
          {event.eventDetail}
        </p>
      )}
    </>
  );
}

export function TimelineEventCard({ event }: TimelineEventCardProps) {
  const isSms = event.type === "sms";

  const borderColor = isSms
    ? event.direction === "outbound"
      ? "border-l-blue-500"
      : "border-l-green-500"
    : "border-l-purple-500";

  return (
    <div
      className={cn("rounded-lg bg-gray-800 p-4 border-l-4", borderColor)}
    >
      {isSms ? <SmsCard event={event} /> : <PatientEventCard event={event} />}

      <div className="mt-3 flex justify-end">
        <time
          dateTime={event.timestamp}
          title={formatFullDate(event.timestamp)}
          className="text-xs text-gray-500 cursor-default"
        >
          {getRelativeTime(event.timestamp)}
        </time>
      </div>
    </div>
  );
}
