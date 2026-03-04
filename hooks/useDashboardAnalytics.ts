"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardAnalytics } from "@/types/sms";

const DASHBOARD_ANALYTICS_KEY = ["dashboardAnalytics"] as const;

export function useDashboardAnalytics() {
  return useQuery({
    queryKey: DASHBOARD_ANALYTICS_KEY,
    queryFn: () =>
      api.get<DashboardAnalytics>("/api/outreach/analytics/dashboard"),
    staleTime: 5 * 60 * 1000,
  });
}
