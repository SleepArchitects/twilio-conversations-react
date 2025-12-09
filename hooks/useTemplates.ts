"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { api, ApiError } from "@/lib/api";
import type { Template, TemplateCategory, PaginatedResponse } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * API response type for templates list
 * Note: API returns `body` but TypeScript type uses `content`
 */
interface TemplateApiResponse {
  id: string;
  tenantId: string;
  practiceId: string | null;
  name: string;
  body: string; // API uses "body"
  category: TemplateCategory;
  variables: string[];
  isGlobal: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdOn: string;
  updatedOn: string;
  active: boolean;
}

interface TemplatesListResponse {
  data: TemplateApiResponse[];
}

/**
 * Options for the useTemplates hook
 */
export interface UseTemplatesOptions {
  /** Filter by template category */
  category?: TemplateCategory | "all";
  /** Whether to include global templates (default: true) */
  includeGlobal?: boolean;
  /** Search query for filtering templates */
  searchQuery?: string;
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
}

/**
 * Return type for useTemplates hook
 */
export interface UseTemplatesReturn {
  /** List of templates */
  templates: Template[];
  /** Currently selected template */
  selectedTemplate: Template | null;
  /** Loading state */
  isLoading: boolean;
  /** Error from fetch operations */
  error: Error | null;
  /** Select a template by ID */
  selectTemplate: (templateId: string | null) => void;
  /** Select a template object */
  selectTemplateObject: (template: Template | null) => void;
  /** Refresh templates from API */
  refresh: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_PATH = "/api/outreach/templates";

/**
 * Query key factory for templates
 */
const templatesQueryKey = (category?: TemplateCategory | "all", includeGlobal?: boolean) =>
  ["templates", category, includeGlobal] as const;

/**
 * Map API response to Template type
 * Converts `body` to `content` and adds missing fields
 */
function mapApiTemplateToTemplate(apiTemplate: TemplateApiResponse): Template {
  return {
    id: apiTemplate.id,
    tenantId: apiTemplate.tenantId,
    practiceId: apiTemplate.practiceId,
    ownerSaxId: null, // Not provided by API, set to null
    name: apiTemplate.name,
    category: apiTemplate.category,
    content: apiTemplate.body, // Map body to content
    variables: apiTemplate.variables,
    usageCount: apiTemplate.usageCount,
    createdOn: apiTemplate.createdOn,
    updatedOn: apiTemplate.updatedOn,
    createdBy: null, // Not provided by API
    updatedBy: null, // Not provided by API
    archivedOn: null, // Not provided by API
    archivedBy: null, // Not provided by API
    active: apiTemplate.active,
  };
}

/**
 * Fetch templates from API
 */
async function fetchTemplates(
  category?: TemplateCategory | "all",
  includeGlobal: boolean = true,
): Promise<Template[]> {
  const params: Record<string, string | boolean> = {};
  
  if (category && category !== "all") {
    params.category = category;
  }
  
  if (includeGlobal !== undefined) {
    params.includeGlobal = includeGlobal;
  }

  const response = await api.get<TemplatesListResponse>(API_BASE_PATH, {
    params,
  });

  return response.data.map(mapApiTemplateToTemplate);
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for managing template state with React Query.
 *
 * Features:
 * - Fetches templates from API
 * - Supports category filtering
 * - Supports search (client-side)
 * - Manages template selection state
 * - Automatic caching and refetching
 *
 * @param options - Hook configuration options
 * @returns Template state and operations
 *
 * @example
 * ```tsx
 * const {
 *   templates,
 *   selectedTemplate,
 *   isLoading,
 *   selectTemplate,
 *   refresh
 * } = useTemplates({
 *   category: "reminder",
 *   searchQuery: "appointment"
 * });
 * ```
 */
export function useTemplates(
  options: UseTemplatesOptions = {},
): UseTemplatesReturn {
  const {
    category = "all",
    includeGlobal = true,
    searchQuery = "",
    autoFetch = true,
  } = options;

  // Selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // React Query for fetching templates
  const {
    data: templatesData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: templatesQueryKey(category, includeGlobal),
    queryFn: () => fetchTemplates(category, includeGlobal),
    enabled: autoFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change frequently
  });

  // Client-side search filtering
  const templates = useMemo(() => {
    if (!templatesData) return [];

    if (!searchQuery.trim()) {
      return templatesData;
    }

    const query = searchQuery.toLowerCase().trim();
    return templatesData.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query),
    );
  }, [templatesData, searchQuery]);

  // Get selected template object
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || !templatesData) return null;
    return templatesData.find((t) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, templatesData]);

  // Select template by ID
  const selectTemplate = useCallback((templateId: string | null) => {
    setSelectedTemplateId(templateId);
  }, []);

  // Select template by object
  const selectTemplateObject = useCallback((template: Template | null) => {
    setSelectedTemplateId(template?.id || null);
  }, []);

  // Refresh templates
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Convert query error to Error
  const error = queryError
    ? (queryError instanceof Error
        ? queryError
        : new Error(
            (queryError as { message?: string }).message ||
              "Failed to fetch templates",
          ))
    : null;

  return {
    templates,
    selectedTemplate,
    isLoading,
    error,
    selectTemplate,
    selectTemplateObject,
    refresh,
  };
}

// =============================================================================
// Frequent Templates Hook
// =============================================================================

/**
 * Query key factory for frequent templates
 */
const frequentTemplatesQueryKey = () => ["templates", "frequent"] as const;

/**
 * Fetch frequent templates from API
 */
async function fetchFrequentTemplates(): Promise<Template[]> {
  const response = await api.get<TemplatesListResponse>(
    `${API_BASE_PATH}/frequent`,
  );
  return response.data.map(mapApiTemplateToTemplate);
}

/**
 * React hook for fetching frequent templates.
 *
 * Returns the top N most frequently used templates for the current coordinator.
 *
 * @param limit - Maximum number of templates to return (default: 5)
 * @returns Frequent templates query result
 *
 * @example
 * ```tsx
 * const { data: frequentTemplates, isLoading } = useFrequentTemplates(5);
 * ```
 */
export function useFrequentTemplates(limit: number = 5) {
  return useQuery({
    queryKey: frequentTemplatesQueryKey(),
    queryFn: fetchFrequentTemplates,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    select: (data) => data.slice(0, limit), // Limit results client-side
  });
}

export default useTemplates;
