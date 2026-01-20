/**
 * SMS Outreach Integration Types
 *
 * TypeScript type definitions for the SMS Outreach feature.
 * Based on: specs/001-sms-outreach-integration/data-model.md
 */

// =============================================================================
// Enums (Union Types)
// =============================================================================

/** Conversation lifecycle status */
export type ConversationStatus = "active" | "archived";

/** SLA compliance status for response time tracking */
export type SlaStatus = "ok" | "warning" | "breached";

/** Message direction relative to the system */
export type MessageDirection = "inbound" | "outbound";

/** Message delivery status from Twilio */
export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/** Sentiment analysis result from AWS Comprehend */
export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

/** Template categorization for organization */
export type TemplateCategory =
  | "welcome"
  | "reminder"
  | "follow-up"
  | "education"
  | "general";

// =============================================================================
// Common Interfaces
// =============================================================================

/**
 * Standard audit fields used across all entities for tracking changes
 * and implementing soft delete functionality.
 */
export interface AuditFields {
  /** ISO 8601 timestamp when record was created */
  createdOn: string;
  /** SAX ID of user who created the record */
  createdBy: number | null;
  /** ISO 8601 timestamp when record was last updated */
  updatedOn: string;
  /** SAX ID of user who last updated the record */
  updatedBy: number | null;
  /** ISO 8601 timestamp when record was archived (soft deleted) */
  archivedOn: string | null;
  /** SAX ID of user who archived the record */
  archivedBy: number | null;
  /** Soft delete flag - false means record is archived */
  active: boolean;
}

/**
 * Multi-tenancy scope fields required on all tenant-scoped entities.
 * Used to ensure data isolation between tenants and practices.
 */
export interface TenantScope {
  /** UUID of the tenant organization */
  tenantId: string;
  /** UUID of the practice within the tenant */
  practiceId: string;
}

// =============================================================================
// Entity Interfaces
// =============================================================================

/**
 * SMS conversation thread between a coordinator and patient.
 * Represents a Twilio Conversation resource with additional metadata.
 */
export interface Conversation extends TenantScope, AuditFields {
  /** Internal UUID identifier */
  id: string;
  /** Twilio Conversation SID (34 characters) */
  twilioSid: string;
  /** SAX ID of the coordinator managing this conversation */
  coordinatorSaxId: number;
  /** Patient phone number in E.164 format (+1XXXXXXXXXX) */
  patientPhone: string;
  /** Display name for the conversation */
  friendlyName: string;
  /** Current conversation status */
  status: ConversationStatus;
  /** SLA compliance status based on response times */
  slaStatus: SlaStatus;
  /** Count of unread inbound messages */
  unreadCount: number;
  /** ISO 8601 timestamp of most recent message */
  lastMessageAt: string | null;
  /** Truncated preview of last message (max 160 chars) */
  lastMessagePreview: string | null;
  /** Whether the patient has opted out of messaging */
  optedOut?: boolean;
  /** Optional: SAX ID of linked patient (US3a - Patient Context) */
  patientId?: string | null;
  /** Optional: Patient first name (US3a - Patient Context) */
  patientFirstName?: string | null;
  /** Optional: Patient last name (US3a - Patient Context) */
  patientLastName?: string | null;
  /** Optional: Patient date of birth in ISO 8601 format (US3a - Patient Context) */
  patientDob?: string | null;
  /** Optional: Practice name for display context */
  practiceName?: string | null;
  /** Optional: Tenant name for display context */
  tenantName?: string | null;
  /** Optional: Tenant ID for display context */
  latestBookingStatus?: string | null;
  /** Optional: Start time of the latest Zoho booking */
  latestBookingStartTime?: string | null;
}

/**
 * Individual SMS message within a conversation.
 * Tracks Twilio message status and optional sentiment analysis.
 */
export interface Message extends TenantScope {
  /** Internal UUID identifier */
  id: string;
  /** Parent conversation UUID */
  conversationId: string;
  /** Twilio Message SID (34 characters) */
  twilioSid: string;
  /** Message direction: inbound (patient→system) or outbound (system→patient) */
  direction: MessageDirection;
  /** SAX ID of coordinator (outbound messages only) */
  authorSaxId: number | null;
  /** Phone number of sender (inbound messages only) */
  authorPhone: string | null;
  /** Message content */
  body: string;
  /** Current delivery status from Twilio */
  status: MessageStatus;
  /** Number of SMS segments (based on message length) */
  segmentCount: number;
  /** Sentiment classification from AWS Comprehend */
  sentiment: Sentiment | null;
  /** Detailed sentiment scores by category */
  sentimentScore: Record<string, number> | null;
  /** Twilio error code if delivery failed */
  errorCode: string | null;
  /** Error description if delivery failed */
  errorMessage: string | null;
  /** ISO 8601 timestamp when message was created */
  createdOn: string;
  /** SAX ID of creator */
  createdBy: number | null;
  /** ISO 8601 timestamp when message was sent to carrier */
  sentAt: string | null;
  /** ISO 8601 timestamp when delivery was confirmed */
  deliveredAt: string | null;
  /** ISO 8601 timestamp when read receipt was received */
  readAt: string | null;
  /** Soft delete flag */
  active: boolean;
}

/**
 * Reusable message template with variable substitution.
 * Templates can be global (tenant-wide) or private (coordinator-specific).
 */
export interface Template extends Omit<TenantScope, "practiceId">, AuditFields {
  /** Internal UUID identifier */
  id: string;
  /** Tenant scope */
  tenantId: string;
  /** Practice scope - null for tenant-wide templates */
  practiceId: string | null;
  /** Owner SAX ID - null for global templates */
  ownerSaxId: number | null;
  /** Template display name (max 100 chars) */
  name: string;
  /** Template category for organization */
  category: TemplateCategory;
  /** Template body with {{variable}} placeholders */
  content: string;
  /** List of variable names extracted from content */
  variables: string[];
  /** Number of times template has been used */
  usageCount: number;
}

/**
 * Response time metric for SLA tracking.
 * Created when an inbound message is received, updated when response is sent.
 */
export interface ResponseMetric extends TenantScope {
  /** Internal UUID identifier */
  id: string;
  /** Parent conversation UUID */
  conversationId: string;
  /** UUID of the inbound message that triggered the response timer */
  inboundMessageId: string;
  /** UUID of the outbound response message (null if not yet responded) */
  outboundMessageId: string | null;
  /** Response time in seconds (null if not yet responded) */
  responseTimeSeconds: number | null;
  /** SLA threshold in seconds (default: 600 = 10 minutes) */
  slaThresholdSeconds: number;
  /** Whether SLA was breached */
  slaBreached: boolean;
  /** ISO 8601 timestamp when inbound message was received */
  createdOn: string;
  /** ISO 8601 timestamp when response was sent */
  respondedAt: string | null;
}

/**
 * Pre-aggregated analytics snapshot for dashboard performance.
 * Created daily per coordinator for historical reporting.
 */
export interface AnalyticsSnapshot extends TenantScope {
  /** Internal UUID identifier */
  id: string;
  /** SAX ID of the coordinator */
  coordinatorSaxId: number;
  /** Snapshot date (YYYY-MM-DD) */
  date: string;
  /** Count of active conversations on this date */
  activeConversations: number;
  /** Count of outbound messages sent */
  messagesSent: number;
  /** Count of inbound messages received */
  messagesReceived: number;
  /** Average response time in seconds */
  avgResponseTimeSeconds: number | null;
  /** Percentage of inbound messages that received a response (0-100) */
  responseRate: number | null;
  /** Percentage of messages successfully delivered (0-100) */
  deliveryRate: number | null;
  /** Percentage of responses within SLA threshold (0-100) */
  slaComplianceRate: number | null;
  /** ISO 8601 timestamp when snapshot was created */
  createdOn: string;
}

// =============================================================================
// API Request Types
// =============================================================================

/**
 * Request payload for creating a new conversation.
 */
export interface CreateConversationRequest {
  /** Patient phone number in E.164 format (+1XXXXXXXXXX) */
  patientPhone: string;
  /** Optional SAX ID to link to existing patient record */
  patientSaxId?: number | null;
  /** Optional patient display name */
  patientName?: string | null;
  /** Optional initial message to send */
  initialMessage?: string;
  /** Optional template ID for initial message */
  templateId?: string;
  /** Variable values for template rendering */
  templateVariables?: Record<string, string>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for updating an existing conversation.
 */
export interface UpdateConversationRequest {
  /** New conversation status */
  status?: ConversationStatus;
  /** Updated patient name */
  patientName?: string;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for sending a message.
 */
export interface SendMessageRequest {
  /** Message content (max 1600 chars for multi-segment) */
  body: string;
  /** Optional template ID to track template usage */
  templateId?: string;
  /** Optional MMS media URLs (max 10) */
  mediaUrls?: string[];
}

/**
 * Request payload for creating a new template.
 */
export interface CreateTemplateRequest {
  /** Template display name (max 100 chars) */
  name: string;
  /** Template body with {{variable}} placeholders */
  body: string;
  /** Template category */
  category?: TemplateCategory;
  /** Variable names used in template */
  variables?: string[];
  /** Make template available tenant-wide (admin only) */
  isGlobal?: boolean;
}

/**
 * Request payload for updating an existing template.
 */
export interface UpdateTemplateRequest {
  /** Updated template name */
  name?: string;
  /** Updated template body */
  body?: string;
  /** Updated template content */
  content?: string;
  /** Updated template category */
  category?: TemplateCategory;
  /** Updated variable names */
  variables?: string[];
}

/**
 * Request payload for rendering a template with variables.
 */
export interface RenderTemplateRequest {
  /** Template ID to render */
  templateId: string;
  /** Variable values to substitute */
  variables: Record<string, string>;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Pagination metadata for list responses.
 */
export interface Pagination {
  /** Total number of records matching the query */
  total: number;
  /** Maximum records per page */
  limit: number;
  /** Current offset in the result set */
  offset: number;
  /** Whether more records exist beyond this page */
  hasMore: boolean;
}

/**
 * Generic paginated response wrapper.
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Pagination metadata */
  pagination: Pagination;
}

/**
 * Standard API error response.
 */
export interface ApiError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error context */
  details?: Record<string, unknown>;
}

/**
 * Rendered template response.
 */
export interface RenderTemplateResponse {
  /** The rendered message body with variables substituted */
  renderedBody: string;
  /** Number of SMS segments the rendered message will use */
  segmentCount: number;
}

// =============================================================================
// Analytics Types
// =============================================================================

/**
 * Analytics period for date range queries.
 */
export interface AnalyticsPeriod {
  /** Start date (YYYY-MM-DD) */
  startDate: string;
  /** End date (YYYY-MM-DD) */
  endDate: string;
}

/**
 * Summary analytics response.
 */
export interface AnalyticsResponse {
  /** Date range for the analytics */
  period: AnalyticsPeriod;
  /** Summary statistics */
  summary: {
    totalConversations: number;
    totalMessages: number;
    inboundMessages: number;
    outboundMessages: number;
    avgResponseTimeSeconds: number | null;
    slaComplianceRate: number | null;
    deliveryRate: number | null;
  };
  /** Sentiment distribution */
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  /** Message count by hour (0-23) */
  hourlyVolume?: Record<string, number>;
}

/**
 * SLA metrics response.
 */
export interface SlaMetrics {
  /** Date range for the metrics */
  period: AnalyticsPeriod;
  /** Overall SLA compliance percentage (0-100) */
  overallComplianceRate: number;
  /** Total number of responses measured */
  totalResponses: number;
  /** Number of SLA breaches */
  breachedCount: number;
  /** Average response time in seconds */
  avgResponseTimeSeconds: number;
  /** Response time distribution by bucket */
  responseTimeDistribution: {
    under2min: number;
    under5min: number;
    under10min: number;
    over10min: number;
  };
}
