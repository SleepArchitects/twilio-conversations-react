"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/datetime";
import type { Message, MessageStatus } from "@/types/sms";
import { Skeleton } from "@/components/ui/skeleton";

// =============================================================================
// Status Icon Components
// =============================================================================

interface StatusIconProps {
  className?: string;
  "aria-hidden"?: boolean;
}

/** Clock icon for "sending" status */
function ClockIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("h-3.5 w-3.5", className)}
      {...props}
    >
      <title>Sending</title>
      <path
        fillRule="evenodd"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0v3.5c0 .199.079.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.94V4.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Single check icon for "sent" status */
function CheckIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("h-3.5 w-3.5", className)}
      {...props}
    >
      <title>Sent</title>
      <path
        fillRule="evenodd"
        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Double check icon for "delivered" and "read" status */
function DoubleCheckIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("h-3.5 w-3.5", className)}
      {...props}
    >
      <title>Delivered/Read</title>
      <path
        fillRule="evenodd"
        d="M8.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-2-2a.75.75 0 0 1 1.06-1.06l1.353 1.353 4.493-6.739a.75.75 0 0 1 1.04-.208Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-.5-.5a.75.75 0 1 1 1.06-1.06l.023.023 4.223-6.339a.75.75 0 0 1 1.04-.208Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** X icon for "failed" status */
function XIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("h-3.5 w-3.5", className)}
      {...props}
    >
      <title>Failed</title>
      <path
        fillRule="evenodd"
        d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// Status Indicator Component
// =============================================================================

interface StatusIndicatorProps {
  status: MessageStatus;
  errorMessage?: string | null;
}

/** Status labels for screen readers */
const STATUS_LABELS: Record<MessageStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed to send",
};

function StatusIndicator({ status, errorMessage }: StatusIndicatorProps) {
  const label = errorMessage
    ? `${STATUS_LABELS[status]}: ${errorMessage}`
    : STATUS_LABELS[status];

  const iconProps: StatusIconProps = {
    "aria-hidden": true,
  };

  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="inline-flex items-center"
    >
      {status === "sending" && (
        <ClockIcon className="text-gray-400" {...iconProps} />
      )}
      {status === "sent" && (
        <CheckIcon className="text-gray-400" {...iconProps} />
      )}
      {status === "delivered" && (
        <DoubleCheckIcon className="text-gray-400" {...iconProps} />
      )}
      {status === "read" && (
        <DoubleCheckIcon className="text-blue-400" {...iconProps} />
      )}
      {status === "failed" && <XIcon className="text-red-500" {...iconProps} />}
    </span>
  );
}

// =============================================================================
// MessageBubble Component
// =============================================================================

export interface MessageBubbleProps {
  /** The message to display */
  message: Message;
  /** Display name for the sender (coordinator name for outbound, or formatted phone for inbound) */
  senderName?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback for when an image thumbnail is clicked */
  onImageClick?: (imageIndex: number, images: string[]) => void;
}

/**
 * MessageBubble displays a single SMS message in a chat-style bubble.
 *
 * - Inbound messages (from patient) are left-aligned with gray background
 * - Outbound messages (from coordinator) are right-aligned with purple/blue background
 * - Shows sender identification, timestamp, and delivery status
 */
export function MessageBubble({
  message,
  senderName,
  className,
  onImageClick,
}: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";
  const isInbound = message.direction === "inbound";

  // Check for media
  const hasMedia =
    message.hasMedia && message.media && message.media.length > 0;
  const mediaCount = message.media?.length || 0;

  const [imageUrls, setImageUrls] = React.useState<string[]>([]);
  const [isLoadingUrls, setIsLoadingUrls] = React.useState(false);

  React.useEffect(() => {
    if (!hasMedia) return;

    setIsLoadingUrls(true);
    Promise.all(
      message.media!.map(async (m) => {
        const res = await fetch(
          `/api/outreach/media/view?s3Key=${encodeURIComponent(m.s3Key)}`,
        );
        if (!res.ok) throw new Error("Failed to fetch URL");
        const data = await res.json();
        return data.presignedUrl;
      }),
    )
      .then((urls) => setImageUrls(urls))
      .catch((err) => console.error("Failed to fetch image URLs:", err))
      .finally(() => setIsLoadingUrls(false));
  }, [message.media, hasMedia]);

  // Determine sender display name
  const displaySender = React.useMemo(() => {
    if (senderName) return senderName;
    if (isInbound && message.authorPhone) {
      return message.authorPhone;
    }
    return isOutbound ? "You" : "Unknown";
  }, [senderName, isInbound, isOutbound, message.authorPhone]);

  // Format the timestamp for display
  const formattedTime = React.useMemo(() => {
    return formatMessageTime(message.createdOn);
  }, [message.createdOn]);

  return (
    <article
      className={cn(
        "flex w-full animate-fade-in-up",
        isOutbound ? "justify-end" : "justify-start",
        className,
      )}
      aria-label={`Message from ${displaySender} at ${formattedTime}`}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5",
          // Inbound: left-aligned, gray background
          isInbound && "bg-gray-700 text-gray-100 rounded-bl-md",
          // Outbound: right-aligned, purple/blue background
          isOutbound && "bg-blue-600 text-white rounded-br-md",
        )}
      >
        {/* Sender name */}
        <div
          className={cn(
            "text-xs font-medium mb-1",
            isInbound ? "text-gray-300" : "text-blue-100",
          )}
        >
          {displaySender}
        </div>

        {/* Message body - Emojis render natively using browser fonts */}
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-pretty">
          {message.body}
        </p>

        {hasMedia && (
          <div className="mt-2 grid gap-1 rounded-lg overflow-hidden">
            {isLoadingUrls ? (
              <div className="flex gap-1">
                {Array.from({ length: Math.min(mediaCount, 4) }).map((_, i) => {
                  const key = `skeleton-${i}`;
                  return <Skeleton key={key} className="h-24 w-24" />;
                })}
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-1",
                  mediaCount === 1 && "grid-cols-1",
                  mediaCount === 2 && "grid-cols-2",
                  mediaCount >= 3 && "grid-cols-3",
                )}
              >
                {imageUrls.slice(0, 4).map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    className="relative aspect-square cursor-pointer overflow-hidden rounded-md hover:opacity-90 transition-opacity p-0 border-none bg-transparent"
                    onClick={() => onImageClick?.(index, imageUrls)}
                  >
                    <img
                      src={url}
                      alt={`Attachment ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {index === 3 && mediaCount > 4 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium pointer-events-none">
                        +{mediaCount - 4}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer: timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-1.5 mt-1.5 text-xs",
            isInbound ? "text-gray-400" : "text-blue-200",
          )}
        >
          <time dateTime={message.createdOn}>{formattedTime}</time>

          {/* Only show status indicator for outbound messages */}
          {isOutbound && (
            <StatusIndicator
              status={message.status}
              errorMessage={message.errorMessage}
            />
          )}
        </div>

        {/* Error message for failed messages */}
        {message.status === "failed" && message.errorMessage && (
          <div
            role="alert"
            className="mt-2 text-xs text-red-300 bg-red-900/30 rounded px-2 py-1"
          >
            {message.errorMessage}
          </div>
        )}
      </div>
    </article>
  );
}

// Default export for convenience
export default MessageBubble;
