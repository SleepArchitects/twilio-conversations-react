/**
 * Worker Communication Types for Polling Fallback Mechanism
 *
 * This file defines the TypeScript interfaces for communication between
 * the main thread and Web Workers used for polling the API
 * when WebSocket connections are unavailable.
 */

import type { Message } from "./sms";

// ============================================================================
// COMMAND TYPES (Main Thread → Worker)
// ============================================================================

/**
 * Commands that can be sent from the main thread to the worker
 */
export type WorkerCommandType =
  | "START_POLLING"
  | "STOP_POLLING"
  | "UPDATE_INTERVAL";

/**
 * Base interface for all commands sent to the worker
 */
export interface BaseWorkerCommand {
  type: WorkerCommandType;
  timestamp: number;
}

/**
 * Command to start polling for messages
 */
export interface StartPollingCommand extends BaseWorkerCommand {
  type: "START_POLLING";
  payload: {
    conversationSid: string;
    interval?: number; // Optional override of default interval
  };
}

/**
 * Command to stop polling
 */
export interface StopPollingCommand extends BaseWorkerCommand {
  type: "STOP_POLLING";
  payload: {
    conversationSid: string;
  };
}

/**
 * Command to update the polling interval
 */
export interface UpdateIntervalCommand extends BaseWorkerCommand {
  type: "UPDATE_INTERVAL";
  payload: {
    conversationSid: string;
    interval: number; // New interval in milliseconds
  };
}

/**
 * Union type for all worker commands
 */
export type WorkerCommand =
  | StartPollingCommand
  | StopPollingCommand
  | UpdateIntervalCommand;

// ============================================================================
// MESSAGE TYPES (Worker → Main Thread)
// ============================================================================

/**
 * Message types that can be sent from the worker to the main thread
 */
export type WorkerMessageType =
  | "MESSAGES_FETCHED"
  | "POLL_ERROR"
  | "POLL_STATUS";

/**
 * Base interface for all messages from the worker
 */
export interface BaseWorkerMessage {
  type: WorkerMessageType;
  timestamp: number;
  conversationSid: string;
}

/**
 * Message containing fetched messages from the API
 * Messages are returned in the full Message interface format
 */
export interface MessagesFetchedMessage extends BaseWorkerMessage {
  type: "MESSAGES_FETCHED";
  payload: {
    messages: Message[]; // Full Message objects from API
    hasMore: boolean; // Whether more messages are available
    fetchCount: number; // Number of messages fetched
  };
}

/**
 * Message indicating a polling error occurred
 */
export interface PollErrorMessage extends BaseWorkerMessage {
  type: "POLL_ERROR";
  payload: {
    error: {
      message: string;
      code?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details?: Record<string, any>;
    };
    retryCount: number;
    willRetry: boolean;
  };
}

/**
 * Message indicating the current polling status
 */
export interface PollStatusMessage extends BaseWorkerMessage {
  type: "POLL_STATUS";
  payload: {
    isPolling: boolean;
    interval: number;
    lastPollTime?: string;
    nextPollTime?: string;
    totalPolls: number;
    consecutiveErrors: number;
  };
}

/**
 * Union type for all worker messages
 */
export type WorkerMessage =
  | MessagesFetchedMessage
  | PollErrorMessage
  | PollStatusMessage;

// ============================================================================
// WORKER STATE TYPES
// ============================================================================

/**
 * Internal state maintained by the worker
 */
export interface WorkerState {
  isPolling: boolean;
  interval: number;
  conversationSid: string | null;
  timerId: number | null;
  totalPolls: number;
  consecutiveErrors: number;
  lastPollTime: number | null;
}

/**
 * Configuration options for the worker
 */
export interface WorkerConfig {
  defaultInterval: number;
  maxRetries: number;
  retryDelay: number;
  maxConsecutiveErrors: number;
}
