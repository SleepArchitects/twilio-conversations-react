"use client";

import { useState } from "react";
import { Button, Card, Modal } from "flowbite-react";
import { HiPlus, HiTrash, HiExclamation } from "react-icons/hi";
import { useTemplateCategories } from "@/hooks/useTemplateCategories";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

/**
 * CategoryManager component for managing SMS template categories.
 *
 * Displays existing categories and allows creating/deleting them.
 * Handles 409 conflict (category in use) gracefully.
 *
 * @example
 * ```tsx
 * // In settings page
 * <CategoryManager />
 * ```
 */
export function CategoryManager() {
  const { categories, isLoading, createCategory, deleteCategory } =
    useTemplateCategories();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      await createCategory(trimmed);
      setNewCategoryName("");
      toast.success(`Category "${trimmed}" created`);
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const result = await deleteCategory(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Category "${deleteTarget.name}" deleted`);
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getUserFriendlyError(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isCreating && newCategoryName.trim()) {
      handleCreate();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Create new category */}
      <div>
        <label
          htmlFor="new-category-name"
          className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
        >
          New Category
        </label>
        <div className="flex gap-2">
          <input
            id="new-category-name"
            type="text"
            placeholder="e.g. Follow Up, Appointment Reminder..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={80}
            aria-label="New category name"
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          />
          <Button
            color="blue"
            onClick={handleCreate}
            disabled={!newCategoryName.trim() || isCreating}
            isProcessing={isCreating}
            aria-label="Create category"
          >
            <HiPlus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* Category list */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
          Existing Categories
          {!isLoading && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({categories.length})
            </span>
          )}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
            <span className="text-sm">Loading categories...</span>
          </div>
        ) : categories.length === 0 ? (
          <Card className="border-dashed">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              No categories yet. Add one above to get started.
            </p>
          </Card>
        ) : (
          <ul
            className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
            aria-label="Template categories"
          >
            {categories.map((category) => (
              <li
                key={category.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3",
                  "bg-white dark:bg-gray-800",
                  "first:rounded-t-lg last:rounded-b-lg",
                )}
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {category.name}
                </span>
                <button
                  onClick={() => handleDeleteClick(category.id, category.name)}
                  aria-label={`Delete category ${category.name}`}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        show={deleteTarget !== null}
        size="md"
        onClose={() => setDeleteTarget(null)}
        popup
      >
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiExclamation className="mx-auto mb-4 h-14 w-14 text-yellow-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Delete &ldquo;{deleteTarget?.name}&rdquo;?
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              This cannot be undone. Categories in use by templates cannot be
              deleted.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                color="failure"
                onClick={handleConfirmDelete}
                isProcessing={isDeleting}
              >
                Delete
              </Button>
              <Button color="gray" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
