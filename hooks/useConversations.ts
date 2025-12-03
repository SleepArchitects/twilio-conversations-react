"use client";

import * as React from "react";
import type { Client, Conversation as TwilioConversation } from "@twilio/conversations";
import { api, ApiError } from "@/lib/api";
import type {
  Conversation,
  ConversationStatus,
  SlaStatus,
  Pagination,
} from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface UseConversationsOptions {
  /** Twilio client instance for real-time updates */
  twilioClient?: Client | null;
  /** Status filter (active or archived) */
  statusFilter?: ConversationStatus;
  /** SLA status filter */
  slaFilter?: SlaStatus;
  /** Search query for filtering */
  searchQuery?: string;
  /** Number of conversations per page */
  pageSize?: number;
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
}

export interface UseConversationsReturn {
  /** List of conversations */
  conversations: Conversation[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Loading state for pagination */
  isLoadingMore: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether more conversations are available */
  hasMore: boolean;
  /** Total count of conversations */
  total: number;
  /** Fetch or refresh conversations */
  refresh: () => Promise<void>;
  /** Load more conversations (pagination) */
  loadMore: () => Promise<void>;
  /** Select a conversation by ID */
  selectConversation: (id: string) => Conversation | undefined;
  /** Update a conversation in the list */
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  /** Remove a conversation from the list */
  removeConversation: (id: string) => void;
}

interface ConversationListResponse {
  data: Conversation[];
  pagination: Pagination;
}

// =============================================================================
// Action Types
// =============================================================================

type ConversationsAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: { conversations: Conversation[]; pagination: Pagination; reset: boolean } }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "LOAD_MORE_START" }
  | { type: "UPDATE_CONVERSATION"; payload: { id: string; updates: Partial<Conversation> } }
  | { type: "REMOVE_CONVERSATION"; payload: string }
  | { type: "ADD_CONVERSATION"; payload: Conversation };

interface ConversationsState {
  conversations: Conversation[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  offset: number;
}

// =============================================================================
// Reducer
// =============================================================================

const initialState: ConversationsState = {
  conversations: [],
  isLoading: true,
  isLoadingMore: false,
  error: null,
  hasMore: false,
  total: 0,
  offset: 0,
};

function conversationsReducer(
  state: ConversationsState,
  action: ConversationsAction
): ConversationsState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case "FETCH_SUCCESS": {
      const { conversations, pagination, reset } = action.payload;
      return {
        ...state,
        conversations: reset
          ? conversations
          : [...state.conversations, ...conversations],
        isLoading: false,
        isLoadingMore: false,
        error: null,
        hasMore: pagination.hasMore,
        total: pagination.total,
        offset: reset ? conversations.length : state.offset + conversations.length,
      };
    }

    case "FETCH_ERROR":
      return {
        ...state,
        isLoading: false,
        isLoadingMore: false,
        error: action.payload,
      };

    case "LOAD_MORE_START":
      return {
        ...state,
        isLoadingMore: true,
      };

    case "UPDATE_CONVERSATION": {
      const { id, updates } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === id ? { ...conv, ...updates } : conv
        ),
      };
    }

    case "REMOVE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter(
          (conv) => conv.id !== action.payload
        ),
        total: Math.max(0, state.total - 1),
      };

    case "ADD_CONVERSATION":
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        total: state.total + 1,
      };

    default:
      return state;
  }
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PAGE_SIZE = 50;

// =============================================================================
// useConversations Hook
// =============================================================================

/**
 * Hook for managing conversation list state with real-time updates.
 * Handles fetching, pagination, filtering, and Twilio SDK event subscriptions.
 */
export function useConversations(
  options: UseConversationsOptions = {}
): UseConversationsReturn {
  const {
    twilioClient,
    statusFilter,
    slaFilter,
    searchQuery,
    pageSize = DEFAULT_PAGE_SIZE,
    autoFetch = true,
  } = options;

  const [state, dispatch] = React.useReducer(conversationsReducer, initialState);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchConversations = React.useCallback(
    async (reset: boolean = false) => {
      try {
        if (reset) {
          dispatch({ type: "FETCH_START" });
        } else {
          dispatch({ type: "LOAD_MORE_START" });
        }

        // Build query parameters
        const params: Record<string, string | number> = {
          limit: pageSize,
          offset: reset ? 0 : state.offset,
        };

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (slaFilter) {
          params.slaStatus = slaFilter;
        }

        const response = await api.get<ConversationListResponse>(
          "/api/outreach/conversations",
          { params }
        );

        dispatch({
          type: "FETCH_SUCCESS",
          payload: {
            conversations: response.data,
            pagination: response.pagination,
            reset,
          },
        });
      } catch (err) {
        console.error("Error fetching conversations:", err);
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load conversations";
        dispatch({ type: "FETCH_ERROR", payload: message });
      }
    },
    [pageSize, state.offset, statusFilter, slaFilter]
  );

  // Initial fetch
  React.useEffect(() => {
    if (autoFetch) {
      fetchConversations(true);
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filters change
  React.useEffect(() => {
    fetchConversations(true);
  }, [statusFilter, slaFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // Twilio SDK Event Subscriptions
  // ==========================================================================

  React.useEffect(() => {
    if (!twilioClient) return;

    // Handle conversation added (new conversation created)
    const handleConversationAdded = async (twilioConv: TwilioConversation) => {
      try {
        // Fetch the full conversation details from our API
        const response = await api.get<Conversation>(
          `/api/outreach/conversations/${twilioConv.sid}`
        );
        dispatch({ type: "ADD_CONVERSATION", payload: response });
      } catch (err) {
        console.error("Error fetching new conversation:", err);
      }
    };

    // Handle conversation updated (status change, new message, etc.)
    const handleConversationUpdated = async ({
      conversation: twilioConv,
    }: {
      conversation: TwilioConversation;
    }) => {
      try {
        // Fetch updated conversation details
        const response = await api.get<Conversation>(
          `/api/outreach/conversations/${twilioConv.sid}`
        );
        dispatch({
          type: "UPDATE_CONVERSATION",
          payload: { id: response.id, updates: response },
        });
      } catch (err) {
        console.error("Error fetching updated conversation:", err);
      }
    };

    // Handle conversation removed
    const handleConversationRemoved = (twilioConv: TwilioConversation) => {
      // Find conversation by Twilio SID and remove
      const conv = state.conversations.find((c) => c.twilioSid === twilioConv.sid);
      if (conv) {
        dispatch({ type: "REMOVE_CONVERSATION", payload: conv.id });
      }
    };

    // Subscribe to events
    twilioClient.on("conversationAdded", handleConversationAdded);
    twilioClient.on("conversationUpdated", handleConversationUpdated);
    twilioClient.on("conversationRemoved", handleConversationRemoved);

    return () => {
      twilioClient.off("conversationAdded", handleConversationAdded);
      twilioClient.off("conversationUpdated", handleConversationUpdated);
      twilioClient.off("conversationRemoved", handleConversationRemoved);
    };
  }, [twilioClient, state.conversations]);

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const refresh = React.useCallback(async () => {
    await fetchConversations(true);
  }, [fetchConversations]);

  const loadMore = React.useCallback(async () => {
    if (!state.hasMore || state.isLoadingMore) return;
    await fetchConversations(false);
  }, [fetchConversations, state.hasMore, state.isLoadingMore]);

  const selectConversation = React.useCallback(
    (id: string) => {
      return state.conversations.find((conv) => conv.id === id);
    },
    [state.conversations]
  );

  const updateConversation = React.useCallback(
    (id: string, updates: Partial<Conversation>) => {
      dispatch({ type: "UPDATE_CONVERSATION", payload: { id, updates } });
    },
    []
  );

  const removeConversation = React.useCallback((id: string) => {
    dispatch({ type: "REMOVE_CONVERSATION", payload: id });
  }, []);

  // ==========================================================================
  // Filtered Results (client-side search)
  // ==========================================================================

  const filteredConversations = React.useMemo(() => {
    if (!searchQuery?.trim()) {
      return state.conversations;
    }

    const query = searchQuery.toLowerCase().trim();
    return state.conversations.filter(
      (conv) =>
        conv.friendlyName.toLowerCase().includes(query) ||
        conv.patientPhone.includes(query)
    );
  }, [state.conversations, searchQuery]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    conversations: filteredConversations,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    error: state.error,
    hasMore: state.hasMore,
    total: state.total,
    refresh,
    loadMore,
    selectConversation,
    updateConversation,
    removeConversation,
  };
}

export default useConversations;
