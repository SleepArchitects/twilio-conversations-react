"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardAnalytics } from "@/types/sms";

interface UseDashboardAnalyticsOptions {
  showOnlyMine?: boolean;
  saxId?: number;
}

export function useDashboardAnalytics({
  showOnlyMine,
  saxId,
}: UseDashboardAnalyticsOptions = {}) {
  return useQuery({
    queryKey: ["dashboardAnalytics", { showOnlyMine, saxId }],
    queryFn: () =>
      api.get<DashboardAnalytics>("/api/outreach/analytics/dashboard", {
        params:
          showOnlyMine && saxId ? { assigned_to: String(saxId) } : undefined,
      }),
    staleTime: 5 * 60 * 1000,
  });
}
