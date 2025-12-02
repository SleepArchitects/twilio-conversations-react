"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Client, ConnectionState } from "@twilio/conversations";

/**
 * Token response from /api/outreach/token endpoint
 */
interface TokenResponse {
	token: string;
	identity: string;
	expiresAt: string;
}

/**
 * Return type for useTwilioClient hook
 */
interface UseTwilioClientReturn {
	client: Client | null;
	isConnected: boolean;
	isLoading: boolean;
	error: Error | null;
}

/**
 * Fetch Twilio access token from the backend
 * Note: Uses /outreach basePath for multi-zone integration
 */
async function fetchToken(): Promise<TokenResponse> {
	const response = await fetch("/outreach/api/outreach/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		credentials: "include",
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			errorData.error || `Failed to fetch token: ${response.status}`,
		);
	}

	return response.json();
}

/**
 * Calculate the refresh delay based on token expiry
 * Refreshes at 50% of TTL to ensure we always have a valid token
 */
function calculateRefreshDelay(expiresAt: string): number {
	const expiryTime = new Date(expiresAt).getTime();
	const now = Date.now();
	const ttl = expiryTime - now;

	// Refresh at 50% of remaining TTL
	// Minimum 30 seconds, maximum 30 minutes
	const refreshDelay = Math.max(30_000, Math.min(ttl * 0.5, 30 * 60 * 1000));

	return refreshDelay;
}

/**
 * React hook for initializing and managing Twilio Conversations Client
 *
 * Features:
 * - Fetches token from /outreach/api/outreach/token
 * - Handles automatic token refresh at 50% of TTL
 * - Manages connection state
 * - Cleans up client on unmount
 *
 * @returns {UseTwilioClientReturn} Object containing client, connection state, loading state, and error
 *
 * @example
 * ```tsx
 * const { client, isConnected, isLoading, error } = useTwilioClient();
 *
 * if (isLoading) return <div>Connecting...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!isConnected) return <div>Disconnected</div>;
 *
 * // Use client for conversations
 * ```
 */
export function useTwilioClient(): UseTwilioClientReturn {
	const [client, setClient] = useState<Client | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	// Refs to track initialization state and cleanup
	const clientRef = useRef<Client | null>(null);
	const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef(true);

	/**
	 * Schedule token refresh before expiry
	 */
	const scheduleTokenRefresh = useCallback((expiresAt: string) => {
		// Clear any existing refresh timeout
		if (refreshTimeoutRef.current) {
			clearTimeout(refreshTimeoutRef.current);
		}

		const delay = calculateRefreshDelay(expiresAt);

		refreshTimeoutRef.current = setTimeout(async () => {
			if (!isMountedRef.current || !clientRef.current) return;

			try {
				const { token, expiresAt: newExpiresAt } = await fetchToken();

				if (isMountedRef.current && clientRef.current) {
					// Update client token
					await clientRef.current.updateToken(token);

					// Schedule next refresh
					scheduleTokenRefresh(newExpiresAt);
				}
			} catch (err) {
				console.error("Failed to refresh Twilio token:", err);
				// Don't set error state for refresh failures - let the client handle disconnection
			}
		}, delay);
	}, []);

	/**
	 * Handle connection state changes
	 */
	const handleConnectionStateChanged = useCallback((state: ConnectionState) => {
		if (!isMountedRef.current) return;

		switch (state) {
			case "connected":
				setIsConnected(true);
				setIsLoading(false);
				setError(null);
				break;
			case "connecting":
				setIsLoading(true);
				break;
			case "disconnecting":
			case "disconnected":
				setIsConnected(false);
				setIsLoading(false);
				break;
			case "denied":
				setIsConnected(false);
				setIsLoading(false);
				setError(new Error("Connection denied - authentication failed"));
				break;
			default:
				// Handle any unexpected states
				break;
		}
	}, []);

	/**
	 * Initialize Twilio Client
	 */
	useEffect(() => {
		isMountedRef.current = true;

		async function initializeClient() {
			try {
				setIsLoading(true);
				setError(null);

				// Fetch initial token
				const { token, expiresAt } = await fetchToken();

				if (!isMountedRef.current) return;

				// Create Twilio Conversations Client
				const twilioClient = new Client(token);
				clientRef.current = twilioClient;

				// Set up connection state listener
				twilioClient.on("connectionStateChanged", handleConnectionStateChanged);

				// Handle token expiration events
				twilioClient.on("tokenAboutToExpire", async () => {
					try {
						const { token: newToken, expiresAt: newExpiresAt } =
							await fetchToken();
						if (clientRef.current) {
							await clientRef.current.updateToken(newToken);
							scheduleTokenRefresh(newExpiresAt);
						}
					} catch (err) {
						console.error(
							"Failed to refresh token on tokenAboutToExpire:",
							err,
						);
					}
				});

				twilioClient.on("tokenExpired", async () => {
					try {
						const { token: newToken, expiresAt: newExpiresAt } =
							await fetchToken();
						if (clientRef.current) {
							await clientRef.current.updateToken(newToken);
							scheduleTokenRefresh(newExpiresAt);
						}
					} catch (err) {
						console.error("Failed to refresh token on tokenExpired:", err);
						if (isMountedRef.current) {
							setError(new Error("Token expired and refresh failed"));
						}
					}
				});

				// Update state
				setClient(twilioClient);

				// Schedule proactive token refresh at 50% TTL
				scheduleTokenRefresh(expiresAt);
			} catch (err) {
				if (isMountedRef.current) {
					const error =
						err instanceof Error
							? err
							: new Error("Failed to initialize Twilio client");
					setError(error);
					setIsLoading(false);
				}
			}
		}

		initializeClient();

		// Cleanup on unmount
		return () => {
			isMountedRef.current = false;

			// Clear refresh timeout
			if (refreshTimeoutRef.current) {
				clearTimeout(refreshTimeoutRef.current);
				refreshTimeoutRef.current = null;
			}

			// Shutdown Twilio client
			if (clientRef.current) {
				clientRef.current.removeAllListeners();
				clientRef.current.shutdown();
				clientRef.current = null;
			}

			setClient(null);
			setIsConnected(false);
		};
	}, [handleConnectionStateChanged, scheduleTokenRefresh]);

	return {
		client,
		isConnected,
		isLoading,
		error,
	};
}

export default useTwilioClient;
