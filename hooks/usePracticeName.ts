"use client";

import { useQuery } from "@tanstack/react-query";

interface PracticeResponse {
  name?: string;
}

interface PracticeListItem {
  practice_id?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Fetch practice name (and full practices list) via /api/practices, with a
 * fallback to /api/profile when needed.
 */
export function usePracticeName(practiceId?: string | null) {
  return useQuery({
    // Key remains stable; practiceId retained for backward compatibility
    queryKey: ["practice", practiceId || "list"],
    enabled: true,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PracticeResponse> => {
      const baseUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "";
      const practicesUrl = `${baseUrl}/api/practices`;
      const profileUrl = `${baseUrl}/api/profile`;

      try {
        // Attempt to fetch all practices first so we can return the full list
        // and derive the name without hitting the per-id endpoint.
        const practicesRes = await fetch(practicesUrl, {
          method: "GET",
          credentials: "include",
        });

        if (practicesRes.ok) {
          const list = (await practicesRes.json()) as PracticeListItem[];
          const match = practiceId
            ? list.find((p) => p.practice_id === practiceId)
            : undefined;
          if (match?.name) {
            return { name: match.name };
          }
        } else if (practicesRes.status !== 401 && practicesRes.status !== 403) {
          // Only raise if it's not an auth/forbidden scenario; otherwise fall back to profile
          throw new Error(`Failed to fetch practices list: ${practicesRes.status}`);
        }

        // Fallback to profile to extract practice_name
        const profileRes = await fetch(profileUrl, {
          method: "GET",
          credentials: "include",
        });

        if (!profileRes.ok) {
          if (profileRes.status === 401 || profileRes.status === 403) {
            console.warn(
              `[usePracticeName] Permission denied fetching practice profile; falling back to defaults`,
            );
            return {};
          }
          throw new Error(`Failed to fetch practice profile: ${profileRes.status}`);
        }

        const data = await profileRes.json();
        const profileName = data?.profile?.practice_name;
        return profileName ? { name: profileName } : {};
      } catch (error) {
        console.error("[usePracticeName] Error fetching practice profile", error);
        return {};
      }
    },
  });
}

export default usePracticeName;
