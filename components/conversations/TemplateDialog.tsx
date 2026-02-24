"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getUserFriendlyError } from "@/lib/errors";
import { useTemplateCategories } from "@/hooks/useTemplateCategories";
import { CategorySelect } from "@/components/ui/CategorySelect";
import type {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface TemplateDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Template to edit; undefined means create mode */
  template?: Template;
  /** Callback after successful save */
  onSaved: () => void;
}

interface TemplateFormState {
  name: string;
  body: string;
  categoryId: string;
}

interface TemplateFormErrors {
  name?: string;
  body?: string;
  categoryId?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract {{variable}} names from template body content.
 */
function extractVariables(body: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = [...body.matchAll(regex)];
  return Array.from(new Set(matches.map((m) => m[1])));
}

/**
 * Validate the template form fields. Returns an errors object.
 */
function validateForm(state: TemplateFormState): TemplateFormErrors {
  const errors: TemplateFormErrors = {};

  if (!state.name.trim()) {
    errors.name = "Name is required";
  } else if (state.name.trim().length > 100) {
    errors.name = "Name must be 100 characters or fewer";
  }

  if (!state.body.trim()) {
    errors.body = "Content is required";
  }

  return errors;
}

// =============================================================================
// Quick Variable Buttons
// =============================================================================

const QUICK_VARIABLES = ["patientFirstName", "patientLastName", "practiceName"];

// =============================================================================
// Component
// =============================================================================

/**
 * TemplateDialog — modal dialog for creating or editing SMS templates.
 *
 * - Loads categories dynamically via useTemplateCategories (no hardcoded list)
 * - Uses Combobox for searchable category selection
 * - Passes categoryId (UUID) to the API, not a string label
 *
 * @example
 * <TemplateDialog
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   template={selectedTemplate}
 *   onSaved={refresh}
 * />
 */
export function TemplateDialog({
  isOpen,
  onClose,
  template,
  onSaved,
}: TemplateDialogProps): React.ReactElement | null {
  const isEditMode = Boolean(template);

  // Categories from API
  const { categories, isLoading: isCategoriesLoading } =
    useTemplateCategories();

  // Map categories to CategorySelect options
  const categoryOptions = React.useMemo(
    () =>
      categories.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    [categories],
  );

  // Form state
  const [form, setForm] = React.useState<TemplateFormState>({
    name: "",
    body: "",
    categoryId: "",
  });

  const [errors, setErrors] = React.useState<TemplateFormErrors>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [detectedVariables, setDetectedVariables] = React.useState<string[]>(
    [],
  );

  // Ref for textarea cursor tracking
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const cursorPositionRef = React.useRef<number | null>(null);

  // Populate form when dialog opens or template changes
  React.useEffect(() => {
    if (isOpen) {
      setForm({
        name: template?.name ?? "",
        body: template?.content ?? "",
        categoryId: template?.category?.id ?? "",
      });
      setErrors({});
    }
  }, [isOpen, template]);

  // Detect variables whenever body changes
  React.useEffect(() => {
    setDetectedVariables(extractVariables(form.body));
  }, [form.body]);

  // Track cursor position in textarea
  const handleContentSelect = React.useCallback(() => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart;
    }
  }, []);

  // Insert a quick variable at the current cursor position
  const insertVariable = React.useCallback(
    (variable: string) => {
      const variableText = `{{${variable}}}`;
      const cursorPos = cursorPositionRef.current ?? form.body.length;
      const newBody =
        form.body.slice(0, cursorPos) +
        variableText +
        form.body.slice(cursorPos);

      setForm((prev) => ({ ...prev, body: newBody }));

      // Update cursor after re-render
      const newCursorPos = cursorPos + variableText.length;
      cursorPositionRef.current = newCursorPos;

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [form.body],
  );

  const handleCategorySelect = React.useCallback((value: string) => {
    setForm((prev) => ({ ...prev, categoryId: value }));
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, []);

  const handleSave = React.useCallback(async () => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      const variables = extractVariables(form.body);

      if (isEditMode && template) {
        const payload: UpdateTemplateRequest = {
          name: form.name.trim(),
          body: form.body.trim(),
          categoryId: form.categoryId || undefined,
          variables,
        };
        await api.patch(`/api/outreach/templates/${template.id}`, payload);
      } else {
        const payload: CreateTemplateRequest = {
          name: form.name.trim(),
          body: form.body.trim(),
          categoryId: form.categoryId || undefined,
          variables,
          isGlobal: false,
        };
        await api.post("/api/outreach/templates", payload);
      }

      onSaved();
      onClose();
    } catch (error) {
      setErrors({ name: getUserFriendlyError(error) });
    } finally {
      setIsSaving(false);
    }
  }, [form, isEditMode, template, onSaved, onClose]);

  // Dismiss on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const dialogTitle = isEditMode ? "Edit Template" : "Create Template";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      onClick={(e) => {
        // Close when clicking outside the dialog panel
        if (e.target === e.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      {/* Dialog panel */}
      <div className="flex w-full max-w-lg flex-col rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">{dialogTitle}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={isSaving}
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {/* ✕ icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {/* Name field */}
          <div>
            <label
              htmlFor="template-name"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Template Name
            </label>
            <input
              id="template-name"
              type="text"
              value={form.name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              disabled={isSaving}
              maxLength={100}
              placeholder="e.g., Appointment Reminder"
              className={cn(
                "h-10 w-full rounded-md border bg-gray-900 px-3 py-2 text-sm text-gray-100",
                "placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:cursor-not-allowed disabled:opacity-50",
                errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-600 focus:border-purple-500",
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Category field — Combobox */}
          <div>
            <label
              htmlFor="template-category"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Category
              <span className="ml-1 text-xs font-normal text-gray-500">
                (optional)
              </span>
            </label>
            {isCategoriesLoading ? (
              /* Skeleton while loading */
              <div className="h-10 w-full animate-pulse rounded-md border border-gray-600 bg-gray-800" />
            ) : (
              <CategorySelect
                options={categoryOptions}
                value={form.categoryId}
                onSelect={handleCategorySelect}
                placeholder="Select category..."
                disabled={isSaving}
              />
            )}
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-400">{errors.categoryId}</p>
            )}
          </div>

          {/* Content / Body field */}
          <div>
            <label
              htmlFor="template-body"
              className="mb-1.5 block text-sm font-medium text-gray-300"
            >
              Content
            </label>

            {/* Quick variable insertion buttons */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-500">Quick insert:</span>
              {QUICK_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={isSaving}
                  onClick={() => insertVariable(v)}
                  className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300 hover:bg-gray-600 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            <textarea
              id="template-body"
              ref={textareaRef}
              value={form.body}
              rows={6}
              disabled={isSaving}
              placeholder="Hello {{patientFirstName}}, this is a reminder for..."
              onChange={(e) => {
                setForm((prev) => ({ ...prev, body: e.target.value }));
                setErrors((prev) => ({ ...prev, body: undefined }));
              }}
              onSelect={handleContentSelect}
              onClick={handleContentSelect}
              onKeyUp={handleContentSelect}
              onBlur={handleContentSelect}
              className={cn(
                "w-full rounded-md border bg-gray-900 px-3 py-2 text-sm text-gray-100",
                "placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-800",
                "resize-y",
                errors.body
                  ? "border-red-500 focus:border-red-500"
                  : "border-gray-600 focus:border-purple-500",
              )}
            />
            {errors.body && (
              <p className="mt-1 text-xs text-red-400">{errors.body}</p>
            )}
          </div>

          {/* Detected variables chip list */}
          {detectedVariables.length > 0 && (
            <div className="rounded-md border border-blue-800/50 bg-blue-950/30 px-4 py-3">
              <p className="mb-2 text-xs font-medium text-blue-300">
                Detected variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detectedVariables.map((v) => (
                  <span
                    key={v}
                    className="rounded bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-200"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-700 px-6 py-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-md border border-gray-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || isCategoriesLoading}
            onClick={handleSave}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium text-white",
              "bg-purple-600 hover:bg-purple-700",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "inline-flex items-center gap-2",
            )}
          >
            {isSaving && (
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {isEditMode ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateDialog;
