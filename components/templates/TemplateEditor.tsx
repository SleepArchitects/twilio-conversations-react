"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Card, Badge } from "flowbite-react";
import { HiInformationCircle } from "react-icons/hi";
import { type Template, type TemplateCategory } from "@/types/sms";
import { cn } from "@/lib/utils";

// Schema for template validation
const templateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  category: z.enum([
    "welcome",
    "reminder",
    "follow-up",
    "education",
    "general",
  ] as const),
  content: z.string().min(1, "Content is required"),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateEditorProps {
  template?: Template;
  onSave: (data: TemplateFormData) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "welcome", label: "Welcome" },
  { value: "reminder", label: "Reminder" },
  { value: "follow-up", label: "Follow-up" },
  { value: "education", label: "Education" },
  { value: "general", label: "General" },
];

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isSaving = false,
}: TemplateEditorProps) {
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPositionRef = useRef<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || "",
      category: template?.category || "general",
      content: template?.content || "",
    },
  });

  // Store the register result so we can combine it with our ref
  const contentRegister = register("content");

  const content = watch("content");

  // Auto-detect variables from content using regex {{variableName}}
  useEffect(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = [...content.matchAll(regex)];
    const variables = Array.from(new Set(matches.map((m) => m[1])));
    setDetectedVariables(variables);
  }, [content]);

  // Track cursor position when textarea loses focus or selection changes
  const handleContentSelect = () => {
    if (textareaRef.current) {
      cursorPositionRef.current = textareaRef.current.selectionStart;
    }
  };

  const insertVariable = (variable: string) => {
    const currentContent = watch("content");
    const variableText = `{{${variable}}}`;

    // Get cursor position (default to end if not set)
    const cursorPos = cursorPositionRef.current ?? currentContent.length;

    // Insert at cursor position
    const newContent =
      currentContent.slice(0, cursorPos) +
      variableText +
      currentContent.slice(cursorPos);

    // Update the DOM element directly first
    if (textareaRef.current) {
      textareaRef.current.value = newContent;

      // Dispatch an input event to notify React Hook Form of the change
      const event = new Event("input", { bubbles: true });
      textareaRef.current.dispatchEvent(event);
    }

    // Also update form value via setValue to ensure internal state is synced
    setValue("content", newContent, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });

    // Update cursor position ref to be after the inserted variable
    const newCursorPos = cursorPos + variableText.length;
    cursorPositionRef.current = newCursorPos;

    // Refocus textarea and set cursor position after the inserted variable
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const onSubmit = async (data: TemplateFormData) => {
    await onSave(data);
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
          >
            Template Name
          </label>
          <input
            type="text"
            id="name"
            {...register("name")}
            className={cn(
              "block w-full rounded-lg border p-2.5 text-sm",
              errors.name
                ? "border-red-500 bg-red-50 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-700 dark:text-red-500 dark:placeholder-red-500"
                : "border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500",
            )}
            placeholder="e.g., Appointment Reminder"
          />
          {errors.name && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-500">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
          >
            Category
          </label>
          <select
            id="category"
            {...register("category")}
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-500">
              {errors.category.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="content"
            className="mb-2 block text-sm font-medium text-gray-900 dark:text-white"
          >
            Content
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Quick variables:
            </span>
            {["patientFirstName", "patientLastName", "practiceName"].map(
              (v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  {`{{${v}}}`}
                </button>
              ),
            )}
          </div>
          <textarea
            id="content"
            rows={6}
            {...contentRegister}
            ref={(e) => {
              contentRegister.ref(e);
              textareaRef.current = e;
            }}
            onSelect={handleContentSelect}
            onBlur={(e) => {
              contentRegister.onBlur(e);
              handleContentSelect();
            }}
            onClick={handleContentSelect}
            onKeyUp={handleContentSelect}
            className={cn(
              "block w-full rounded-lg border p-2.5 text-sm",
              errors.content
                ? "border-red-500 bg-red-50 text-red-900 placeholder-red-700 focus:border-red-500 focus:ring-red-500 dark:border-red-500 dark:bg-gray-700 dark:text-red-500 dark:placeholder-red-500"
                : "border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500",
            )}
            placeholder="Hello {{patientFirstName}}, this is a reminder for..."
          />
          {errors.content && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-500">
              {errors.content.message}
            </p>
          )}
        </div>

        {detectedVariables.length > 0 && (
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="h-5 w-5 text-blue-600 dark:text-blue-500" />
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">
                Detected Variables
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {detectedVariables.map((variable) => (
                <Badge key={variable} color="info">
                  {variable}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button color="gray" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isProcessing={isSaving} disabled={isSaving}>
            {template ? "Save Changes" : "Create Template"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
