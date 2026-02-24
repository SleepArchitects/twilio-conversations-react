"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTemplateCategories } from "@/hooks/useTemplateCategories";

// =============================================================================
// Types & Interfaces
// =============================================================================

interface CategoryManagerProps {
  /** Optional additional className for the root container */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CATEGORY_NAME_LENGTH = 50;

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function PlusIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
    </svg>
  );
}

function TrashIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 3.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-5 w-5 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="45 30"
      />
    </svg>
  );
}

function TagIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M5.5 3A2.5 2.5 0 0 0 3 5.5v2.879a2.5 2.5 0 0 0 .732 1.767l6.5 6.5a2.5 2.5 0 0 0 3.536 0l2.878-2.878a2.5 2.5 0 0 0 0-3.536l-6.5-6.5A2.5 2.5 0 0 0 8.38 3H5.5ZM6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ExclamationIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Reusable dialog overlay and content wrapper using Radix UI Dialog primitives.
 * Matches the dark theme used throughout the codebase.
 */
function DialogOverlay() {
  return (
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  ariaDescribedBy?: string;
}

function DialogContent({ children, ariaDescribedBy }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-describedby={ariaDescribedBy}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-md mx-4",
          "bg-gray-800 rounded-xl shadow-2xl border border-gray-700",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

// =============================================================================
// AddCategoryDialog
// =============================================================================

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
  isSubmitting: boolean;
}

function AddCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: AddCategoryDialogProps) {
  const [name, setName] = React.useState("");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName("");
      setNameError(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CATEGORY_NAME_LENGTH) {
      setName(value);
    }
    if (nameError) {
      setNameError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Category name is required");
      inputRef.current?.focus();
      return;
    }

    await onSubmit(trimmed);
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent ariaDescribedBy="add-category-description">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold text-white">
              Add Category
            </DialogPrimitive.Title>
            <p
              id="add-category-description"
              className="text-sm text-gray-400 mt-0.5"
            >
              Create a new template category
            </p>
          </div>
          <DialogPrimitive.Close
            onClick={handleCancel}
            disabled={isSubmitting}
            className={cn(
              "p-2 rounded-lg text-gray-400",
              "hover:text-white hover:bg-gray-700",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
            )}
            aria-label="Close dialog"
          >
            <CloseIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <div>
              <label
                htmlFor="category-name-input"
                className="block text-sm font-medium text-gray-200 mb-1.5"
              >
                Name
                <span className="text-red-400 ml-1" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                ref={inputRef}
                id="category-name-input"
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Follow Up"
                aria-required="true"
                aria-invalid={!!nameError}
                aria-describedby={
                  nameError ? "category-name-error" : "category-name-hint"
                }
                disabled={isSubmitting}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg text-sm",
                  "bg-gray-900 text-white placeholder:text-gray-500",
                  "border transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  nameError ? "border-red-500" : "border-gray-600",
                )}
              />
              <div className="flex items-center justify-between mt-1.5">
                {nameError ? (
                  <p
                    id="category-name-error"
                    className="text-sm text-red-400"
                    role="alert"
                  >
                    {nameError}
                  </p>
                ) : (
                  <p id="category-name-hint" className="text-xs text-gray-500">
                    Max {MAX_CATEGORY_NAME_LENGTH} characters
                  </p>
                )}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    name.length >= MAX_CATEGORY_NAME_LENGTH
                      ? "text-yellow-500"
                      : "text-gray-500",
                  )}
                  aria-live="polite"
                >
                  {name.length}/{MAX_CATEGORY_NAME_LENGTH}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "text-gray-300 bg-gray-700",
                "hover:bg-gray-600 hover:text-white",
                "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "text-white",
                "bg-gradient-to-r from-purple-600 to-blue-600",
                "hover:from-purple-500 hover:to-blue-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg shadow-purple-500/25",
                "transition-all",
                "flex items-center gap-2",
              )}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="h-4 w-4" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}

// =============================================================================
// DeleteConfirmDialog
// =============================================================================

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  categoryName,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  const handleCancel = () => {
    if (!isDeleting) {
      onOpenChange(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent ariaDescribedBy="delete-category-description">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/30 flex-shrink-0">
              <ExclamationIcon
                className="h-5 w-5 text-red-400"
                aria-hidden="true"
              />
            </div>
            <DialogPrimitive.Title className="text-lg font-semibold text-white">
              Delete Category
            </DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close
            onClick={handleCancel}
            disabled={isDeleting}
            className={cn(
              "p-2 rounded-lg text-gray-400",
              "hover:text-white hover:bg-gray-700",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
            )}
            aria-label="Close dialog"
          >
            <CloseIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <p id="delete-category-description" className="text-sm text-gray-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-white">
              &ldquo;{categoryName}&rdquo;
            </span>
            ?
          </p>
          <div className="rounded-md bg-amber-900/20 border border-amber-700/40 p-3 flex items-start gap-2">
            <ExclamationIcon
              className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-sm text-amber-300">
              Templates using this category will become uncategorized.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isDeleting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "text-gray-300 bg-gray-700",
              "hover:bg-gray-600 hover:text-white",
              "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "text-white bg-red-700",
              "hover:bg-red-600",
              "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
              "flex items-center gap-2",
            )}
          >
            {isDeleting ? (
              <>
                <SpinnerIcon className="h-4 w-4" aria-hidden="true" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </DialogContent>
    </DialogPrimitive.Root>
  );
}

// =============================================================================
// CategoryManager Component
// =============================================================================

/**
 * CategoryManager — settings panel for managing template categories.
 *
 * Features:
 * - Lists categories in a sortable table view showing Name, Display Order, and Actions
 * - "Add Category" button opens a dialog with validated name input (max 50 chars)
 * - Delete with confirmation dialog, warning about uncategorized templates
 * - Handles 409 conflict on delete with a toast notification
 * - Loading and empty states
 *
 * @example
 * ```tsx
 * // In a settings page
 * <CategoryManager />
 * ```
 */
export function CategoryManager({ className }: CategoryManagerProps) {
  const { categories, isLoading, error, createCategory, deleteCategory } =
    useTemplateCategories();

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateCategory = React.useCallback(
    async (name: string) => {
      setIsCreating(true);
      try {
        await createCategory(name);
        setAddDialogOpen(false);
        toast.success(`Category "${name}" created`);
      } catch {
        toast.error("Failed to create category. Please try again.");
      } finally {
        setIsCreating(false);
      }
    },
    [createCategory],
  );

  const handleDeleteClick = React.useCallback((id: string, name: string) => {
    setCategoryToDelete({ id, name });
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteCategory(categoryToDelete.id);
      if (result.error) {
        // 409 conflict — category is in use
        toast.error("Cannot delete: category in use");
        setDeleteDialogOpen(false);
        setCategoryToDelete(null);
        return;
      }
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      toast.success(`Category "${categoryToDelete.name}" deleted`);
    } catch {
      toast.error("Failed to delete category. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [categoryToDelete, deleteCategory]);

  const handleDeleteDialogChange = React.useCallback(
    (open: boolean) => {
      if (!isDeleting) {
        setDeleteDialogOpen(open);
        if (!open) {
          setCategoryToDelete(null);
        }
      }
    },
    [isDeleting],
  );

  // ---------------------------------------------------------------------------
  // Sorted categories by displayOrder then name
  // ---------------------------------------------------------------------------

  const sortedCategories = React.useMemo(
    () =>
      [...categories].sort((a, b) => {
        const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      }),
    [categories],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            Template Categories
          </h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Organize templates by category
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "text-white",
            "bg-gradient-to-r from-purple-600 to-blue-600",
            "hover:from-purple-500 hover:to-blue-500",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "shadow-lg shadow-purple-500/25",
            "transition-all",
          )}
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Category
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="rounded-md bg-red-900/30 border border-red-800/50 p-4 flex items-start gap-3"
          role="alert"
        >
          <ExclamationIcon
            className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-red-300">
              Failed to load categories
            </p>
            <p className="text-sm text-red-400 mt-0.5">{error.message}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div
          className="rounded-lg border border-gray-700 overflow-hidden"
          aria-busy="true"
          aria-label="Loading categories"
        >
          <div className="bg-gray-700/40 px-4 py-3 grid grid-cols-[1fr_120px_80px] gap-4">
            <div className="h-3 w-16 bg-gray-600 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-600 rounded animate-pulse" />
            <div className="h-3 w-12 bg-gray-600 rounded animate-pulse" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="px-4 py-3.5 grid grid-cols-[1fr_120px_80px] gap-4 border-t border-gray-700"
            >
              <div className="h-4 w-32 bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-8 bg-gray-700 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sortedCategories.length === 0 && (
        <div className="rounded-lg border border-gray-700 border-dashed">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-700 mb-3">
              <TagIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-gray-300">
              No categories yet
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Create your first category.
            </p>
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className={cn(
                "mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                "text-purple-300 bg-purple-900/30 border border-purple-700/40",
                "hover:bg-purple-900/50 hover:text-purple-200",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
                "transition-colors",
              )}
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Add Category
            </button>
          </div>
        </div>
      )}

      {/* Categories table */}
      {!isLoading && !error && sortedCategories.length > 0 && (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-700/40 border-b border-gray-700">
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-36"
                >
                  Display Order
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-24"
                >
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((category, index) => (
                <tr
                  key={category.id}
                  className={cn(
                    "transition-colors",
                    index !== sortedCategories.length - 1 &&
                      "border-b border-gray-700",
                    "hover:bg-gray-700/20",
                  )}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <TagIcon
                        className="h-4 w-4 text-gray-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-medium text-gray-100">
                        {category.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-gray-400 tabular-nums">
                      {category.displayOrder ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteClick(category.id, category.name)
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium",
                        "text-gray-400 bg-gray-700/50",
                        "hover:text-red-300 hover:bg-red-900/30 hover:border-red-700/40",
                        "border border-transparent",
                        "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                        "transition-colors",
                      )}
                      aria-label={`Delete category ${category.name}`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Category Dialog */}
      <AddCategoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleCreateCategory}
        isSubmitting={isCreating}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogChange}
        categoryName={categoryToDelete?.name ?? ""}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default CategoryManager;
