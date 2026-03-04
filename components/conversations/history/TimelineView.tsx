"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { TimelineFilters } from "./TimelineFilters";
import { TimelineEventCard } from "./TimelineEventCard";
import { useConversationTimeline } from "@/hooks/useConversationHistory";
import type { TimelineEvent } from "@/types/sms";

interface TimelineViewProps {
  conversationId: string;
}

function TimelineSkeleton() {
  return (
    <div className="relative flex flex-col gap-8 py-6">
      <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gray-700" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "relative flex w-full",
            i % 2 === 0 ? "justify-start pr-[52%]" : "justify-end pl-[52%]",
          )}
        >
          <div className="absolute left-1/2 top-4 h-3 w-3 -translate-x-1/2 rounded-full bg-gray-700" />
          <div className="w-full animate-pulse rounded-lg bg-gray-800 p-4">
            <div className="mb-3 h-4 w-2/3 rounded bg-gray-700" />
            <div className="mb-2 h-3 w-full rounded bg-gray-700" />
            <div className="h-3 w-1/2 rounded bg-gray-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <Inbox className="h-10 w-10" />
      <p className="text-sm">No history events found</p>
    </div>
  );
}

function TimelineError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <AlertCircle className="h-10 w-10 text-red-400" />
      <p className="text-sm text-gray-400">Failed to load timeline</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Retry
      </button>
    </div>
  );
}

function ZigzagEvent({
  event,
  index,
}: {
  event: TimelineEvent;
  index: number;
}) {
  const isLeft = index % 2 === 0;

  return (
    <div
      className={cn(
        "relative flex w-full",
        isLeft ? "justify-start pr-[52%]" : "justify-end pl-[52%]",
      )}
    >
      <div
        className={cn(
          "absolute left-1/2 top-4 h-3 w-3 -translate-x-1/2 rounded-full",
          event.type === "sms" ? "bg-green-500" : "bg-purple-500",
        )}
      />
      <div className="w-full">
        <TimelineEventCard event={event} />
      </div>
    </div>
  );
}

export function TimelineView({ conversationId }: TimelineViewProps) {
  const [activeFilters, setActiveFilters] = React.useState<string[]>([]);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationTimeline(
    conversationId,
    activeFilters.length > 0 ? activeFilters : undefined,
  );

  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "100px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allEvents = React.useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  return (
    <div className="flex flex-col gap-4">
      <TimelineFilters
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />

      {isLoading && <TimelineSkeleton />}

      {isError && <TimelineError onRetry={() => refetch()} />}

      {!isLoading && !isError && allEvents.length === 0 && <TimelineEmpty />}

      {!isLoading && !isError && allEvents.length > 0 && (
        <div className="relative flex flex-col gap-6 py-6">
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-gray-700" />

          {allEvents.map((event, index) => (
            <ZigzagEvent key={event.id} event={event} index={index} />
          ))}

          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimelineView;
