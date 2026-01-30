"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL = 45 * 60 * 1000; // 45 minutes

/**
 * Periodically calls /api/auth/set-cookie to refresh session cookies.
 * Prevents session timeout during long user sessions.
 *
 * @example
 * export default function App() {
 *   useSessionHeartbeat();
 *   return <div>App content</div>;
 * }
 */
export function useSessionHeartbeat(): void {
  useEffect(() => {
    const heartbeat = async () => {
      try {
        await fetch("/api/auth/set-cookie", { method: "POST" });
      } catch (error) {
        console.error("Session heartbeat failed:", error);
      }
    };

    // Initial call
    heartbeat();

    const intervalId = setInterval(heartbeat, HEARTBEAT_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);
}
