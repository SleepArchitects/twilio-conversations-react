"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { MetricsSummaryCards } from "@/components/conversations/metrics/MetricsSummaryCards";
import {
  MetricsLoadingSkeleton,
  MetricsErrorState,
  MetricsEmptyBanner,
} from "@/components/conversations/metrics/MetricsStates";
import { TimelineView } from "@/components/conversations/metrics/TimelineView";
import { useConversationSummary } from "@/hooks/useConversationMetrics";
import { PageHeader } from "@/components/layout/PageHeader";
import { api } from "@/lib/api";
import type { Conversation } from "@/types/sms";
import type { MetricCardData } from "@/components/conversations/metrics/MetricsSummaryCards";

// =============================================================================
// Internal Hook
// =============================================================================

interface ConversationResponse {
  data: Conversation;
}

function useConversation(conversationId: string) {
  return useQuery({
    queryKey: ["conversations", conversationId] as const,
    queryFn: () =>
      api.get<ConversationResponse>(
        `/api/outreach/conversations/${conversationId}`,
      ),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// Helpers
// =============================================================================

function formatPatientName(conversation: Conversation | undefined): string {
  if (!conversation) return "Patient";

  const firstName = conversation.patientFirstName?.trim();
  const lastName = conversation.patientLastName?.trim();

  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;

  return conversation.friendlyName || conversation.patientPhone || "Patient";
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr`;
}

function formatDuration(days: number): string {
  if (days === 0) return "< 1 day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

function formatDeliveryRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// =============================================================================
// Page Component
// =============================================================================

/**
 * Communication Metrics Page
 *
 * Displays communication metrics for a single conversation, including:
 * - Summary metrics (message counts, delivery rate, response time, duration)
 * - Interactive timeline of all events
 */
export default function ConversationMetricsPage(): React.ReactElement {
  const params = useParams();
  const conversationId = params.id as string;

  const conversationQuery = useConversation(conversationId);
  const summaryQuery = useConversationSummary(conversationId);

  const conversation = conversationQuery.data?.data;
  const summary = summaryQuery.data;

  const patientName = formatPatientName(conversation);

  const backLink = (
    <Link
      href={`/conversations/${conversationId}`}
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
      aria-label="Back to conversation"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Link>
  );

  // ==========================================================================
  // Loading State
  // ==========================================================================

  if (conversationQuery.isLoading || summaryQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <PageHeader
          title="Communication Metrics"
          startAction={backLink}
        />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <MetricsLoadingSkeleton />
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Error State
  // ==========================================================================

  const error = conversationQuery.error ?? summaryQuery.error;

  if (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load metrics";
    return (
      <div className="min-h-screen bg-gray-900">
        <PageHeader
          title="Communication Metrics"
          startAction={backLink}
        />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <MetricsErrorState
            message={message}
            onRetry={() => {
              void conversationQuery.refetch();
              void summaryQuery.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Build Metrics
  // ==========================================================================

  const metrics: MetricCardData[] = [
    {
      title: "Total Messages",
      value: summary?.messageCount ?? 0,
      icon: MessageSquare,
      color: "blue",
      subtitle: summary
        ? `${summary.inboundCount} inbound · ${summary.outboundCount} outbound`
        : undefined,
    },
    {
      title: "Delivery Rate",
      value: summary ? formatDeliveryRate(summary.deliveryRate) : "—",
      icon: Send,
      color: "green",
      subtitle: "Outbound messages delivered",
    },
    {
      title: "Avg Response Time",
      value: formatResponseTime(summary?.avgResponseTimeMinutes ?? null),
      icon: Clock,
      color: "purple",
      subtitle: "Time to first response",
    },
    {
      title: "Duration",
      value: summary ? formatDuration(summary.conversationDurationDays) : "—",
      icon: TrendingUp,
      color: "amber",
      subtitle: summary?.firstMessageAt
        ? `Since ${new Date(summary.firstMessageAt).toLocaleDateString()}`
        : undefined,
    },
  ];

  const showMetricsEmptyBanner =
    summary !== undefined &&
    summary.deliveryRate === 0 &&
    summary.messageCount > 0;

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gray-900">
      <PageHeader
        title={`Communication Metrics — ${patientName}`}
        startAction={backLink}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Metrics cards */}
        <section aria-label="Conversation metrics">
          <MetricsSummaryCards metrics={metrics} />
        </section>

        {/* Empty metrics banner (deliveryRate 0 but messages exist) */}
        {showMetricsEmptyBanner && <MetricsEmptyBanner />}

        {/* Event timeline */}
        <section aria-label="Event timeline">
          <TimelineView conversationId={conversationId} />
        </section>
      </div>
    </div>
  );
}
