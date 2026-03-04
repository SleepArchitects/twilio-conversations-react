"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ConversationHistorySummary,
  ConversationMetrics,
  TimelineResponse,
} from "@/types/sms";

const API_BASE_PATH = "/api/outreach/history";

export const conversationHistoryKeys = {
  all: ["conversationHistory"] as const,
  summary: (conversationId: string) =>
    ["conversationHistory", conversationId, "summary"] as const,
  timeline: (conversationId: string, eventTypes?: string[]) =>
    ["conversationHistory", conversationId, "timeline", eventTypes ?? []] as const,
  metrics: (conversationId: string) =>
    ["conversationHistory", conversationId, "metrics"] as const,
};

export function useConversationSummary(conversationId: string) {
  return useQuery({
    queryKey: conversationHistoryKeys.summary(conversationId),
    queryFn: () =>
      api.get<ConversationHistorySummary>(`${API_BASE_PATH}/summary`, {
        params: { conversationId },
      }),
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
    queryFn: ({ pageParam }) =>
      api.get<TimelineResponse>(`${API_BASE_PATH}/timeline`, {
        params: {
          conversationId,
          ...(eventTypes && eventTypes.length > 0
            ? { eventTypes: eventTypes.join(",") }
            : {}),
          ...(pageParam ? { cursor: pageParam as string } : {}),
        },
      }),
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
