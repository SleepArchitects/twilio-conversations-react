"use client";

import { useState, useEffect, useRef, useCallback, useReducer } from "react";
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
			return {
				...state,
				messages: state.messages.map((m) =>
					m.id === id ? { ...m, ...updates } : m,
				),
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

	// State
	const [state, dispatch] = useReducer(messageReducer, {
		messages: initialMessages,
		messageIds: new Set(initialMessages.map((m) => m.id)),
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [hasMore, setHasMore] = useState(true);
	const [offset, setOffset] = useState(0);

	// Refs for cleanup and race condition prevention
	const isMountedRef = useRef(true);
	const twilioConversationRef = useRef<TwilioConversation | null>(null);
	const fetchVersionRef = useRef(0);
	const pendingOptimisticRef = useRef<Map<string, string>>(new Map());

	/**
	 * Fetch messages from API
	 */
	const fetchMessages = useCallback(
		async (reset = true) => {
			const fetchVersion = ++fetchVersionRef.current;

			try {
				if (reset) {
					setIsLoading(true);
					setError(null);
				}

				const currentOffset = reset ? 0 : offset;

				const response = await api.get<PaginatedResponse<Message>>(
					`${API_BASE_PATH}/conversations/${conversationId}/messages`,
					{
						params: {
							limit: DEFAULT_PAGE_SIZE,
							offset: currentOffset,
							order: "asc",
						},
					},
				);

				// Check for race conditions
				if (!isMountedRef.current || fetchVersion !== fetchVersionRef.current) {
					return;
				}

				if (reset) {
					dispatch({ type: "SET_MESSAGES", payload: response.data });
					setOffset(response.data.length);
				} else {
					dispatch({ type: "PREPEND_MESSAGES", payload: response.data });
					setOffset(currentOffset + response.data.length);
				}

				setHasMore(response.pagination.hasMore);
			} catch (err) {
				if (!isMountedRef.current || fetchVersion !== fetchVersionRef.current) {
					return;
				}

				const error =
					err instanceof Error ? err : new Error("Failed to fetch messages");
				setError(error);
				console.error("Failed to fetch messages:", {
					conversationId,
					error: err instanceof ApiError ? err.code : "unknown",
				});
			} finally {
				if (isMountedRef.current && fetchVersion === fetchVersionRef.current) {
					setIsLoading(false);
				}
			}
		},
		[conversationId, offset],
	);

	/**
	 * Load more (older) messages
	 */
	const loadMore = useCallback(async () => {
		if (!hasMore || isLoading) return;
		await fetchMessages(false);
	}, [fetchMessages, hasMore, isLoading]);

	/**
	 * Refresh messages (reset and fetch from beginning)
	 */
	const refresh = useCallback(async () => {
		await fetchMessages(true);
	}, [fetchMessages]);

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
				setError(null);

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

				// Update optimistic message with real data
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

				// Update the messageIds set with the real ID
				dispatch({ type: "REMOVE_OPTIMISTIC", payload: tempId });
				dispatch({ type: "ADD_MESSAGE", payload: response });
			} catch (err) {
				if (!isMountedRef.current) return;

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
				setError(error);
				throw error;
			} finally {
				if (isMountedRef.current) {
					setIsSending(false);
				}
			}
		},
		[conversationId],
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
			} catch (err) {
				// If we can't find by SID, try by unique name (which might be our conversationId)
				try {
					conversation =
						await twilioClient.getConversationByUniqueName(conversationId);

					if (!isMountedRef.current || !conversation) return;

					twilioConversationRef.current = conversation;

					conversation.on("messageAdded", handleMessageAdded);
					conversation.on("messageUpdated", handleMessageUpdated);
				} catch {
					// Conversation not found - this is expected if Twilio SID is different
					console.debug("Could not subscribe to Twilio conversation events:", {
						conversationId,
					});
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
		};
	}, [twilioClient, conversationId, handleMessageAdded, handleMessageUpdated]);

	/**
	 * Initial fetch on mount
	 */
	useEffect(() => {
		isMountedRef.current = true;
		fetchMessages(true);

		return () => {
			isMountedRef.current = false;
			pendingOptimisticRef.current.clear();
		};
	}, [conversationId]); // Only re-fetch when conversationId changes

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
