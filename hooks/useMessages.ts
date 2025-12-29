"use client";

import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type {
  Message,
  PaginatedResponse,
  SendMessageRequest,
} from "@/types/sms";
import type { WorkerMessage, WorkerCommand } from "../types/worker";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useMessages hook
 */
export interface UseMessagesOptions {
  /** Conversation ID to fetch messages for */
  conversationId: string;
  /** Initial messages to populate state (optional, for SSR) */
  initialMessages?: Message[];
}

/**
 * Return type for useMessages hook
 */
export interface UseMessagesReturn {
  /** List of messages in the conversation */
  messages: Message[];
  /** Whether initial fetch is in progress */
  isLoading: boolean;
  /** Error from fetch or send operations */
  error: Error | null;
  /** Send a new message (supports optimistic updates) */
  sendMessage: (body: string, templateId?: string) => Promise<void>;
  /** Load older messages (pagination) */
  loadMore: () => Promise<void>;
  /** Whether more messages are available to load */
  hasMore: boolean;
  /** Refresh messages from the API */
  refresh: () => Promise<void>;
  /** Whether a send operation is in progress */
  isSending: boolean;
  /** Whether WebSocket is connected for real-time updates */
  wsConnected: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_PATH = "/outreach/api/outreach";
const DEFAULT_PAGE_SIZE = 50;
const WS_URL =
  process.env.NEXT_PUBLIC_WS_API_URL ||
  "wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev";

console.log("[useMessages] configured WS_URL:", WS_URL);

/**
 * Query key factory for messages
 */
const messagesQueryKey = (conversationId: string) =>
  ["messages", conversationId] as const;

/**
 * Fetch messages from API - used by TanStack Query
 */
async function fetchMessagesFromApi(
  conversationId: string,
  offset = 0,
  limit = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<Message>> {
  console.log(
    `[useMessages] Fetching messages for ${conversationId} (offset: ${offset})`,
  );

  // Always fetch in ASC order (chronological) for consistent ordering
  const response = await api.get<PaginatedResponse<Message>>(
    `${API_BASE_PATH}/conversations/${conversationId}/messages`,
    {
      params: {
        limit,
        offset,
        order: "asc",
      },
    },
  );

  return response;
}

// =============================================================================
// Message State Reducer
// =============================================================================

type MessageAction =
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "PREPEND_MESSAGES"; payload: Message[] }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "MERGE_MESSAGES"; payload: Message[] }
  | {
      type: "UPDATE_MESSAGE";
      payload: { id: string; updates: Partial<Message> };
    }
  | { type: "REMOVE_OPTIMISTIC"; payload: string }
  | { type: "CLEAR_MESSAGES" };

interface MessageState {
  messages: Message[];
  messageIds: Set<string>;
}

function messageReducer(
  state: MessageState,
  action: MessageAction,
): MessageState {
  switch (action.type) {
    case "SET_MESSAGES": {
      // Defensive: ensure payload is an array
      const messages = Array.isArray(action.payload) ? action.payload : [];
      const messageIds = new Set(messages.map((m) => m.id));
      return { messages, messageIds };
    }

    case "PREPEND_MESSAGES": {
      // Defensive: ensure payload is an array
      const incomingMessages = Array.isArray(action.payload)
        ? action.payload
        : [];
      // Add older messages to the beginning, avoiding duplicates
      const newMessages = incomingMessages.filter(
        (m) => !state.messageIds.has(m.id),
      );
      const newIds = new Set([
        ...newMessages.map((m) => m.id),
        ...state.messageIds,
      ]);
      return {
        messages: [...newMessages, ...state.messages],
        messageIds: newIds,
      };
    }

    case "ADD_MESSAGE": {
      // Avoid duplicates
      if (state.messageIds.has(action.payload.id)) {
        console.log(
          "[messageReducer] Skipping duplicate message",
          action.payload.id,
        );
        return state;
      }
      console.log("[messageReducer] Adding message", action.payload.id);

      // Add and sort by createdOn to ensure correct order
      const newMessages = [...state.messages, action.payload].sort(
        (a, b) =>
          new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime(),
      );

      return {
        messages: newMessages,
        messageIds: new Set(newMessages.map((m) => m.id)),
      };
    }

    case "MERGE_MESSAGES": {
      // Merge new messages with existing ones, deduplicate, and sort by createdOn
      const incomingMessages = Array.isArray(action.payload)
        ? action.payload
        : [];

      // Filter out messages we already have
      const newMessages = incomingMessages.filter(
        (m) => !state.messageIds.has(m.id),
      );

      if (newMessages.length === 0) {
        return state;
      }

      console.log(
        `[messageReducer] Merging ${newMessages.length} new messages`,
      );

      // Combine and sort
      const allMessages = [...state.messages, ...newMessages].sort(
        (a, b) =>
          new Date(a.createdOn).getTime() - new Date(b.createdOn).getTime(),
      );

      const newMessageIds = new Set(allMessages.map((m) => m.id));

      return {
        messages: allMessages,
        messageIds: newMessageIds,
      };
    }

    case "UPDATE_MESSAGE": {
      const { id, updates } = action.payload;

      // Find the message to update
      const messageIndex = state.messages.findIndex((m) => m.id === id);
      if (messageIndex === -1) {
        // Message not found, ignore update
        console.log("[messageReducer] Message not found for update", id);
        return state;
      }

      // If we're changing the ID, check if the new ID already exists (race condition with WebSocket)
      if (updates.id && updates.id !== id && state.messageIds.has(updates.id)) {
        console.log(
          "[messageReducer] Target ID already exists, removing old message",
          {
            oldId: id,
            newId: updates.id,
          },
        );
        // The new ID already exists (WebSocket was faster), so just remove the old optimistic message
        const newMessages = state.messages.filter((m) => m.id !== id);
        const newMessageIds = new Set(state.messageIds);
        newMessageIds.delete(id);
        return {
          messages: newMessages,
          messageIds: newMessageIds,
        };
      }

      const updatedMessage = { ...state.messages[messageIndex], ...updates };
      const newMessages = [...state.messages];
      newMessages[messageIndex] = updatedMessage;

      // Update the messageIds set
      const newMessageIds = new Set(state.messageIds);
      if (updates.id && updates.id !== id) {
        // ID is changing, remove old and add new
        console.log("[messageReducer] Updating message ID", {
          oldId: id,
          newId: updates.id,
        });
        newMessageIds.delete(id);
        newMessageIds.add(updates.id);
      }

      return {
        messages: newMessages,
        messageIds: newMessageIds,
      };
    }

    case "REMOVE_OPTIMISTIC": {
      // Remove optimistic message by temporary ID
      const newMessageIds = new Set(state.messageIds);
      newMessageIds.delete(action.payload);
      return {
        messages: state.messages.filter((m) => m.id !== action.payload),
        messageIds: newMessageIds,
      };
    }

    case "CLEAR_MESSAGES": {
      return { messages: [], messageIds: new Set() };
    }

    default:
      return state;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a temporary ID for optimistic updates
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create an optimistic message object
 */
function createOptimisticMessage(
  conversationId: string,
  body: string,
  tempId: string,
): Message {
  const now = new Date().toISOString();
  return {
    id: tempId,
    conversationId,
    twilioSid: "", // Will be updated when API responds
    direction: "outbound",
    authorSaxId: null, // Will be populated by backend
    authorPhone: null,
    body,
    status: "sending",
    segmentCount: Math.ceil(body.length / 160),
    sentiment: null,
    sentimentScore: null,
    errorCode: null,
    errorMessage: null,
    createdOn: now,
    createdBy: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    active: true,
    tenantId: "",
    practiceId: "",
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for managing message state with WebSocket real-time updates.
 *
 * Features:
 * - Fetches messages from API on mount
 * - Uses WebSocket connection for real-time message updates
 * - Handles optimistic updates when sending messages
 * - Supports pagination (load more older messages)
 * - Automatic reconnection and cleanup on unmount
 *
 * @param options - Hook configuration options
 * @returns Message state and operations
 *
 * @example
 * ```tsx
 * const {
 *   messages,
 *   isLoading,
 *   error,
 *   sendMessage,
 *   loadMore,
 *   hasMore
 * } = useMessages({
 *   conversationId: "conv-123"
 * });
 * ```
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
  const { conversationId, initialMessages = [] } = options;
  const queryClient = useQueryClient();
  const { saxId, tenantId, practiceId } = useAuth();

  // State
  const [state, dispatch] = useReducer(messageReducer, {
    messages: initialMessages,
    messageIds: new Set(initialMessages.map((m) => m.id)),
  });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  // Refs for cleanup and race condition prevention
  const isMountedRef = useRef(true);
  const pendingOptimisticRef = useRef<Map<string, string>>(new Map());
  const optimisticIdsRef = useRef<Set<string>>(new Set());
  const messageIdsRef = useRef<Set<string>>(state.messageIds);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();
  const workerRef = useRef<Worker | null>(null);

  // Keep messageIdsRef in sync with state
  useEffect(() => {
    messageIdsRef.current = state.messageIds;
  }, [state.messageIds]);

  // Initial fetch with TanStack Query (no polling)
  // Fetch the LAST page of messages first to show recent messages
  const {
    data: queryData,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: messagesQueryKey(conversationId),
    queryFn: async () => {
      // First, get total count by fetching with limit=1
      const countResponse = await fetchMessagesFromApi(conversationId, 0, 1);
      const total = countResponse.pagination.total;

      // Calculate offset to get the last page
      // If total=77 and limit=50, offset should be 27 to get messages 28-77
      const lastPageOffset = Math.max(0, total - DEFAULT_PAGE_SIZE);

      console.log(
        `[useMessages] Total messages: ${total}, fetching from offset: ${lastPageOffset}`,
      );

      // Fetch the last page
      return fetchMessagesFromApi(
        conversationId,
        lastPageOffset,
        DEFAULT_PAGE_SIZE,
      );
    },
    // Disable polling - we'll use WebSocket for updates
    refetchInterval: false,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Sync query data to local state (merge with optimistic updates)
  useEffect(() => {
    if (!queryData?.data) return;

    // Get current optimistic messages from state using the ref to track IDs
    const currentOptimisticIds = optimisticIdsRef.current;

    // Check if any optimistic messages are now in the API response
    const apiMessageIds = new Set(queryData.data.map((m) => m.id));

    // Remove confirmed optimistic IDs
    for (const optId of currentOptimisticIds) {
      if (apiMessageIds.has(optId)) {
        currentOptimisticIds.delete(optId);
      }
    }

    // If we have pending optimistic messages, we need to merge them
    // Access state directly in the dispatch to avoid stale closure
    if (currentOptimisticIds.size > 0) {
      dispatch({
        type: "SET_MESSAGES",
        payload: queryData.data,
      });
    } else {
      dispatch({ type: "SET_MESSAGES", payload: queryData.data });
    }

    setHasMore(queryData.pagination.hasMore);
    setOffset(queryData.data.length);
  }, [queryData]);

  /**
   * Load more (older) messages - uses separate query for pagination
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;

    try {
      const response = await fetchMessagesFromApi(
        conversationId,
        offset,
        DEFAULT_PAGE_SIZE,
      );
      if (!isMountedRef.current) return;

      dispatch({ type: "PREPEND_MESSAGES", payload: response.data });
      setOffset((prev) => prev + response.data.length);
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      console.error("Failed to load more messages:", err);
    }
  }, [conversationId, offset, hasMore, isLoading]);

  /**
   * Refresh messages - invalidates the query to trigger refetch
   */
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: messagesQueryKey(conversationId),
    });
  }, [queryClient, conversationId]);

  /**
   * Send a message with optimistic update
   */
  const sendMessage = useCallback(
    async (body: string, templateId?: string) => {
      if (!body.trim()) {
        throw new Error("Message body cannot be empty");
      }

      const tempId = generateTempId();

      try {
        setIsSending(true);
        setSendError(null);

        // Track optimistic message ID
        optimisticIdsRef.current.add(tempId);

        // Optimistic update - add message immediately with "sending" status
        const optimisticMessage = createOptimisticMessage(
          conversationId,
          body,
          tempId,
        );
        dispatch({ type: "ADD_MESSAGE", payload: optimisticMessage });

        // Send via API
        const payload: SendMessageRequest = { body };
        if (templateId) {
          payload.templateId = templateId;
        }

        const response = await api.post<Message>(
          `${API_BASE_PATH}/conversations/${conversationId}/messages`,
          payload,
        );

        if (!isMountedRef.current) return;

        // Track mapping for WebSocket real-time updates to prevent duplicates
        pendingOptimisticRef.current.set(response.twilioSid, tempId);
        pendingOptimisticRef.current.set(response.id, tempId);

        // Update optimistic message with real data (including new ID)
        // The UPDATE_MESSAGE action now properly updates the messageIds set
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: tempId,
            updates: {
              id: response.id,
              twilioSid: response.twilioSid,
              status: response.status,
              authorSaxId: response.authorSaxId,
              tenantId: response.tenantId,
              practiceId: response.practiceId,
              createdBy: response.createdBy,
              createdOn: response.createdOn,
              body: response.body,
              authorPhone: response.authorPhone,
            },
          },
        });

        // Remove from optimistic tracking - message is now confirmed
        optimisticIdsRef.current.delete(tempId);

        // Don't invalidate query immediately - let WebSocket handle updates
        // This prevents duplicate messages from appearing briefly
      } catch (err) {
        if (!isMountedRef.current) return;

        // Remove from optimistic tracking on failure
        optimisticIdsRef.current.delete(tempId);

        // Update optimistic message to show failure
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: tempId,
            updates: {
              status: "failed",
              errorMessage:
                err instanceof Error ? err.message : "Failed to send message",
            },
          },
        });

        const error =
          err instanceof Error ? err : new Error("Failed to send message");
        setSendError(error);
        throw error;
      } finally {
        if (isMountedRef.current) {
          setIsSending(false);
        }
      }
    },
    [conversationId, queryClient],
  );

  /**
   * Track mounted state for cleanup
   */
  useEffect(() => {
    isMountedRef.current = true;
    const pendingOptimistic = pendingOptimisticRef.current;

    return () => {
      isMountedRef.current = false;
      pendingOptimistic.clear();

      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Cleanup Worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [conversationId]);

  /**
   * Polling Worker integration
   */
  useEffect(() => {
    if (!conversationId) {
      console.log("[useMessages] Skipping worker - no conversationId");
      return;
    }

    // Create worker if it doesn't exist
    if (!workerRef.current) {
      console.log(
        "[useMessages] ⚙️ Initializing polling worker for conversation:",
        conversationId,
      );

      try {
        const workerUrl = new URL(
          "../workers/message-poller.worker.js",
          import.meta.url,
        );
        console.log("[useMessages] Worker URL:", workerUrl.href);

        // Use native Worker API with pure JavaScript worker (no TypeScript imports)
        const worker = new Worker(workerUrl);

        // Add error handler for worker creation
        worker.onerror = (e) => {
          console.error("[useMessages] ❌ Worker error:", {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            error: e.error,
          });
        };

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const data = event.data;
          console.log("[useMessages] 📨 Worker message received:", data.type);

          switch (data.type) {
            case "MESSAGES_FETCHED": {
              console.log(
                `[useMessages] ✅ Polling worker fetched ${data.payload.fetchCount} messages`,
              );

              // Messages from API are already in the correct format (Message interface)
              // No transformation needed - just add them to state
              const newMessages: Message[] = data.payload.messages;

              // Dispatch all messages to the reducer to merge and sort
              if (newMessages.length > 0) {
                console.log(
                  `[useMessages] 📥 Merging ${newMessages.length} polled messages`,
                );
                dispatch({ type: "MERGE_MESSAGES", payload: newMessages });
              }
              break;
            }

            case "POLL_ERROR":
              console.error(
                `[useMessages] Polling error for ${data.conversationSid}:`,
                data.payload.error,
              );
              break;

            case "POLL_STATUS":
              if (!data.payload.isPolling) {
                console.log(
                  `[useMessages] Polling stopped for ${data.conversationSid}`,
                );
              }
              break;
          }
        };

        workerRef.current = worker;
        console.log("[useMessages] Worker initialized successfully");
      } catch (error) {
        console.error("[useMessages] Failed to create worker:", error);
        // Continue without worker - WebSocket will be the only update mechanism
        return;
      }
    }

    // Start polling for current conversation
    // Safety Net: removed lastMessageId and sinceTimestamp from payload
    const startCommand: WorkerCommand = {
      type: "START_POLLING",
      timestamp: Date.now(),
      payload: {
        conversationSid: conversationId,
      },
    };

    if (workerRef.current) {
      console.log("[useMessages] 🚀 Starting worker polling:", startCommand);
      workerRef.current.postMessage(startCommand);
    } else {
      console.warn(
        "[useMessages] ⚠️ Worker not initialized, cannot start polling",
      );
    }

    return () => {
      if (workerRef.current) {
        const stopCommand: WorkerCommand = {
          type: "STOP_POLLING",
          timestamp: Date.now(),
          payload: {
            conversationSid: conversationId,
          },
        };
        workerRef.current.postMessage(stopCommand);
      }
    };
  }, [conversationId, tenantId, practiceId]);

  /**
   * WebSocket connection management
   */
  useEffect(() => {
    // Debug log for dependency changes
    console.log("[useMessages] WebSocket effect triggered", {
      conversationId,
      saxId,
      tenantId,
      practiceId,
      wsConnected: wsRef.current?.readyState === WebSocket.OPEN,
    });

    // Don't connect if we don't have user context yet
    if (!saxId || !tenantId || !practiceId) {
      console.log(
        "[useMessages] Waiting for user context before connecting WebSocket",
      );
      return;
    }

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log("[useMessages] WebSocket already connected, skipping");
        return;
      }

      console.log(
        `[useMessages] 🔌 Attempting WebSocket connection for conversation ${conversationId}`,
      );
      console.log("[useMessages] Auth context:", {
        saxId,
        tenantId,
        practiceId,
      });

      const wsUrlWithParams = `${WS_URL}?coordinatorId=${saxId}&tenantId=${tenantId}&practiceId=${practiceId}`;
      console.log("[useMessages] WebSocket URL:", wsUrlWithParams);

      try {
        const ws = new WebSocket(wsUrlWithParams);
        console.log(
          "[useMessages] WebSocket object created, waiting for connection...",
        );

        ws.onopen = () => {
          console.log("[useMessages] ✅ WebSocket CONNECTED successfully");
          setWsConnected(true);

          // Start ping interval to keep connection alive
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              console.log("[useMessages] 🏓 Sending WebSocket ping");
              ws.send(JSON.stringify({ action: "ping" }));
            }
          }, 30000); // Ping every 30 seconds
        };

        ws.onerror = (error) => {
          console.error("[useMessages] ❌ WebSocket ERROR:", {
            type: error.type,
            target: error.target,
            readyState: ws.readyState,
            url: wsUrlWithParams,
          });
        };

        ws.onclose = (event) => {
          console.log("[useMessages] 🔌 WebSocket CLOSED:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          setWsConnected(false);

          // Clear ping interval
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = undefined;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[useMessages] 📨 WebSocket received data:", {
              type: data.type,
              message: data.message ? "present" : "absent",
              messageId: data.message?.id,
            });

            // Handle pong response from ping action
            if (data.message === "pong") {
              return;
            }

            // Handle new message broadcast
            if (data.type === "newMessage" && data.message) {
              // @eslint-disable-next-line @typescript-eslint/no-explicit-any
              const rawMessage = data.message as Record<string, any>;

              // Transform snake_case to camelCase for Message interface
              const message: Message = {
                id: rawMessage.id,
                conversationId:
                  rawMessage.conversationId || rawMessage.conversation_id,
                twilioSid: rawMessage.twilioSid || rawMessage.twilio_sid || "",
                direction: rawMessage.direction,
                authorSaxId:
                  rawMessage.authorSaxId ?? rawMessage.author_sax_id ?? null,
                authorPhone:
                  rawMessage.authorPhone || rawMessage.author_phone || null,
                body: rawMessage.body,
                status: rawMessage.status,
                segmentCount:
                  rawMessage.segmentCount ?? rawMessage.segment_count ?? 1,
                sentiment: rawMessage.sentiment || null,
                sentimentScore:
                  rawMessage.sentimentScore ||
                  rawMessage.sentiment_score ||
                  null,
                errorCode:
                  rawMessage.errorCode || rawMessage.error_code || null,
                errorMessage:
                  rawMessage.errorMessage || rawMessage.error_message || null,
                createdOn: rawMessage.createdOn || rawMessage.created_on,
                createdBy:
                  rawMessage.createdBy ?? rawMessage.created_by ?? null,
                sentAt: rawMessage.sentAt || rawMessage.sent_at || null,
                deliveredAt:
                  rawMessage.deliveredAt || rawMessage.delivered_at || null,
                readAt: rawMessage.readAt || rawMessage.read_at || null,
                active: rawMessage.active ?? true,
                tenantId: rawMessage.tenantId || rawMessage.tenant_id || "",
                practiceId:
                  rawMessage.practiceId || rawMessage.practice_id || "",
              };

              const msgConvId = message.conversationId;

              console.log("[useMessages] Received WebSocket message", {
                messageId: message.id,
                msgConvId,
                currentConvId: conversationId,
                authorPhone: message.authorPhone,
                matches: msgConvId === conversationId,
              });

              // Only add if it's for this conversation
              if (msgConvId === conversationId) {
                console.log("[useMessages] Processing WebSocket message", {
                  id: message.id,
                  twilioSid: message.twilioSid,
                  direction: message.direction,
                  body: message.body?.substring(0, 50),
                  authorPhone: message.authorPhone,
                  currentMessageIds: Array.from(messageIdsRef.current),
                  pendingOptimistic: Array.from(
                    pendingOptimisticRef.current.entries(),
                  ),
                });

                // Check if this message is already in our state by ID (use ref for current state)
                if (messageIdsRef.current.has(message.id)) {
                  console.log(
                    "[useMessages] Message already exists in state, skipping",
                    message.id,
                  );
                  return;
                }

                // Check if this message was already handled via optimistic update
                // by checking both the twilioSid and the message ID
                const optimisticId = Array.from(
                  pendingOptimisticRef.current.entries(),
                ).find(
                  ([key]) => key === message.twilioSid || key === message.id,
                )?.[1];

                if (optimisticId) {
                  console.log(
                    "[useMessages] WebSocket message matches optimistic update, skipping",
                    {
                      optimisticId,
                      realId: message.id,
                    },
                  );
                  // This message was already added via optimistic update and API response
                  // Clean up the tracking
                  pendingOptimisticRef.current.delete(message.twilioSid);
                  pendingOptimisticRef.current.delete(message.id);
                  optimisticIdsRef.current.delete(optimisticId);
                } else {
                  // This is a genuinely new message (likely from another device or inbound)
                  console.log(
                    "[useMessages] Adding new message from WebSocket",
                    message.id,
                  );
                  dispatch({ type: "ADD_MESSAGE", payload: message });
                }
              }
            }

            // Handle message status updates
            if (
              data.type === "messageStatusUpdate" &&
              data.messageId &&
              data.status
            ) {
              console.log(
                "[useMessages] Message status update",
                data.messageId,
                data.status,
              );
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: data.messageId,
                  updates: { status: data.status },
                },
              });
            }
          } catch (err) {
            console.error(
              "[useMessages] Error parsing WebSocket message:",
              err,
            );
          }
        };

        wsRef.current = ws;
      } catch (wsError) {
        console.error("[useMessages] ❌ Failed to create WebSocket:", wsError);
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [conversationId, saxId, tenantId, practiceId]);

  // Combine query error with send error
  const error = queryError || sendError;

  return {
    messages: state.messages,
    isLoading,
    error,
    sendMessage,
    loadMore,
    hasMore,
    refresh,
    isSending,
    wsConnected,
  };
}

export default useMessages;
