"use client";

import * as React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
  Tag,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresignedUrl } from "@/hooks/useConversationMetrics";
import type { TimelineEvent } from "@/types/sms";

interface TimelineEventCardProps {
  event: TimelineEvent;
  mediaS3Keys?: string[];
  onMediaClick?: (presignedUrl: string) => void;
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

function MediaThumbnail({
  s3Key,
  onClick,
}: {
  s3Key: string;
  onClick?: (presignedUrl: string) => void;
}) {
  const { data: presignedUrl, isLoading, isError } = usePresignedUrl(s3Key);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgErrored, setImgErrored] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-700 bg-gray-900">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
      </div>
    );
  }

  if (isError || !presignedUrl || imgErrored) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-700 bg-gray-900">
        <Paperclip className="h-3.5 w-3.5 text-gray-500" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(presignedUrl)}
      className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-gray-700 bg-gray-900 transition-colors hover:border-gray-500"
    >
      {!imgLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-600 border-t-gray-300" />
        </div>
      )}
      <img
        src={presignedUrl}
        alt="MMS attachment"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgErrored(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity",
          imgLoaded ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
        <Maximize2 className="h-3 w-3 text-white drop-shadow-lg" />
      </div>
    </button>
  );
}

function SmsCard({
  event,
  mediaS3Keys,
  onMediaClick,
}: {
  event: TimelineEvent;
  mediaS3Keys: string[];
  onMediaClick?: (presignedUrl: string) => void;
}) {
  const isOutbound = event.direction === "outbound";
  const DirectionIcon = isOutbound ? ArrowUpRight : ArrowDownLeft;
  const hasMedia = mediaS3Keys.length > 0;

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
          {hasMedia && (
            <Paperclip className="h-3.5 w-3.5 text-gray-500" />
          )}
          {event.status && <StatusBadge status={event.status} />}
        </div>
      </div>

      {hasMedia ? (
        <div className="mt-2 flex items-start gap-3">
          {event.body && (
            <p className="min-w-0 flex-1 text-sm text-gray-200 line-clamp-4">
              {event.body}
            </p>
          )}
          <div className="flex shrink-0 flex-col gap-2">
            {mediaS3Keys.map((key) => (
              <MediaThumbnail key={key} s3Key={key} onClick={onMediaClick} />
            ))}
          </div>
        </div>
      ) : (
        event.body && (
          <p className="mt-2 text-sm text-gray-200 line-clamp-3">
            {event.body}
          </p>
        )
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

export function TimelineEventCard({
  event,
  mediaS3Keys = [],
  onMediaClick,
}: TimelineEventCardProps) {
  const isSms = event.type === "sms";

  const borderColor = isSms
    ? event.direction === "outbound"
      ? "border-l-blue-500"
      : "border-l-green-500"
    : "border-l-purple-500";

  return (
    <div className={cn("rounded-lg bg-gray-800 p-4 border-l-4", borderColor)}>
      {isSms ? (
        <SmsCard
          event={event}
          mediaS3Keys={mediaS3Keys}
          onMediaClick={onMediaClick}
        />
      ) : (
        <PatientEventCard event={event} />
      )}

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
