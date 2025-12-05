"use client";

import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	Client,
	Conversation as TwilioConversation,
} from "@twilio/conversations";
import type { Message as TwilioMessage } from "@twilio/conversations";
import { api, ApiError } from "@/lib/api";
import type {
	Message,
	PaginatedResponse,
	SendMessageRequest,
} from "@/types/sms";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the useMessages hook
 */
export interface UseMessagesOptions {
	/** Conversation ID to fetch messages for */
	conversationId: string;
	/** Twilio client instance from useTwilioClient */
	twilioClient: Client | null;
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
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_PATH = "/outreach/api/outreach";
const DEFAULT_PAGE_SIZE = 50;
const POLLING_INTERVAL = 3000; // 3 seconds

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
	console.log(`[useMessages] Fetching messages for ${conversationId} (offset: ${offset})`);
	return api.get<PaginatedResponse<Message>>(
		`${API_BASE_PATH}/conversations/${conversationId}/messages`,
		{
			params: {
				limit,
				offset,
				order: "asc",
			},
		},
	);
}

// =============================================================================
// Message State Reducer
// =============================================================================

type MessageAction =
	| { type: "SET_MESSAGES"; payload: Message[] }
	| { type: "PREPEND_MESSAGES"; payload: Message[] }
	| { type: "ADD_MESSAGE"; payload: Message }
	| {
			type: "UPDATE_MESSAGE";
			payload: { id: string; updates: Partial<Message> };
	  }
	| {
			type: "UPDATE_MESSAGE_BY_TWILIO_SID";
			payload: { twilioSid: string; updates: Partial<Message> };
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
			const incomingMessages = Array.isArray(action.payload) ? action.payload : [];
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
				return state;
			}
			return {
				messages: [...state.messages, action.payload],
				messageIds: new Set([...state.messageIds, action.payload.id]),
			};
		}

		case "UPDATE_MESSAGE": {
			const { id, updates } = action.payload;
			// If the ID is being changed, we need to update the messageIds set
			const newMessageIds = new Set(state.messageIds);
			if (updates.id && updates.id !== id) {
				newMessageIds.delete(id);
				newMessageIds.add(updates.id);
			}
			return {
				messages: state.messages.map((m) =>
					m.id === id ? { ...m, ...updates } : m,
				),
				messageIds: newMessageIds,
			};
		}

		case "UPDATE_MESSAGE_BY_TWILIO_SID": {
			const { twilioSid, updates } = action.payload;
			return {
				...state,
				messages: state.messages.map((m) =>
					m.twilioSid === twilioSid ? { ...m, ...updates } : m,
				),
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

/**
 * Map Twilio DeliveryStatus to our MessageStatus type
 * DeliveryAmount is "none" | "some" | "all"
 */
function mapTwilioDeliveryStatus(
	deliveryReceipt: TwilioMessage["aggregatedDeliveryReceipt"],
): Message["status"] {
	if (!deliveryReceipt) {
		// No delivery receipt yet, message was just sent
		return "sent";
	}

	// Check statuses in order of priority (most final first)
	// DeliveryAmount values are "none", "some", or "all"
	if (deliveryReceipt.read !== "none") {
		return "read";
	}
	if (deliveryReceipt.delivered !== "none") {
		return "delivered";
	}
	if (deliveryReceipt.failed !== "none") {
		return "failed";
	}
	if (deliveryReceipt.sent !== "none") {
		return "sent";
	}

	return "sending";
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for managing message state with real-time updates via Twilio SDK.
 *
 * Features:
 * - Fetches messages from API on mount
 * - Subscribes to Twilio Conversation events for real-time updates
 * - Handles optimistic updates when sending messages
 * - Supports pagination (load more older messages)
 * - Automatic cleanup on unmount
 *
 * @param options - Hook configuration options
 * @returns Message state and operations
 *
 * @example
 * ```tsx
 * const { client } = useTwilioClient();
 * const {
 *   messages,
 *   isLoading,
 *   error,
 *   sendMessage,
 *   loadMore,
 *   hasMore
 * } = useMessages({
 *   conversationId: "conv-123",
 *   twilioClient: client
 * });
 * ```
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
	const { conversationId, twilioClient, initialMessages = [] } = options;
	const queryClient = useQueryClient();

	// State
	const [state, dispatch] = useReducer(messageReducer, {
		messages: initialMessages,
		messageIds: new Set(initialMessages.map((m) => m.id)),
	});
	const [isSending, setIsSending] = useState(false);
	const [sendError, setSendError] = useState<Error | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [offset, setOffset] = useState(0);
	// Track if we successfully subscribed to Twilio realtime events
	const [isSubscribedToRealtime, setIsSubscribedToRealtime] = useState(false);

	// Refs for cleanup and race condition prevention
	const isMountedRef = useRef(true);
	const twilioConversationRef = useRef<TwilioConversation | null>(null);
	const pendingOptimisticRef = useRef<Map<string, string>>(new Map());
	// Track optimistic message IDs separately to avoid dependency cycle
	const optimisticIdsRef = useRef<Set<string>>(new Set());

	// TanStack Query for fetching messages with automatic polling
	const {
		data: queryData,
		isLoading,
		error: queryError,
		refetch,
	} = useQuery({
		queryKey: messagesQueryKey(conversationId),
		queryFn: () => fetchMessagesFromApi(conversationId, 0, DEFAULT_PAGE_SIZE),
		// Poll every 3 seconds when NOT subscribed to Twilio realtime events
		refetchInterval: isSubscribedToRealtime ? false : POLLING_INTERVAL,
		// Always refetch on window focus
		refetchOnWindowFocus: true,
		// Keep previous data while refetching (prevents UI flicker)
		placeholderData: (previousData) => previousData,
		// Consider data stale after 2 seconds
		staleTime: 2000,
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
			const response = await fetchMessagesFromApi(conversationId, offset, DEFAULT_PAGE_SIZE);
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
			queryKey: messagesQueryKey(conversationId) 
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

				// Track mapping for real-time updates
				pendingOptimisticRef.current.set(response.twilioSid, tempId);

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
						},
					},
				});

				// Remove from optimistic tracking - message is now confirmed
				optimisticIdsRef.current.delete(tempId);
				// Track the new real ID for the next poll cycle
				optimisticIdsRef.current.add(response.id);

				// Invalidate query to sync with backend
				await queryClient.invalidateQueries({
					queryKey: messagesQueryKey(conversationId),
				});
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
	 * Handle Twilio messageAdded event
	 */
	const handleMessageAdded = useCallback(
		(twilioMessage: TwilioMessage) => {
			if (!isMountedRef.current) return;

			// Check if this is a message we sent (optimistic update already exists)
			const sid = twilioMessage.sid;
			if (pendingOptimisticRef.current.has(sid)) {
				// Already handled via API response
				pendingOptimisticRef.current.delete(sid);
				return;
			}

			// This is a new message (likely inbound or from another client)
			const newMessage: Message = {
				id: sid, // Use SID as temporary ID until we sync with backend
				conversationId,
				twilioSid: sid,
				direction: twilioMessage.author === "system" ? "outbound" : "inbound",
				authorSaxId: null,
				authorPhone: twilioMessage.author || null,
				body: twilioMessage.body || "",
				status: mapTwilioDeliveryStatus(
					twilioMessage.aggregatedDeliveryReceipt,
				),
				segmentCount: Math.ceil((twilioMessage.body?.length || 0) / 160),
				sentiment: null,
				sentimentScore: null,
				errorCode: null,
				errorMessage: null,
				createdOn:
					twilioMessage.dateCreated?.toISOString() || new Date().toISOString(),
				createdBy: null,
				sentAt: twilioMessage.dateCreated?.toISOString() || null,
				deliveredAt: null,
				readAt: null,
				active: true,
				tenantId: "",
				practiceId: "",
			};

			dispatch({ type: "ADD_MESSAGE", payload: newMessage });
		},
		[conversationId],
	);

	/**
	 * Handle Twilio messageUpdated event
	 */
	const handleMessageUpdated = useCallback(
		(data: { message: TwilioMessage; updateReasons: string[] }) => {
			if (!isMountedRef.current) return;

			const { message: twilioMessage, updateReasons } = data;

			// Only handle delivery receipt updates
			if (!updateReasons.includes("deliveryReceipt")) {
				return;
			}

			const deliveryReceipt = twilioMessage.aggregatedDeliveryReceipt;
			const updates: Partial<Message> = {};
			const status = mapTwilioDeliveryStatus(deliveryReceipt);

			updates.status = status;

			// Update timestamps based on status
			const now = new Date().toISOString();
			switch (status) {
				case "sent":
					updates.sentAt = now;
					break;
				case "delivered":
					updates.deliveredAt = now;
					break;
				case "read":
					updates.readAt = now;
					break;
				case "failed":
					updates.errorMessage = "Message delivery failed";
					break;
			}

			dispatch({
				type: "UPDATE_MESSAGE_BY_TWILIO_SID",
				payload: {
					twilioSid: twilioMessage.sid,
					updates,
				},
			});
		},
		[],
	);

	/**
	 * Subscribe to Twilio Conversation events
	 */
	useEffect(() => {
		if (!twilioClient || !conversationId) return;

		let conversation: TwilioConversation | null = null;
		let subscribed = false;

		async function subscribeToConversation() {
			if (!twilioClient) return;

			try {
				// Get the Twilio conversation by SID
				// Note: We need the Twilio SID, not our internal ID
				// The conversation SID should be fetched or passed in
				conversation = await twilioClient.getConversationBySid(conversationId);

				if (!isMountedRef.current || !conversation) return;

				twilioConversationRef.current = conversation;

				// Subscribe to events
				conversation.on("messageAdded", handleMessageAdded);
				conversation.on("messageUpdated", handleMessageUpdated);
				subscribed = true;
				setIsSubscribedToRealtime(true);
			} catch (err) {
				// If we can't find by SID, try by unique name (which might be our conversationId)
				try {
					conversation =
						await twilioClient.getConversationByUniqueName(conversationId);

					if (!isMountedRef.current || !conversation) return;

					twilioConversationRef.current = conversation;

					conversation.on("messageAdded", handleMessageAdded);
					conversation.on("messageUpdated", handleMessageUpdated);
					subscribed = true;
					setIsSubscribedToRealtime(true);
				} catch {
					// Conversation not found - this is expected when using database-backed 
					// conversations instead of Twilio Conversations SDK.
					// Polling via TanStack Query will handle real-time updates.
					setIsSubscribedToRealtime(false);
				}
			}
		}

		subscribeToConversation();

		return () => {
			if (twilioConversationRef.current) {
				twilioConversationRef.current.off("messageAdded", handleMessageAdded);
				twilioConversationRef.current.off(
					"messageUpdated",
					handleMessageUpdated,
				);
				twilioConversationRef.current = null;
			}
			if (subscribed) {
				setIsSubscribedToRealtime(false);
			}
		};
	}, [twilioClient, conversationId, handleMessageAdded, handleMessageUpdated]);

	/**
	 * Track mounted state for cleanup
	 */
	useEffect(() => {
		isMountedRef.current = true;

		return () => {
			isMountedRef.current = false;
			pendingOptimisticRef.current.clear();
		};
	}, [conversationId]);

	// Note: Polling is now handled by TanStack Query with refetchInterval

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
	};
}

export default useMessages;
