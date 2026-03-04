"use client";

import { AlertCircle, Inbox, Info } from "lucide-react";

export function MetricsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border-l-4 border-l-gray-600 bg-gray-800 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-gray-700" />
                <div className="h-7 w-16 rounded bg-gray-700" />
                <div className="h-3 w-24 rounded bg-gray-700" />
              </div>
              <div className="h-8 w-8 rounded bg-gray-700" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg bg-gray-800 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-gray-700" />
                <div className="h-3 w-48 rounded bg-gray-700" />
              </div>
              <div className="h-5 w-16 rounded-full bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-gray-800 py-12 text-center">
      <Inbox className="h-12 w-12 text-gray-500" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-medium text-white">
        No communication metrics yet
      </h3>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        Data collection starts now that delivery tracking is enabled
      </p>
    </div>
  );
}

interface MetricsErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function MetricsErrorState({ message, onRetry }: MetricsErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-gray-800 py-12 text-center">
      <AlertCircle className="h-10 w-10 text-red-400" aria-hidden="true" />
      <p className="mt-3 text-sm text-gray-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Retry
      </button>
    </div>
  );
}

interface MetricsEmptyBannerProps {
  message?: string;
}

export function MetricsEmptyBanner({
  message = "Historical delivery data unavailable — metrics will populate for new messages",
}: MetricsEmptyBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-900/20 px-4 py-3 text-sm text-blue-200">
      <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
