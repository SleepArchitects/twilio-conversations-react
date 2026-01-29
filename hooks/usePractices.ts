"use client";

import { useQuery } from "@tanstack/react-query";

interface Practice {
  practice_id: string;
  name: string;
}

export function usePractices() {
  return useQuery({
    queryKey: ["practices", "list"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Practice[]> => {
      const baseUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "";
      const response = await fetch(`${baseUrl}/api/practices`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch practices: ${response.status}`);
      }
      const practices = (await response.json()) as Practice[];
      return practices.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export default usePractices;
