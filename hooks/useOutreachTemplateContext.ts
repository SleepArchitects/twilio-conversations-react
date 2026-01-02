"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export const OUTREACH_TEMPLATE_CONTEXT_KEY = "sax-outreach-template-context";

export interface OutreachTemplateContext {
  practiceId?: string;
  practiceName?: string;
  tenantId?: string;
  tenantName?: string;
  saxId?: string;
  userEmail?: string;
  userName?: string;
  practicesByTenant?: Record<string, unknown[]>;
  patientId?: string;
  patientFirstName?: string;
  patientLastName?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  lastSource?: string;
  updatedAt?: string;
}

const parseContext = (raw: string | null): OutreachTemplateContext | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OutreachTemplateContext;
    return parsed ?? null;
  } catch (error) {
    console.warn("[useOutreachTemplateContext] failed to parse context", error);
    return null;
  }
};

/**
 * Reads the outreach template context from sessionStorage so the composer can
 * hydrate template variables without extra API calls.
 */
export function useOutreachTemplateContext() {
  const [context, setContext] = useState<OutreachTemplateContext | null>(null);

  const readContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    return parseContext(
      window.sessionStorage.getItem(OUTREACH_TEMPLATE_CONTEXT_KEY),
    );
  }, []);

  const refresh = useCallback(() => {
    setContext(readContext());
  }, [readContext]);

  useEffect(() => {
    refresh();

    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== OUTREACH_TEMPLATE_CONTEXT_KEY) return;
      refresh();
    };

    const handleVisibility = () => refresh();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [refresh]);

  const hasContext = useMemo(() => {
    if (!context) return false;
    return Object.values(context).some(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }, [context]);

  return {
    context: context ?? {},
    hasContext,
    refresh,
  };
}

export default useOutreachTemplateContext;
