"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Send, CheckCircle, Clock } from "lucide-react";
import { MetricsSummaryCards } from "@/components/conversations/metrics/MetricsSummaryCards";
import {
  MetricsLoadingSkeleton,
  MetricsErrorState,
  MetricsEmptyBanner,
} from "@/components/conversations/metrics/MetricsStates";
import { useDashboardAnalytics } from "@/hooks/useDashboardAnalytics";
import { PageHeader } from "@/components/layout/PageHeader";
import type { MetricCardData } from "@/components/conversations/metrics/MetricsSummaryCards";

function formatDuration(days: number): string {
  if (days < 1) {
    const hours = Math.round(days * 24);
    return hours <= 1 ? "< 1 hr" : `${hours} hrs`;
  }
  return days === 1 ? "1 day" : days.toFixed(1) + " days";
}

function formatDeliveryRate(rate: number): string {
  return (rate * 100).toFixed(1) + "%";
}

function MessagesByDayChart({
  messagesByDay,
}: {
  messagesByDay: Record<string, number>;
}) {
  const entries = Object.entries(messagesByDay).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No message data available
      </p>
    );
  }

  const counts = entries.map(([, count]) => count);
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="space-y-2">
      {entries.map(([date, count]) => {
        const widthPct = Math.max((count / maxCount) * 100, 2);
        const label = new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return (
          <div key={date} className="flex items-center gap-3">
            <span className="w-16 flex-shrink-0 text-right text-xs text-gray-400">
              {label}
            </span>
            <div className="relative flex-1">
              <div
                className="h-5 rounded-sm bg-blue-600 transition-all duration-300"
                style={{ width: widthPct + "%" }}
                role="meter"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label={label + ": " + count + " messages"}
              />
            </div>
            <span className="w-8 flex-shrink-0 text-xs tabular-nums text-gray-400">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopPatientEventCategories({
  categories,
}: {
  categories: Array<{ category: string; count: number }>;
}) {
  if (categories.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500">
        No event categories recorded
      </p>
    );
  }

  const maxCount = Math.max(...categories.map((c) => c.count), 1);

  return (
    <ol className="space-y-3">
      {categories.map(({ category, count }, index) => {
        const widthPct = Math.max((count / maxCount) * 100, 2);

        return (
          <li key={category} className="flex items-center gap-3">
            <span className="w-5 flex-shrink-0 text-right text-xs font-medium text-gray-500">
              {index + 1}.
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm text-gray-200">{category}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-300"
                  style={{ width: widthPct + "%" }}
                />
              </div>
            </div>
            <span className="w-10 flex-shrink-0 text-right text-xs tabular-nums text-gray-400">
              {count.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function CommunicationMetricsPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardAnalytics();

  const backLink = (
    <Link
      href="/conversations"
      className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
      aria-label="Back to conversations"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back
    </Link>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <PageHeader
          title="Communication Metrics Dashboard"
          startAction={backLink}
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <MetricsLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const message =
      error instanceof Error ? error.message : "Failed to load analytics data.";

    return (
      <div className="min-h-screen bg-gray-900">
        <PageHeader
          title="Communication Metrics Dashboard"
          startAction={backLink}
        />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <MetricsErrorState message={message} onRetry={() => void refetch()} />
        </div>
      </div>
    );
  }

  const metrics: MetricCardData[] = [
    {
      title: "Total Conversations",
      value: data.totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: "blue",
      subtitle: data.activeConversations.toLocaleString() + " active",
    },
    {
      title: "Total Messages",
      value: data.totalMessages.toLocaleString(),
      icon: Send,
      color: "purple",
      subtitle:
        data.outboundMessages.toLocaleString() +
        " out / " +
        data.inboundMessages.toLocaleString() +
        " in",
    },
    {
      title: "Delivery Rate",
      value:
        data.deliveryRate > 0
          ? formatDeliveryRate(data.deliveryRate)
          : "\u2014",
      icon: CheckCircle,
      color: "green",
      subtitle: "Successful deliveries",
    },
    {
      title: "Avg Duration",
      value:
        data.avgConversationDurationDays > 0
          ? formatDuration(data.avgConversationDurationDays)
          : "\u2014",
      icon: Clock,
      color: "amber",
      subtitle: "Per conversation",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      <PageHeader
        title="Communication Metrics Dashboard"
        startAction={backLink}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <MetricsSummaryCards metrics={metrics} />

        {data.deliveryRate === 0 && <MetricsEmptyBanner />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section
            className="rounded-lg bg-gray-800 p-5"
            aria-labelledby="messages-by-day-heading"
          >
            <h2
              id="messages-by-day-heading"
              className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400"
            >
              Messages by Day
            </h2>
            <MessagesByDayChart messagesByDay={data.messagesByDay} />
          </section>

          <section
            className="rounded-lg bg-gray-800 p-5"
            aria-labelledby="top-events-heading"
          >
            <h2
              id="top-events-heading"
              className="mb-4 text-sm font-medium uppercase tracking-wider text-gray-400"
            >
              Top Patient Event Categories
            </h2>
            <TopPatientEventCategories categories={data.topPatientEvents} />
          </section>
        </div>
      </main>
    </div>
  );
}
