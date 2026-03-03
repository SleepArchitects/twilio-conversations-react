"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  TemplateCategory,
  TemplateCategoryListResponse,
  CreateTemplateCategoryRequest,
} from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Return type for useTemplateCategories hook
 */
export interface UseTemplateCategoriesReturn {
  /** List of template categories */
  categories: TemplateCategory[];
  /** Loading state */
  isLoading: boolean;
  /** Error from fetch operations */
  error: Error | null;
  /** Create a new template category */
  createCategory: (name: string) => Promise<TemplateCategory>;
  /** Delete a template category by ID. Returns error message on 409 conflict. */
  deleteCategory: (id: string) => Promise<{ error?: string }>;
  /** Refresh categories from API */
  refresh: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_PATH = `/outreach/api/outreach/template-categories`;

/**
 * Query key factory for template categories
 */
const templateCategoriesQueryKey = () => ["template-categories"] as const;

// =============================================================================
// Fetch Function
// =============================================================================

/**
 * Fetch template categories from API
 */
async function fetchTemplateCategories(): Promise<TemplateCategory[]> {
  const response = await api.get<TemplateCategoryListResponse>(API_BASE_PATH);

  // API returns `{ data: TemplateCategory[] }`
  return response.data ?? [];
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for managing template categories with React Query.
 *
 * Features:
 * - Fetches categories from API
 * - Create new categories with POST mutation
 * - Delete categories with DELETE mutation (graceful 409 handling)
 * - Automatic caching and refetching
 *
 * @returns Category state and operations
 *
 * @example
 * ```tsx
 * const {
 *   categories,
 *   isLoading,
 *   createCategory,
 *   deleteCategory,
 *   refresh
 * } = useTemplateCategories();
 *
 * // Create a category
 * await createCategory("Follow Up");
 *
 * // Delete a category (returns error message if in use)
 * const result = await deleteCategory("category-id");
 * if (result.error) {
 *   console.warn(result.error);
 * }
 * ```
 */
export function useTemplateCategories(): UseTemplateCategoriesReturn {
  const queryClient = useQueryClient();

  // React Query for fetching categories
  const {
    data: categoriesData,
    isPending,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: templateCategoriesQueryKey(),
    queryFn: fetchTemplateCategories,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Create category mutation
  const createMutation = useMutation({
    mutationFn: async (name: string): Promise<TemplateCategory> => {
      const body: CreateTemplateCategoryRequest = { name };
      const response = await api.post<{ data: TemplateCategory }>(
        API_BASE_PATH,
        body,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: templateCategoriesQueryKey(),
      });
    },
  });

  // Delete category mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete<void>(`${API_BASE_PATH}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: templateCategoriesQueryKey(),
      });
    },
  });

  // Create category — throws on unexpected errors
  const createCategory = useCallback(
    async (name: string): Promise<TemplateCategory> => {
      return createMutation.mutateAsync(name);
    },
    [createMutation],
  );

  // Delete category — returns error message on 409 conflict, throws on other errors
  const deleteCategory = useCallback(
    async (id: string): Promise<{ error?: string }> => {
      try {
        await deleteMutation.mutateAsync(id);
        return {};
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          return { error: err.message };
        }
        throw err;
      }
    },
    [deleteMutation],
  );

  // Refresh categories
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Convert query error to Error
  const error = queryError
    ? queryError instanceof Error
      ? queryError
      : new Error(
          (queryError as { message?: string }).message ||
            "Failed to fetch template categories",
        )
    : null;

  return {
    categories: categoriesData ?? [],
    isLoading: isPending,

    error,
    createCategory,
    deleteCategory,
    refresh,
  };
}

export default useTemplateCategories;
