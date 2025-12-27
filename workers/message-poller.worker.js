/**
 * Message Poller Web Worker (Pure JavaScript)
 *
 * This worker handles polling for new messages when WebSocket connections
 * are unavailable. It polls the API endpoint at configurable intervals.
 *
 * NO IMPORTS - All configuration is inlined to ensure worker executes
 */

// Inline configuration (from config/polling.ts)
const POLLING_CONFIG = {
  defaultInterval: 7000,
  minInterval: 3000,
  maxInterval: 60000,
  maxRetries: 3,
  retryDelay: 2000,
  retryBackoffMultiplier: 1.5,
  defaultFetchLimit: 20,
};

// Log worker initialization
console.log('[Worker] Message poller worker initialized (JavaScript version)');

// Internal state for tracking conversations being polled
const conversationStates = new Map();
const pollingIntervals = new Map();

/**
 * Build the API URL for fetching messages
 */
function buildApiUrl(conversationSid) {
  const baseUrl = `/outreach/api/outreach/conversations/${conversationSid}/messages`;
  const params = new URLSearchParams();
  
  console.log(`[Worker] Building API URL for ${conversationSid}: ${baseUrl}`);
  
  params.append('limit', POLLING_CONFIG.defaultFetchLimit.toString());
  params.append('order', 'desc'); // Fetch newest messages first
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Fetch messages from the API with retry logic
 */
async function fetchMessagesWithRetry(conversationSid, state, retryCount = 0) {
  const maxRetries = POLLING_CONFIG.maxRetries;
  const backoffMultiplier = POLLING_CONFIG.retryBackoffMultiplier;

  try {
    const url = buildApiUrl(conversationSid);
    console.log(`[Worker] Fetching from URL: ${url}`);
    
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
    console.log(`[Worker] Fetched ${data.data?.length || 0} messages`);

    // Reverse messages (we fetch desc, main thread expects asc)
    if (data.data && data.data.length > 0) {
      const messages = [...data.data].reverse();
      
      // Send messages to the main thread
      self.postMessage({
        type: 'MESSAGES_FETCHED',
        timestamp: Date.now(),
        conversationSid,
        payload: {
          messages,
          hasMore: data.pagination?.hasMore ?? false,
          fetchCount: messages.length,
        },
      });
    }

    // Reset error counters on success
    state.consecutiveErrors = 0;
    state.totalPolls++;
    state.lastPollTime = Date.now();
    
    // Send status update
    self.postMessage({
      type: 'POLL_STATUS',
      timestamp: Date.now(),
      conversationSid,
      payload: {
        isPolling: state.isPolling,
        interval: state.interval,
        lastPollTime: new Date(state.lastPollTime).toISOString(),
        nextPollTime: new Date(Date.now() + state.interval).toISOString(),
        totalPolls: state.totalPolls,
        consecutiveErrors: state.consecutiveErrors,
      },
    });

  } catch (error) {
    state.consecutiveErrors++;
    const willRetry = retryCount < maxRetries;
    
    console.error(`[Worker] Fetch error (retry ${retryCount}/${maxRetries}):`, error.message);
    
    // Send error to the main thread
    self.postMessage({
      type: 'POLL_ERROR',
      timestamp: Date.now(),
      conversationSid,
      payload: {
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
        },
        retryCount,
        willRetry,
      },
    });

    // Retry if we haven't exceeded max retries
    if (willRetry) {
      const backoffDelay = Math.min(
        POLLING_CONFIG.retryDelay * Math.pow(backoffMultiplier, retryCount),
        POLLING_CONFIG.maxInterval,
      );

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return fetchMessagesWithRetry(conversationSid, state, retryCount + 1);
    } else {
      // Max retries exceeded, stop polling
      state.isPolling = false;
      stopPolling(conversationSid);
    }
  }
}

/**
 * Start polling for a conversation
 */
function startPolling(conversationSid, interval) {
  console.log(`[Worker] Starting polling for ${conversationSid}`);
  
  // Stop any existing polling for this conversation
  stopPolling(conversationSid);

  // Initialize state
  const state = {
    isPolling: true,
    interval: interval ?? POLLING_CONFIG.defaultInterval,
    conversationSid,
    timerId: null,
    totalPolls: 0,
    consecutiveErrors: 0,
    lastPollTime: null,
  };

  conversationStates.set(conversationSid, state);

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
function stopPolling(conversationSid) {
  console.log(`[Worker] Stopping polling for ${conversationSid}`);
  
  const intervalId = pollingIntervals.get(conversationSid);
  if (intervalId) {
    clearInterval(intervalId);
    pollingIntervals.delete(conversationSid);
  }

  const state = conversationStates.get(conversationSid);
  if (state) {
    state.isPolling = false;
    state.timerId = null;
  }
}

/**
 * Handle incoming commands from the main thread
 */
function handleCommand(command) {
  console.log(`[Worker] Received command: ${command.type}`);
  
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
      const state = conversationStates.get(command.payload.conversationSid);
      if (state) {
        const clampedInterval = Math.max(
          POLLING_CONFIG.minInterval,
          Math.min(command.payload.interval, POLLING_CONFIG.maxInterval),
        );
        state.interval = clampedInterval;
        if (state.isPolling) {
          startPolling(command.payload.conversationSid, clampedInterval);
        }
      }
      break;

    default:
      console.warn(`[Worker] Unknown command type: ${command.type}`);
      break;
  }
}

/**
 * Set up the message listener for commands from the main thread
 */
self.onmessage = (event) => {
  console.log('[Worker] 📨 Received command from main thread:', event.data.type);
  handleCommand(event.data);
};

/**
 * Global error handler for the worker
 */
self.onerror = (error) => {
  console.error('[Worker] ❌ Global error:', {
    message: error.message,
    filename: error.filename,
    lineno: error.lineno,
    colno: error.colno,
  });
};

/**
 * Clean up when the worker is terminated
 */
self.onclose = () => {
  console.log('[Worker] Worker closing, cleaning up intervals');
  pollingIntervals.forEach((intervalId) => {
    clearInterval(intervalId);
  });
  pollingIntervals.clear();
  conversationStates.clear();
};

console.log('[Worker] ✅ Message listener registered, ready to receive commands');