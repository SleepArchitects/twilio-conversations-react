"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ConversationListItem } from "./ConversationListItem";
import type { ConversationFilterValue } from "./ConversationFilter";
import type {
  Conversation,
  ConversationStatus,
  SlaStatus,
  Pagination,
} from "@/types/sms";
import { Tooltip } from "flowbite-react";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ConversationListProps {
  /** Currently selected conversation ID */
  selectedConversationId?: string;
  /** Callback when a conversation is selected */
  onConversationSelect?: (conversation: Conversation) => void;
  /** Callback to trigger new conversation modal */
  onNewConversation?: () => void;
  /** Filter by conversation status (all, unread, sla_risk, archived) per FR-014c */
  filterStatus?: ConversationFilterValue;
  /** Status filter - DEPRECATED: use filterStatus instead */
  statusFilter?: ConversationStatus;
  /** SLA filter */
  slaFilter?: SlaStatus;
  /** Search query for filtering */
  searchQuery?: string;
  /** Custom class name */
  className?: string;
}

interface ConversationListResponse {
  data: Conversation[];
  pagination: Pagination;
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function PlusIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}

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

function InboxIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-12 w-12", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M6.912 3a3 3 0 0 0-2.868 2.118l-2.411 7.838a3 3 0 0 0-.133.882V18a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-4.162c0-.299-.045-.596-.133-.882l-2.412-7.838A3 3 0 0 0 17.088 3H6.912Zm13.823 9.75-2.213-7.191A1.5 1.5 0 0 0 17.088 4.5H6.912a1.5 1.5 0 0 0-1.434 1.059L3.265 12.75H6.11a3 3 0 0 1 2.684 1.658l.256.513a1.5 1.5 0 0 0 1.342.829h3.218a1.5 1.5 0 0 0 1.342-.83l.256-.512a3 3 0 0 1 2.684-1.658h2.844Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExclamationCircleIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("h-12 w-12", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// MagnifyingGlassIcon removed - not currently used but may be needed for search feature

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_LIMIT = 50;

// =============================================================================
// ConversationList Component
// =============================================================================

/**
 * List of conversations with search, filtering, and infinite scroll.
 * Displays conversation cards with preview, unread count, and SLA status.
 */
export function ConversationList({
  selectedConversationId,
  onConversationSelect,
  onNewConversation,
  filterStatus,
  statusFilter,
  slaFilter,
  searchQuery,
  className,
}: ConversationListProps) {
  // State
  const { user } = useAuth();
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [offset, setOffset] = React.useState(0);

  // Refs
  const listRef = React.useRef<HTMLDivElement>(null);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchConversations = React.useCallback(
    async (reset: boolean = false) => {
      try {
        const currentOffset = reset ? 0 : offset;

        if (reset) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        setError(null);

        // Build query parameters
        const params: Record<string, string | number> = {
          limit: DEFAULT_LIMIT,
          offset: currentOffset,
        };

        if (user?.saxId) {
          params.coordinator_sax_id = user.saxId;
        }

        // Use new filterStatus parameter (FR-014c) if provided
        if (filterStatus) {
          params.filterStatus = filterStatus;
        }

        // Fallback to legacy statusFilter for backward compatibility
        if (statusFilter) {
          params.status = statusFilter;
        }

        if (slaFilter) {
          params.slaStatus = slaFilter;
        }

        // Note: search is handled client-side for now
        // Could be moved to server-side with query param

        const response = await api.get<ConversationListResponse>(
          "/api/outreach/conversations",
          { params },
        );

        const newConversations = response.data;
        const pagination = response.pagination;

        if (reset) {
          setConversations(newConversations);
          setOffset(DEFAULT_LIMIT);
        } else {
          setConversations((prev) => [...prev, ...newConversations]);
          setOffset((prev) => prev + DEFAULT_LIMIT);
        }

        setHasMore(pagination.hasMore);
      } catch (err) {
        console.error("Error fetching conversations:", err);
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load conversations");
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [offset, filterStatus, statusFilter, slaFilter, user],
  );

  // Initial load and filter changes
  React.useEffect(() => {
    if (user?.saxId) {
      fetchConversations(true);
    }
  }, [filterStatus, statusFilter, slaFilter, user?.saxId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // Infinite Scroll
  // ==========================================================================

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          fetchConversations(false);
        }
      },
      { threshold: 0.1 },
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, fetchConversations]);

  // ==========================================================================
  // Filtered Conversations (client-side search)
  // ==========================================================================

  const filteredConversations = React.useMemo(() => {
    const base = searchQuery?.trim()
      ? (() => {
          const query = searchQuery.toLowerCase().trim();
          return conversations.filter(
            (conv) =>
              conv.friendlyName.toLowerCase().includes(query) ||
              conv.patientPhone.includes(query),
          );
        })()
      : conversations;

    const slaPriority: Record<SlaStatus, number> = {
      breached: 0,
      warning: 1,
      ok: 2,
    };

    const byRecencyDesc = (a: Conversation, b: Conversation): number => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    };

    // Sort overdue conversations to the top (T062).
    // Keep archived conversations in their normal list ordering.
    return [...base].sort((a, b) => {
      if (a.status === "archived" || b.status === "archived") {
        return byRecencyDesc(a, b);
      }

      const aPri = slaPriority[a.slaStatus] ?? slaPriority.ok;
      const bPri = slaPriority[b.slaStatus] ?? slaPriority.ok;
      if (aPri !== bPri) return aPri - bPri;

      return byRecencyDesc(a, b);
    });
  }, [conversations, searchQuery]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleConversationClick = React.useCallback(
    (conversation: Conversation) => {
      onConversationSelect?.(conversation);
    },
    [onConversationSelect],
  );

  const handleRetry = React.useCallback(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div
      className={cn("flex flex-col h-full w-full bg-gray-900", className)}
      role="region"
      aria-label="Conversations"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Conversations</h2>
        {onNewConversation && (
          <Tooltip content="Start new conversation" placement="top">
            <button
              type="button"
              onClick={onNewConversation}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-purple-600 text-white",
                "hover:bg-purple-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
                "transition-colors",
              )}
              aria-label="Start new conversation"
            >
              <PlusIcon className="h-4 w-4" aria-hidden={true} />
              New
            </button>
          </Tooltip>
        )}
      </div>

      {/* List Content */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 py-2 w-full max-w-full"
      >
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <SpinnerIcon className="text-purple-400 mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-400">Loading conversations...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center h-full py-12 px-4">
            <ExclamationCircleIcon
              className="text-red-400 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-gray-300 text-center mb-4">{error}</p>
            <Tooltip content="Retry loading conversations" placement="top">
              <button
                type="button"
                onClick={handleRetry}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-gray-700 text-white",
                  "hover:bg-gray-600",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500",
                  "transition-colors",
                )}
              >
                Try Again
              </button>
            </Tooltip>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredConversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-12 px-4">
            <InboxIcon className="text-gray-600 mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-400 text-center">
              {searchQuery
                ? "No conversations match your search"
                : statusFilter === "archived"
                  ? "No archived conversations"
                  : "No conversations yet"}
            </p>
            {!searchQuery && !statusFilter && onNewConversation && (
              <Tooltip content="Create a new conversation" placement="top">
                <button
                  type="button"
                  onClick={onNewConversation}
                  className={cn(
                    "mt-4 px-4 py-2 rounded-lg text-sm font-medium",
                    "bg-purple-600 text-white",
                    "hover:bg-purple-500",
                    "focus:outline-none focus:ring-2 focus:ring-purple-500",
                    "transition-colors",
                  )}
                >
                  Start a Conversation
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* Conversation List */}
        {!isLoading && !error && filteredConversations.length > 0 && (
          <div className="space-y-1 w-full" role="list">
            {filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={handleConversationClick}
              />
            ))}

            {/* Load More Trigger */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center py-4"
              >
                {isLoadingMore && (
                  <SpinnerIcon
                    className="text-gray-400 h-5 w-5"
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConversationList;
