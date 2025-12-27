/**
 * Message Poller Web Worker
 *
 * This worker handles polling for new messages when WebSocket connections
 * are unavailable. It polls the API endpoint at configurable intervals
 * and uses a "Safety Net" strategy: continuously fetching the latest messages.
 *
 * @reasoning Used shannonthinking to determine optimal approach:
 * - Constraint: Web Worker environment with no DOM access
 * - Decision: Use setInterval for polling and fetch API for HTTP requests
 * - Rationale: Web Workers provide non-blocking background execution
 */

// Import types and configuration
import type { WorkerCommand, WorkerMessage, WorkerState } from '../types/worker';
import { POLLING_CONFIG } from '../config/polling';

// Log worker initialization
console.log('[Worker] Message poller worker initialized');

// Internal state for tracking conversations being polled
const conversationStates = new Map<string, WorkerState>();

// Track active polling intervals
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

/**
 * Send a message to the main thread
 */
function postMessage(message: WorkerMessage): void {
  self.postMessage(message);
}

/**
 * Send a status update to the main thread
 */
function sendStatus(conversationSid: string, state: WorkerState): void {
  postMessage({
    type: 'POLL_STATUS',
    timestamp: Date.now(),
    conversationSid,
    payload: {
      isPolling: state.isPolling,
      interval: state.interval,
      lastPollTime: state.lastPollTime ? new Date(state.lastPollTime).toISOString() : undefined,
      nextPollTime: state.isPolling ? new Date(Date.now() + state.interval).toISOString() : undefined,
      totalPolls: state.totalPolls,
      consecutiveErrors: state.consecutiveErrors,
    },
  });
}

/**
 * Send an error message to the main thread
 */
function sendError(conversationSid: string, error: Error, retryCount: number, willRetry: boolean): void {
  postMessage({
    type: 'POLL_ERROR',
    timestamp: Date.now(),
    conversationSid,
    payload: {
      error: {
        message: error.message,
        code: (error as any).code || 'UNKNOWN_ERROR',
      },
      retryCount,
      willRetry,
    },
  });
}

/**
 * Send fetched messages to the main thread
 */
function sendMessages(conversationSid: string, messages: any[], hasMore: boolean): void {
  postMessage({
    type: 'MESSAGES_FETCHED',
    timestamp: Date.now(),
    conversationSid,
    payload: {
      messages,
      hasMore,
      fetchCount: messages.length,
    },
  });
}

/**
 * Build the API URL for the "Safety Net" strategy
 * Note: In production with basePath="/outreach", Next.js handles the prefix automatically
 * In the worker context, we need to include it explicitly
 */
function buildApiUrl(conversationSid: string): string {
  // Include /outreach basePath for multi-zone setup
  const baseUrl = `/outreach/api/outreach/conversations/${conversationSid}/messages`;
  const params = new URLSearchParams();

  console.log(`[Worker] Building API URL for ${conversationSid}: ${baseUrl}`);

  // "Safety Net" strategy: fetch the latest messages
  params.append('limit', POLLING_CONFIG.defaultFetchLimit.toString());
  params.append('order', 'desc');

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Fetch messages from the API with retry logic
 */
async function fetchMessagesWithRetry(
  conversationSid: string,
  state: WorkerState,
  retryCount = 0,
): Promise<void> {
  const maxRetries = POLLING_CONFIG.maxRetries;
  const backoffMultiplier = POLLING_CONFIG.retryBackoffMultiplier;

  try {
    const url = buildApiUrl(conversationSid);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      console.error(`[Worker] Fetch failed: ${response.status} ${response.statusText} for URL: ${url}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[Worker] Fetched ${data.messages?.length || 0} messages`);

    // Safety Net: we fetch in desc order (newest first) but the main thread expects asc (oldest first)
    if (data.messages && data.messages.length > 0) {
      const messages = [...data.messages].reverse();
      
      // Send messages to the main thread
      sendMessages(conversationSid, messages, data.hasMore ?? false);
    }

    // Reset error counters on success
    state.consecutiveErrors = 0;
    state.totalPolls++;
    state.lastPollTime = Date.now();
    sendStatus(conversationSid, state);

  } catch (error) {
    const err = error as Error;
    state.consecutiveErrors++;

    // Determine if we should retry
    const willRetry = retryCount < maxRetries;

    // Send error to the main thread
    sendError(conversationSid, err, retryCount, willRetry);

    // Retry if we haven't exceeded max retries
    if (willRetry) {
      const backoffDelay = Math.min(
        POLLING_CONFIG.retryDelay * Math.pow(backoffMultiplier, retryCount),
        POLLING_CONFIG.maxInterval,
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return fetchMessagesWithRetry(conversationSid, state, retryCount + 1);
    } else {
      // Max retries exceeded, stop polling
      state.isPolling = false;
      sendStatus(conversationSid, state);
      stopPolling(conversationSid);
    }
  }
}

/**
 * Start polling for a conversation
 */
function startPolling(conversationSid: string, interval?: number): void {
  // Stop any existing polling for this conversation
  stopPolling(conversationSid);

  // Initialize state
  const state: WorkerState = {
    isPolling: true,
    interval: interval ?? POLLING_CONFIG.defaultInterval,
    conversationSid,
    timerId: null,
    totalPolls: 0,
    consecutiveErrors: 0,
    lastPollTime: null,
  };

  conversationStates.set(conversationSid, state);
  sendStatus(conversationSid, state);

  // Set up the polling interval
  const intervalId = setInterval(() => {
    const currentState = conversationStates.get(conversationSid);
    if (currentState && currentState.isPolling) {
      fetchMessagesWithRetry(conversationSid, currentState);
    }
  }, state.interval);

  pollingIntervals.set(conversationSid, intervalId);

  // Initial fetch
  fetchMessagesWithRetry(conversationSid, state);
}

/**
 * Stop polling for a conversation
 */
function stopPolling(conversationSid: string): void {
  const intervalId = pollingIntervals.get(conversationSid);
  if (intervalId) {
    clearInterval(intervalId);
    pollingIntervals.delete(conversationSid);
  }

  const state = conversationStates.get(conversationSid);
  if (state) {
    state.isPolling = false;
    state.timerId = null;
    sendStatus(conversationSid, state);
  }
}

/**
 * Update the polling interval for a conversation
 */
function updateInterval(conversationSid: string, newInterval: number): void {
  const state = conversationStates.get(conversationSid);
  if (!state) {
    return;
  }

  // Validate the interval
  const clampedInterval = Math.max(
    POLLING_CONFIG.minInterval,
    Math.min(newInterval, POLLING_CONFIG.maxInterval),
  );

  state.interval = clampedInterval;

  // Restart polling with the new interval if currently polling
  if (state.isPolling) {
    startPolling(conversationSid, clampedInterval);
  } else {
    sendStatus(conversationSid, state);
  }
}

/**
 * Handle incoming commands from the main thread
 */
function handleCommand(command: WorkerCommand): void {
  switch (command.type) {
    case 'START_POLLING':
      startPolling(
        command.payload.conversationSid,
        command.payload.interval,
      );
      break;

    case 'STOP_POLLING':
      stopPolling(command.payload.conversationSid);
      break;

    case 'UPDATE_INTERVAL':
      updateInterval(command.payload.conversationSid, command.payload.interval);
      break;

    default:
      // Unknown command type - ignore
      break;
  }
}

/**
 * Set up the message listener for commands from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerCommand>): void => {
  handleCommand(event.data);
};

/**
 * Clean up when the worker is terminated
 */
self.onclose = (): void => {
  // Clear all polling intervals
  pollingIntervals.forEach((intervalId) => {
    clearInterval(intervalId);
  });
  pollingIntervals.clear();
  conversationStates.clear();
};

// Export for testing purposes (in non-worker environments)
export type {
  WorkerCommand,
  WorkerMessage,
  WorkerState,
};
