"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ConversationHistorySummary,
  ConversationMetrics,
  TimelineEvent,
  TimelineResponse,
} from "@/types/sms";

const API_BASE_PATH = "/api/outreach/history";

export const conversationHistoryKeys = {
  all: ["conversationHistory"] as const,
  summary: (conversationId: string) =>
    ["conversationHistory", conversationId, "summary"] as const,
  timeline: (conversationId: string, eventTypes?: string[]) =>
    [
      "conversationHistory",
      conversationId,
      "timeline",
      eventTypes ?? [],
    ] as const,
  metrics: (conversationId: string) =>
    ["conversationHistory", conversationId, "metrics"] as const,
};

// ---------------------------------------------------------------------------
// Response transformers
//
// The backend API returns snake_case keys from PostgreSQL. Our TypeScript
// types use camelCase. These functions bridge the gap at the hook boundary
// so that every consumer gets properly typed data.
// ---------------------------------------------------------------------------

interface RawSummary {
  message_count: number;
  inbound_count: number;
  outbound_count: number;
  delivery_rate: number;
  avg_response_time_minutes: number | null;
  conversation_duration_days: number;
  first_message_at: string;
  last_message_at: string;
  media_count: number;
}

function transformSummary(raw: RawSummary): ConversationHistorySummary {
  return {
    messageCount: raw.message_count,
    inboundCount: raw.inbound_count,
    outboundCount: raw.outbound_count,
    deliveryRate: raw.delivery_rate,
    avgResponseTimeMinutes: raw.avg_response_time_minutes,
    conversationDurationDays: raw.conversation_duration_days,
    firstMessageAt: raw.first_message_at,
    lastMessageAt: raw.last_message_at,
    mediaCount: raw.media_count,
  };
}

interface RawTimelineEvent {
  id: string;
  eventType: string;
  timestamp: string;
  channel: string;
  direction?: string;
  body?: string;
  status?: string;
  category?: string;
  eventTitle?: string;
  eventDetail?: string;
  mediaUrl?: string;
  senderName?: string;
}

interface RawTimelineResponse {
  data: RawTimelineEvent[];
  cursor: string | null;
  hasMore: boolean;
}

function transformTimelineEvent(raw: RawTimelineEvent): TimelineEvent {
  return {
    id: raw.id,
    type: raw.eventType as TimelineEvent["type"],
    timestamp: raw.timestamp,
    channel: raw.channel as TimelineEvent["channel"],
    direction: raw.direction,
    body: raw.body,
    status: raw.status,
    category: raw.category,
    eventTitle: raw.eventTitle,
    eventDetail: raw.eventDetail,
    mediaUrl: raw.mediaUrl,
    senderName: raw.senderName,
  };
}

function transformTimeline(raw: RawTimelineResponse): TimelineResponse {
  return {
    data: raw.data.map(transformTimelineEvent),
    cursor: raw.cursor,
    hasMore: raw.hasMore,
  };
}

// ---------------------------------------------------------------------------
// Timeline events share IDs with sms_messages. Fetch messages → build s3Key
// lookup → resolve via /media/view presigned URL endpoint. No backend changes.
// ---------------------------------------------------------------------------

interface MessageWithMedia {
  id: string;
  hasMedia: boolean;
  media: Array<{ s3Key: string; contentType: string }> | null;
}

interface MessagesResponse {
  data: MessageWithMedia[];
  pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
}

export function useMessageMediaMap(conversationId: string) {
  return useQuery({
    queryKey: ["messageMedia", conversationId] as const,
    queryFn: async () => {
      const res = await api.get<MessagesResponse>(
        `/api/outreach/conversations/${conversationId}/messages`,
        { params: { limit: "200" } },
      );
      const messages = res.data ?? [];
      const mediaMap = new Map<string, string[]>();
      for (const msg of messages) {
        if (msg.hasMedia && msg.media && msg.media.length > 0) {
          mediaMap.set(
            msg.id,
            msg.media.map((m) => m.s3Key),
          );
        }
      }
      return mediaMap;
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePresignedUrl(s3Key: string | undefined) {
  return useQuery({
    queryKey: ["presignedUrl", s3Key] as const,
    queryFn: async () => {
      const res = await api.get<{ presignedUrl: string }>(
        `/api/outreach/media/view`,
        { params: { s3Key: s3Key! } },
      );
      return res.presignedUrl;
    },
    enabled: !!s3Key,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * 60 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useConversationSummary(conversationId: string) {
  return useQuery({
    queryKey: conversationHistoryKeys.summary(conversationId),
    queryFn: async () => {
      const raw = await api.get<RawSummary>(`${API_BASE_PATH}/summary`, {
        params: { conversationId },
      });
      return transformSummary(raw);
    },
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConversationTimeline(
  conversationId: string,
  eventTypes?: string[],
) {
  return useInfiniteQuery({
    queryKey: conversationHistoryKeys.timeline(conversationId, eventTypes),
    queryFn: async ({ pageParam }) => {
      const raw = await api.get<RawTimelineResponse>(
        `${API_BASE_PATH}/timeline`,
        {
          params: {
            conversationId,
            ...(eventTypes && eventTypes.length > 0
              ? { eventTypes: eventTypes.join(",") }
              : {}),
            ...(pageParam ? { cursor: pageParam as string } : {}),
          },
        },
      );
      return transformTimeline(raw);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TimelineResponse) =>
      lastPage.hasMore ? (lastPage.cursor ?? undefined) : undefined,
    enabled: !!conversationId,
    staleTime: 30 * 1000,
  });
}

export function useConversationMetrics(conversationId: string) {
  return useQuery({
    queryKey: conversationHistoryKeys.metrics(conversationId),
    queryFn: () =>
      api.get<ConversationMetrics>(`${API_BASE_PATH}/metrics`, {
        params: { conversationId },
      }),
    enabled: !!conversationId,
    staleTime: 10 * 60 * 1000,
  });
}
