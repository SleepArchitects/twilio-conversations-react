"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDateHeader, isSameDay } from "@/lib/datetime";
import { MessageBubble } from "@/components/conversations/MessageBubble";
import { MessageComposer } from "@/components/conversations/MessageComposer";
import { PatientContextHeader } from "@/components/conversations/PatientContextHeader";
import { LinkPatientButton } from "@/components/conversations/LinkPatientButton";
import { SlaIndicator } from "@/components/conversations/SlaIndicator";
import { useMessages } from "@/hooks/useMessages";
import { usePracticeName } from "@/hooks/usePracticeName";
import { useAuth } from "@/hooks/useAuth";
import { useOutreachTemplateContext } from "@/hooks/useOutreachTemplateContext";
import type { Conversation } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ConversationDetailProps {
  /** Conversation ID to display */
  conversationId: string;
  /** Conversation metadata for header display */
  conversation: Conversation;
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/** Loading spinner icon */
function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-6 w-6 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="45 30"
      />
    </svg>
  );
}

/** Phone icon for header */
function PhoneIcon({ className, ...props }: IconProps) {
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
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Warning icon for opted-out state */
function ExclamationTriangleIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Chat bubble icon for empty state */
function ChatBubbleIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-16 w-16", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.383C3.369 16.42 2 14.687 2 12.74V6.72c0-1.946 1.37-3.678 3.348-3.97Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Retry icon */
function ArrowPathIcon({ className, ...props }: IconProps) {
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
        d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0v2.43l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389 5.5 5.5 0 0 1 9.2-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.22Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// Date Separator Component
// =============================================================================

interface DateSeparatorProps {
  date: string;
}

function DateSeparator({ date }: DateSeparatorProps) {
  const formattedDate = formatDateHeader(date);

  return (
    <div className="flex items-center justify-center py-4" role="separator">
      <div className="flex-1 border-t border-gray-700" />
      <span className="mx-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
        {formattedDate}
      </span>
      <div className="flex-1 border-t border-gray-700" />
    </div>
  );
}

// =============================================================================
// Loading Skeleton Component
// =============================================================================

function MessageSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-hidden="true">
      {/* Incoming message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2">
          <div className="h-12 w-48 rounded-2xl bg-gray-700 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-700 animate-pulse" />
        </div>
      </div>
      {/* Outgoing message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[70%] space-y-2">
          <div className="h-16 w-56 rounded-2xl bg-gray-700 animate-pulse" />
          <div className="h-3 w-20 rounded bg-gray-700 animate-pulse ml-auto" />
        </div>
      </div>
      {/* Another incoming */}
      <div className="flex justify-start">
        <div className="max-w-[70%] space-y-2">
          <div className="h-8 w-36 rounded-2xl bg-gray-700 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-700 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Empty State Component
// =============================================================================

interface EmptyStateProps {
  patientName: string;
}

function EmptyState({ patientName }: EmptyStateProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center p-8 text-center"
      role="status"
      aria-label="No messages"
    >
      <ChatBubbleIcon className="text-gray-600 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-gray-300 mb-2">
        No messages yet
      </h3>
      <p className="text-sm text-gray-400 max-w-sm">
        Start the conversation by sending a message to {patientName}.
      </p>
    </div>
  );
}

// =============================================================================
// Error State Component
// =============================================================================

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center p-8 text-center"
      role="alert"
      aria-live="assertive"
    >
      <ExclamationTriangleIcon
        className="text-red-400 h-12 w-12 mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-gray-300 mb-2">
        Failed to load messages
      </h3>
      <p className="text-sm text-gray-400 max-w-sm mb-4">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2",
          "bg-blue-600 hover:bg-blue-500 text-white",
          "rounded-lg font-medium text-sm",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900",
        )}
      >
        <ArrowPathIcon aria-hidden="true" />
        Try Again
      </button>
    </div>
  );
}

// =============================================================================
// Opted Out Warning Component
// =============================================================================

function OptedOutWarning() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-yellow-900/30 border-b border-yellow-800/50"
      role="alert"
    >
      <ExclamationTriangleIcon
        className="text-yellow-500 flex-shrink-0"
        aria-hidden="true"
      />
      <p className="text-sm text-yellow-200">
        This patient has opted out of SMS messaging. Messages cannot be sent.
      </p>
    </div>
  );
}

// =============================================================================
// Load More Button Component
// =============================================================================

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

function LoadMoreButton({ onClick, isLoading }: LoadMoreButtonProps) {
  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onClick}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2",
          "bg-gray-700 hover:bg-gray-600 text-gray-200",
          "rounded-lg font-medium text-sm",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isLoading ? (
          <>
            <SpinnerIcon className="h-4 w-4" aria-hidden="true" />
            Loading...
          </>
        ) : (
          "Load earlier messages"
        )}
      </button>
    </div>
  );
}

// =============================================================================
// ConversationDetail Component
// =============================================================================

/**
 * ConversationDetail - Full message thread view with composer
 *
 * Displays the complete message history for a conversation with:
 * - Header showing patient name and phone number
 * - Scrollable message list with date separators
 * - Auto-scroll to latest message on new arrivals
 * - Message composer for sending new messages
 * - Loading, empty, and error states
 * - Opted-out warning banner
 *
 * @example
 * ```tsx
 * <ConversationDetail
 *   conversationId="conv-123"
 *   conversation={selectedConversation}
 * />
 * ```
 */
export function ConversationDetail({
  conversationId,
  conversation,
}: ConversationDetailProps) {
  // Use the messages hook for data fetching and polling-based updates
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    loadMore,
    hasMore,
    refresh,
    isSending,
  } = useMessages({
    conversationId,
  });

  // State for patient context
  const [conversationData, setConversationData] =
    React.useState<Conversation>(conversation);

  // Update conversation data when prop changes or patient is linked
  React.useEffect(() => {
    setConversationData(conversation);
  }, [conversation]);

  // Callback when patient is linked via LinkPatientButton
  const handlePatientLinked = React.useCallback(() => {
    // Refresh conversation to get updated patient context
    // In a real implementation, this would refetch from the API
    // For now, we'll trigger a page refresh to get the updated data
    window.location.reload();
  }, []);

  // Refs for auto-scroll functionality
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messageListRef = React.useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const scrollRestorationRef = React.useRef<number | null>(null);
  const lastMessageIdRef = React.useRef<string | null>(null);

  // Handle scroll restoration when loading older messages
  // We use useLayoutEffect to adjust the scroll position before the browser paints
  // This prevents the visual "jump" when new messages are added to the top
  React.useLayoutEffect(() => {
    // If we have a stored scroll height, it means we loaded more messages
    if (scrollRestorationRef.current !== null && messageListRef.current) {
      const newScrollHeight = messageListRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - scrollRestorationRef.current;

      // Adjust scroll top by the difference in height
      // This keeps the user's view anchored to the same messages
      if (scrollDiff > 0) {
        messageListRef.current.scrollTop += scrollDiff;
      }

      scrollRestorationRef.current = null;
    }
  }, [messages]);

  // Auto-scroll to bottom on NEW messages only
  React.useEffect(() => {
    // Get the last message ID
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id;

    // Check if the last message has changed (new message added to bottom)
    // We ignore updates where the last message is the same (e.g. loading history)
    const isNewMessageAtBottom = lastMessageId !== lastMessageIdRef.current;

    // Update ref for next comparison
    lastMessageIdRef.current = lastMessageId || null;

    // Scroll to bottom if it's a new message at the bottom
    if (isNewMessageAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (
      !isLoading &&
      messages.length > 0 &&
      !scrollRestorationRef.current
    ) {
      // Initial load scroll
      // However, we need to be careful not to override scroll restoration.
      // If scrollRestorationRef was just processed in useLayoutEffect,
      // we shouldn't scroll to bottom.
      // But useLayoutEffect runs before useEffect.
      // So checking if we JUST restored scroll is tricky unless we use a flag.
      // Actually, "isNewMessageAtBottom" handles the dynamic updates.
      // This block is for initial mount.
      // But useEffect runs after every render.
      // We only want this on INITIAL load or when we are empty->not-empty.
    }
  }, [messages.length, messages]); // Depend on messages to catch ID changes

  // Initial scroll to bottom on mount
  React.useEffect(() => {
    if (!isLoading && messages.length > 0 && messagesEndRef.current) {
      // Only scroll on initial load (when we haven't loaded more)
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
    // We intentionally only want this to run when loading finishes initially
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Handle load more with scroll position preservation
  const handleLoadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    // Capture current scroll height before loading
    if (messageListRef.current) {
      scrollRestorationRef.current = messageListRef.current.scrollHeight;
    }

    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadMore, hasMore, isLoadingMore]);

  // Handle sending messages with optional template tracking
  const handleSendMessage = React.useCallback(
    async (body: string, templateId?: string) => {
      await sendMessage(body, templateId);
      // Auto-scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    [sendMessage],
  );

  // Group messages by date for rendering separators
  const renderMessages = React.useCallback(() => {
    const elements: React.ReactNode[] = [];
    let lastDate: string | null = null;

    messages.forEach((message) => {
      const messageDate = message.createdOn;

      // Add date separator if this is a new day
      if (!lastDate || !isSameDay(lastDate, messageDate)) {
        elements.push(
          <DateSeparator key={`date-${messageDate}`} date={messageDate} />,
        );
        lastDate = messageDate;
      }

      elements.push(<MessageBubble key={message.id} message={message} />);
    });

    return elements;
  }, [messages]);

  // Extract display name from conversation
  const displayName = conversationData.friendlyName || "Unknown Patient";
  const phoneNumber = conversationData.patientPhone;
  const isOptedOut = conversationData.optedOut === true;
  const practiceId = conversationData.practiceId;

  const { user } = useAuth();

  // Fetch practice name from SleepConnect API layer; fall back to embedded/env values
  const { data: practiceData } = usePracticeName(practiceId);

  const practiceName =
    (conversationData as { practiceName?: string }).practiceName ||
    user?.practiceName ||
    practiceData?.name ||
    process.env.NEXT_PUBLIC_PRACTICE_NAME;

  const { context: templateContext } = useOutreachTemplateContext();

  // Check if patient is linked
  const isPatientLinked = !!(
    conversationData.patientId &&
    conversationData.patientFirstName &&
    conversationData.patientLastName
  );

  // Patient/practice context for template variable substitution
  const templateVariableValues = React.useMemo(() => {
    const values: Record<string, string> = {};

    const addValue = (key: string, value?: string | null) => {
      if (value === undefined || value === null) return;
      const stringValue = `${value}`.trim();
      if (!stringValue) return;
      values[key] = stringValue;
    };

    const ctx = templateContext || {};

    // Seed with any context written by SleepConnect writers (patient + practice + user)
    addValue("practiceId", ctx.practiceId);
    addValue("practiceName", ctx.practiceName);
    addValue("tenantId", ctx.tenantId);
    addValue("tenantName", ctx.tenantName);
    addValue("saxId", ctx.saxId);
    addValue("userEmail", ctx.userEmail);
    addValue("userName", ctx.userName);
    addValue("patientId", ctx.patientId);
    addValue("patientFirstName", ctx.patientFirstName);
    addValue("patientLastName", ctx.patientLastName);
    addValue("patientName", ctx.patientName);
    addValue("patientPhone", ctx.patientPhone);
    addValue("patientEmail", ctx.patientEmail);
    if (ctx.patientFirstName) addValue("firstName", ctx.patientFirstName);
    if (ctx.patientLastName) addValue("lastName", ctx.patientLastName);
    if (ctx.patientName) addValue("fullName", ctx.patientName);

    // Overlay with the live conversation data (takes precedence)
    addValue("practiceId", conversationData.practiceId);
    addValue("tenantId", conversationData.tenantId);

    addValue(
      "userName",
      user?.name || (user as { nickname?: string } | undefined)?.nickname,
    );
    addValue("userEmail", user?.email);
    addValue("saxId", (user as { saxId?: string } | undefined)?.saxId);

    addValue("patientFirstName", conversationData.patientFirstName);
    addValue("patientLastName", conversationData.patientLastName);

    const fullName = [
      conversationData.patientFirstName,
      conversationData.patientLastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) {
      addValue("fullName", fullName);
      addValue("patientName", fullName);
      addValue("firstName", conversationData.patientFirstName);
      addValue("lastName", conversationData.patientLastName);
    } else if (conversationData.friendlyName) {
      addValue("patientName", conversationData.friendlyName);
    }

    if (conversationData.patientPhone) {
      addValue("phone", conversationData.patientPhone);
      addValue("patientPhone", conversationData.patientPhone);
    }

    if (conversationData.patientDob) {
      addValue("dob", conversationData.patientDob);
    }

    if (practiceName) {
      addValue("practiceName", practiceName);
    }

    // Coordinator alias for templates that reference the sender
    if (values.userName) {
      addValue("coordinatorName", values.userName);
    }

    return values;
  }, [
    conversationData.friendlyName,
    conversationData.patientDob,
    conversationData.patientFirstName,
    conversationData.patientLastName,
    conversationData.patientPhone,
    conversationData.practiceId,
    conversationData.tenantId,
    practiceName,
    templateContext,
    user,
  ]);

  return (
    <div
      className="flex flex-col h-full bg-gray-900"
      role="region"
      aria-label={`Conversation with ${displayName}`}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">
            {displayName}
          </h1>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <PhoneIcon className="flex-shrink-0" aria-hidden="true" />
            <span>{phoneNumber}</span>
          </div>
        </div>
        {/* SLA Status - show prominently in header */}
        {conversationData.status !== "archived" &&
          conversationData.slaStatus !== "ok" && (
            <SlaIndicator
              status={conversationData.slaStatus}
              lastMessageAt={conversationData.lastMessageAt}
              variant="full"
              className="flex-shrink-0"
            />
          )}
      </header>

      {/* Patient Context Header or Link Patient Button (US3a) */}
      {isPatientLinked ? (
        <PatientContextHeader
          patientId={conversationData.patientId!}
          firstName={conversationData.patientFirstName!}
          lastName={conversationData.patientLastName!}
          dateOfBirth={conversationData.patientDob || null}
          practiceName={practiceName}
          tenantName={conversationData.tenantName}
        />
      ) : (
        <LinkPatientButton
          conversationId={conversationId}
          onPatientLinked={handlePatientLinked}
        />
      )}

      {/* Opted Out Warning */}
      {isOptedOut && <OptedOutWarning />}

      {/* Message List */}
      <div
        ref={messageListRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-label="Message history"
        aria-live="polite"
        aria-relevant="additions"
      >
        {isLoading ? (
          <MessageSkeleton />
        ) : error ? (
          <ErrorState error={error} onRetry={refresh} />
        ) : messages.length === 0 ? (
          <EmptyState patientName={displayName} />
        ) : (
          <div className="p-4 space-y-1">
            {/* Load More Button */}
            {hasMore && (
              <LoadMoreButton
                onClick={handleLoadMore}
                isLoading={isLoadingMore}
              />
            )}

            {/* Message List with Date Separators */}
            {renderMessages()}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Message Composer */}
      <div className="border-t border-gray-700 bg-gray-800">
        <MessageComposer
          onSend={handleSendMessage}
          disabled={isOptedOut || isSending}
          placeholder={
            isOptedOut
              ? "Patient has opted out of messaging"
              : "Type a message..."
          }
          variableValues={templateVariableValues}
        />
      </div>
    </div>
  );
}

export default ConversationDetail;
