/**
 * Polling Configuration for Twilio Conversations Fallback
 *
 * This file contains configuration constants for the polling mechanism
 * used as a fallback when WebSocket connections are unavailable.
 */

// ============================================================================
// POLLING INTERVALS
// ============================================================================

/**
 * Default polling interval in milliseconds (7 seconds)
 * This balances between real-time updates and reduced server load
 */
export const DEFAULT_POLLING_INTERVAL = 7000;

/**
 * Minimum allowed polling interval (3 seconds)
 * Prevents excessive polling that could overwhelm the server
 */
export const MIN_POLLING_INTERVAL = 3000;

/**
 * Maximum allowed polling interval (60 seconds)
 * Prevents polling that's too infrequent for real-time updates
 */
export const MAX_POLLING_INTERVAL = 60000;

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

/**
 * Maximum number of retry attempts for failed polls
 */
export const MAX_POLL_RETRIES = 3;

/**
 * Delay between retry attempts in milliseconds
 */
export const RETRY_DELAY = 2000;

/**
 * Maximum consecutive errors before stopping polling
 */
export const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Exponential backoff multiplier for retries
 */
export const RETRY_BACKOFF_MULTIPLIER = 1.5;

// ============================================================================
// INCREMENTAL FETCHING
// ============================================================================

/**
 * Default number of messages to fetch per poll
 * Uses incremental fetching to reduce payload size
 */
export const DEFAULT_FETCH_LIMIT = 20;

/**
 * Maximum number of messages to fetch per poll
 */
export const MAX_FETCH_LIMIT = 100;

/**
 * Minimum number of messages to fetch per poll
 */
export const MIN_FETCH_LIMIT = 5;

/**
 * Whether to use incremental fetching by default
 */
export const DEFAULT_INCREMENTAL_FETCHING = true;

// ============================================================================
// WORKER CONFIGURATION
// ============================================================================

/**
 * Default worker configuration
 */
export const DEFAULT_WORKER_CONFIG = {
  defaultInterval: DEFAULT_POLLING_INTERVAL,
  maxRetries: MAX_POLL_RETRIES,
  retryDelay: RETRY_DELAY,
  maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS,
} as const;

/**
 * Worker initialization timeout in milliseconds
 */
export const WORKER_INIT_TIMEOUT = 5000;

/**
 * Worker termination timeout in milliseconds
 */
export const WORKER_TERMINATION_TIMEOUT = 3000;

// ============================================================================
// POLLING STRATEGY
// ============================================================================

/**
 * Polling strategies available
 */
export type PollingStrategy = "fixed" | "adaptive" | "exponential-backoff";

/**
 * Default polling strategy
 * - fixed: Always use the same interval
 * - adaptive: Adjust interval based on network conditions
 * - exponential-backoff: Increase interval after errors
 */
export const DEFAULT_POLLING_STRATEGY: PollingStrategy = "fixed";

/**
 * Adaptive polling configuration
 */
export const ADAPTIVE_POLLING_CONFIG = {
  minInterval: MIN_POLLING_INTERVAL,
  maxInterval: MAX_POLLING_INTERVAL,
  targetLatency: 1000, // Target network latency in ms
  adjustmentFactor: 0.1, // How much to adjust interval per poll
} as const;

// ============================================================================
// MESSAGE FETCHING
// ============================================================================

/**
 * Default message order for fetching
 */
export type MessageOrder = "asc" | "desc";

/**
 * Default message order (newest first)
 */
export const DEFAULT_MESSAGE_ORDER: MessageOrder = "desc";

/**
 * Message fetch timeout in milliseconds
 */
export const MESSAGE_FETCH_TIMEOUT = 10000;

// ============================================================================
// STATUS REPORTING
// ============================================================================

/**
 * Interval for sending status updates from worker (in milliseconds)
 */
export const STATUS_REPORT_INTERVAL = 30000;

/**
 * Whether to enable detailed logging in worker
 */
export const ENABLE_WORKER_LOGGING = false;

/**
 * Whether to enable performance metrics collection
 */
export const ENABLE_PERFORMANCE_METRICS = true;

// ============================================================================
// WEBSOCKET FALLBACK TRIGGERS
// ============================================================================

/**
 * Conditions that trigger polling fallback
 */
export type FallbackTrigger =
  | "connection-failed"
  | "connection-timeout"
  | "connection-lost"
  | "manual-trigger";

/**
 * WebSocket connection timeout before triggering fallback (ms)
 */
export const WEBSOCKET_CONNECTION_TIMEOUT = 10000;

/**
 * Number of consecutive WebSocket failures before fallback
 */
export const WEBSOCKET_FAILURE_THRESHOLD = 3;

/**
 * Delay before attempting WebSocket reconnection (ms)
 */
export const WEBSOCKET_RECONNECT_DELAY = 5000;

// ============================================================================
// EXPORTED CONFIGURATION OBJECT
// ============================================================================

/**
 * Complete polling configuration
 */
export const POLLING_CONFIG = {
  // Intervals
  defaultInterval: DEFAULT_POLLING_INTERVAL,
  minInterval: MIN_POLLING_INTERVAL,
  maxInterval: MAX_POLLING_INTERVAL,

  // Retry behavior
  maxRetries: MAX_POLL_RETRIES,
  retryDelay: RETRY_DELAY,
  maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS,
  retryBackoffMultiplier: RETRY_BACKOFF_MULTIPLIER,

  // Incremental fetching
  defaultFetchLimit: DEFAULT_FETCH_LIMIT,
  maxFetchLimit: MAX_FETCH_LIMIT,
  minFetchLimit: MIN_FETCH_LIMIT,
  incrementalFetching: DEFAULT_INCREMENTAL_FETCHING,

  // Worker
  workerConfig: DEFAULT_WORKER_CONFIG,
  workerInitTimeout: WORKER_INIT_TIMEOUT,
  workerTerminationTimeout: WORKER_TERMINATION_TIMEOUT,

  // Strategy
  defaultStrategy: DEFAULT_POLLING_STRATEGY,
  adaptiveConfig: ADAPTIVE_POLLING_CONFIG,

  // Message fetching
  defaultMessageOrder: DEFAULT_MESSAGE_ORDER,
  messageFetchTimeout: MESSAGE_FETCH_TIMEOUT,

  // Status and logging
  statusReportInterval: STATUS_REPORT_INTERVAL,
  enableWorkerLogging: ENABLE_WORKER_LOGGING,
  enablePerformanceMetrics: ENABLE_PERFORMANCE_METRICS,

  // WebSocket fallback
  websocketConnectionTimeout: WEBSOCKET_CONNECTION_TIMEOUT,
  websocketFailureThreshold: WEBSOCKET_FAILURE_THRESHOLD,
  websocketReconnectDelay: WEBSOCKET_RECONNECT_DELAY,
} as const;
