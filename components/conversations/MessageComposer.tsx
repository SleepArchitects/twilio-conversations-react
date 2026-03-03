"use client";

import * as React from "react";
import { HiTemplate, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { Tooltip } from "flowbite-react";
import {
  Paperclip,
  Image as ImageIcon,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { QuickTemplateButton } from "@/components/templates/QuickTemplateButton";
import { useTemplates, useFrequentTemplates } from "@/hooks/useTemplates";
import {
  EmojiPicker,
  type EmojiSelectData,
} from "@/components/conversations/EmojiPicker";
import { EmojiPickerButton } from "@/components/conversations/EmojiPickerButton";
import { insertEmojiAtCursor, addToRecentEmojis } from "@/lib/emoji";
import {
  detectUnresolvedVariables,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/templates";
import type { Template, PendingAttachment } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface MessageComposerProps {
  /** Callback when message is sent - includes optional templateId for usage tracking */
  onSend: (
    message: string,
    templateId?: string,
    attachmentIds?: string[],
  ) => Promise<void>;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Maximum character length (default: 1600 for 10 segments) */
  maxLength?: number;
  /** Values to substitute into templates (e.g., patient context) */
  variableValues?: Record<string, string>;
  /** Map of pending attachments by fileId */
  pendingAttachments?: Map<string, PendingAttachment>;
  /** Callback to upload a new attachment */
  onUploadAttachment?: (file: File) => Promise<unknown>;
  /** Callback to cancel an in-flight upload */
  onCancelUpload?: (fileId: string) => void;
  /** Callback to remove a completed upload */
  onRemoveAttachment?: (fileId: string) => void;
  /** Callback to retry a failed upload */
  onRetryUpload?: (fileId: string) => void;
}

const MAX_FILES = 5;
const MAX_TOTAL_SIZE_DISPLAY_MB = 25;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// =============================================================================
// SMS Segment Calculation Utilities
// =============================================================================

/**
 * GSM-7 character limits for SMS segments
 * - First segment: 160 characters
 * - Subsequent segments: 153 characters (7 chars used for UDH header)
 */
const GSM7_FIRST_SEGMENT = 160;
const GSM7_SUBSEQUENT_SEGMENT = 153;

/**
 * Calculate the number of SMS segments for a given message length
 * Assumes GSM-7 encoding (ASCII characters)
 */
function calculateSegmentCount(characterCount: number): number {
  if (characterCount === 0) return 0;
  if (characterCount <= GSM7_FIRST_SEGMENT) return 1;

  // For multi-segment messages, each segment uses 153 chars
  // because 7 chars are reserved for the UDH (User Data Header)
  return Math.ceil(characterCount / GSM7_SUBSEQUENT_SEGMENT);
}

/**
 * Get the character count color class based on count thresholds
 */
function getCharacterCountColor(count: number): string {
  if (count > GSM7_FIRST_SEGMENT) return "text-red-500";
  if (count > 140) return "text-yellow-500";
  return "text-gray-400";
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean;
}

/** Send icon (paper airplane) */
function SendIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
    </svg>
  );
}

/** Loading spinner icon */
function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      className={cn("h-5 w-5 animate-spin", className)}
      {...props}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="40 20"
      />
    </svg>
  );
}

/** Close icon */
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

// =============================================================================
// Attachment Preview Component
// =============================================================================

function AttachmentPreview({
  attachment,
  onCancel,
  onRemove,
  onRetry,
}: {
  attachment: PendingAttachment;
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(attachment.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment.file]);

  const sizeStr = formatFileSize(attachment.file.size);
  const isInFlight =
    attachment.status === "uploading" || attachment.status === "pending";
  const progressValue =
    attachment.status === "pending" ? 0 : attachment.progress;

  return (
    <div className="relative group flex-shrink-0 w-48 rounded-lg overflow-hidden border border-gray-700 bg-gray-800 flex flex-col">
      <div className="h-24 relative overflow-hidden bg-black/50">
        {objectUrl ? (
          <img
            src={objectUrl}
            alt={attachment.file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}

        {isInFlight && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center px-2">
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="text-white text-[10px] mt-1 font-medium">
              {progressValue}%
            </span>
          </div>
        )}

        {attachment.status === "error" && (
          <div className="absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center text-red-100 p-1">
            <XCircle className="w-5 h-5 mb-1" />
            <span
              className="text-[9px] text-center leading-tight line-clamp-2 w-full"
              title={attachment.error}
            >
              {attachment.error || "Error"}
            </span>
          </div>
        )}
      </div>

      <div className="bg-gray-900/80 px-2 py-1.5 flex flex-col gap-1 border-t border-gray-700">
        <div className="flex items-center justify-between gap-2 text-[10px] text-gray-300">
          <span className="truncate flex-1" title={attachment.file.name}>
            {attachment.file.name}
          </span>
          <span className="flex-shrink-0 text-gray-400">{sizeStr}</span>
        </div>
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300",
              attachment.status === "error" ? "bg-red-500" : "bg-blue-500",
            )}
            style={{ width: `${progressValue}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span
            className={cn(
              "capitalize",
              attachment.status === "error" && "text-red-400",
              attachment.status === "complete" && "text-green-400",
              isInFlight && "text-blue-300",
            )}
          >
            {attachment.status === "pending" ? "pending" : attachment.status}
          </span>
          {attachment.status === "error" && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-amber-300 hover:bg-amber-500/10"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={isInFlight ? onCancel : onRemove}
        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-gray-300 hover:text-white hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none"
        aria-label={isInFlight ? "Cancel upload" : "Remove attachment"}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// =============================================================================
// MessageComposer Component
// =============================================================================

/**
 * MessageComposer - A textarea-based message input component for SMS messaging
 *
 * Features:
 * - Character count display with color-coded warnings
 * - SMS segment count display for multi-segment messages
 * - Keyboard shortcuts: Enter to send, Shift+Enter for newline
 * - Disabled state handling for empty input or sending in progress
 * - Accessible with proper ARIA attributes
 * - Attachments support with drag-drop, paste and file picker
 */
export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  maxLength = 1600,
  variableValues,
  pendingAttachments,
  onUploadAttachment,
  onCancelUpload,
  onRemoveAttachment,
}: MessageComposerProps) {
  // State
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showVariablePrompt, setShowVariablePrompt] = React.useState(false);
  const [pendingSend, setPendingSend] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<string | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isPreviewExpanded, setIsPreviewExpanded] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  // Refs
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const variablePromptRef = React.useRef<HTMLDivElement>(null);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Template hooks
  const {
    templates,
    selectedTemplate,
    isLoading: isLoadingTemplates,
    selectTemplate,
    selectTemplateObject,
  } = useTemplates({
    category: categoryFilter,
    searchQuery,
  });

  const { data: frequentTemplates = [], isLoading: isLoadingFrequent } =
    useFrequentTemplates(5);

  const quickTemplates = React.useMemo(() => {
    if (frequentTemplates && frequentTemplates.length > 0) {
      return frequentTemplates;
    }

    if (templates && templates.length > 0) {
      return templates.slice(0, 5);
    }

    return [] as typeof templates;
  }, [frequentTemplates, templates]);

  // Detect unresolved variables for validation
  const unresolvedVariables = React.useMemo(
    () => detectUnresolvedVariables(message || ""),
    [message],
  );
  const hasUnresolvedVars = unresolvedVariables.length > 0;

  // Derived state
  const characterCount = (message || "").length;
  const segmentCount = calculateSegmentCount(characterCount);
  const isOverLimit = characterCount > maxLength;
  const attachmentsList = React.useMemo(
    () => (pendingAttachments ? Array.from(pendingAttachments.values()) : []),
    [pendingAttachments],
  );

  const attachmentsCount = pendingAttachments?.size || 0;
  const hasAttachments = attachmentsCount > 0;
  const allAttachmentsComplete =
    hasAttachments && attachmentsList.every((a) => a.status === "complete");
  const isUploading =
    hasAttachments &&
    attachmentsList.some(
      (a) => a.status === "uploading" || a.status === "pending",
    );
  const completedAttachmentsCount = attachmentsList.filter(
    (a) => a.status === "complete" && Boolean(a.s3Key),
  ).length;

  const isEmptyText = (message || "").trim().length === 0;
  // Can send if we have text OR (we have attachments AND they are all complete)
  const canSendTextOrMedia = !isEmptyText || allAttachmentsComplete;

  // Per FR-022: Prevent sending if unresolved variables exist
  const isSendDisabled =
    disabled ||
    !canSendTextOrMedia ||
    isSending ||
    isOverLimit ||
    hasUnresolvedVars ||
    isUploading;

  // Character count color
  const charCountColor = getCharacterCountColor(characterCount);

  const handleUploadFile = React.useCallback(
    async (file: File) => {
      if (!onUploadAttachment) return;
      try {
        await onUploadAttachment(file);
      } catch (error) {
        const messageText =
          error instanceof Error
            ? error.message
            : `Failed to upload ${file.name}`;
        toast.error(messageText);
      }
    },
    [onUploadAttachment],
  );

  const addFilesToQueue = React.useCallback(
    async (incomingFiles: File[], source: "picker" | "drop" | "paste") => {
      if (!onUploadAttachment || incomingFiles.length === 0) return;

      // Validate file types
      const invalidFiles = incomingFiles.filter(
        (file) =>
          !ACCEPTED_IMAGE_TYPES.includes(
            file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
          ),
      );

      if (invalidFiles.length > 0) {
        toast.error("Only JPEG, PNG, and GIF images are allowed");
      }

      const validFiles = incomingFiles.filter((file) =>
        ACCEPTED_IMAGE_TYPES.includes(
          file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
        ),
      );

      if (validFiles.length === 0) return;

      // Validate count
      const currentCount = pendingAttachments?.size || 0;
      const allowedNewFiles = Math.max(0, MAX_FILES - currentCount);

      if (allowedNewFiles === 0) {
        toast.error("Maximum 5 attachments allowed");
        return;
      }

      if (validFiles.length > allowedNewFiles) {
        toast.error(
          `Only ${allowedNewFiles} more ${
            allowedNewFiles === 1 ? "attachment" : "attachments"
          } can be added`,
        );
      }

      // Validate individual file sizes
      const oversizedFiles = validFiles.filter(
        (file) => file.size > MAX_FILE_SIZE,
      );
      if (oversizedFiles.length > 0) {
        toast.error("File must be less than 5MB");
      }

      const sizeValidFiles = validFiles.filter(
        (file) => file.size <= MAX_FILE_SIZE,
      );

      if (sizeValidFiles.length === 0) return;

      // Validate total size
      const currentTotalSize = attachmentsList.reduce(
        (sum, a) => sum + (a.file?.size || 0),
        0,
      );
      const newFilesTotalSize = sizeValidFiles.reduce(
        (sum, file) => sum + file.size,
        0,
      );

      if (currentTotalSize + newFilesTotalSize > MAX_TOTAL_SIZE) {
        toast.error("Total attachment size must be less than 25MB");
        return;
      }

      const filesToUpload = sizeValidFiles.slice(0, allowedNewFiles);
      await Promise.all(filesToUpload.map((file) => handleUploadFile(file)));

      if (source === "paste" && filesToUpload.length > 0) {
        toast.success(
          `Added ${filesToUpload.length} pasted ${
            filesToUpload.length === 1 ? "image" : "images"
          }`,
        );
      }
    },
    [handleUploadFile, onUploadAttachment, pendingAttachments, attachmentsList],
  );

  const handleRetryAttachment = React.useCallback(
    async (attachment: PendingAttachment) => {
      onRemoveAttachment?.(attachment.fileId);
      await handleUploadFile(attachment.file);
    },
    [handleUploadFile, onRemoveAttachment],
  );

  /**
   * Handle sending the message with variable validation and template tracking
   */
  const handleSend = React.useCallback(async () => {
    if (isSendDisabled) return;

    const trimmedMessage = (message || "").trim();
    if (!trimmedMessage && attachmentsCount === 0) return;

    // Check for unresolved template variables
    const validation = validateTemplateVariables(trimmedMessage);
    if (!validation.isValid) {
      setPendingSend(trimmedMessage);
      setShowVariablePrompt(true);
      return;
    }

    // Collect attachment IDs that are complete
    const attachmentIds = attachmentsList
      .filter((a) => a.status === "complete" && Boolean(a.s3Key))
      .map((a) => a.fileId);

    // Proceed with sending
    setIsSending(true);
    try {
      await onSend(trimmedMessage, selectedTemplate?.id, attachmentIds);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      selectTemplate(null);
      if (pendingAttachments && onRemoveAttachment) {
        pendingAttachments.forEach((attachment) => {
          onRemoveAttachment(attachment.fileId);
        });
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [
    isSendDisabled,
    message,
    attachmentsCount,
    attachmentsList,
    pendingAttachments,
    onRemoveAttachment,
    onSend,
    selectedTemplate?.id,
    selectTemplate,
  ]);

  /**
   * Handle file selection from input
   */
  const handleFileSelect = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      await addFilesToQueue(files, "picker");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFilesToQueue],
  );

  /**
   * Drag and drop handlers
   */
  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      void addFilesToQueue(files, "drop");
    },
    [addFilesToQueue],
  );

  /**
   * Paste handler for images
   */
  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));

      if (imageItems.length > 0) {
        e.preventDefault(); // Stop pasting image as text

        const files = imageItems
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);

        void addFilesToQueue(files, "paste");
      }
    },
    [addFilesToQueue],
  );

  const handleEmojiSelect = React.useCallback((emojiData: EmojiSelectData) => {
    if (textareaRef.current) {
      insertEmojiAtCursor(textareaRef.current, emojiData.emoji);
      setMessage(textareaRef.current.value);
      addToRecentEmojis(emojiData.emoji);
    }
  }, []);

  const handleTemplateSelect = React.useCallback(
    (template: Template) => {
      selectTemplateObject(template);
      const resolvedContent =
        variableValues && Object.keys(variableValues).length > 0
          ? renderTemplate(template.content || "", variableValues)
          : template.content || "";
      setMessage(resolvedContent);
      setShowTemplateSelector(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    },
    [selectTemplateObject, variableValues],
  );

  const handleVariablePromptClose = React.useCallback(() => {
    setShowVariablePrompt(false);
    setPendingSend(null);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  const handleTemplateModalBackdrop = React.useCallback(
    (event: React.MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowTemplateSelector(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleVariablePromptBackdrop = React.useCallback(
    (event: React.MouseEvent) => {
      if (
        variablePromptRef.current &&
        !variablePromptRef.current.contains(event.target as Node)
      ) {
        handleVariablePromptClose();
      }
    },
    [handleVariablePromptClose],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;

      if (
        newValue.length <= maxLength ||
        newValue.length < (message || "").length
      ) {
        setMessage(newValue);
      }

      const textarea = event.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    [maxLength, message],
  );

  const segmentInfo = React.useMemo(() => {
    if (segmentCount <= 1) return null;
    return `${segmentCount} segments`;
  }, [segmentCount]);

  const ariaDescription = React.useMemo(() => {
    const parts = [`${characterCount} of ${maxLength} characters`];
    if (segmentCount > 1) {
      parts.push(`${segmentCount} SMS segments`);
    }
    if (characterCount > 140 && characterCount <= GSM7_FIRST_SEGMENT) {
      parts.push("Approaching character limit");
    }
    if (characterCount > GSM7_FIRST_SEGMENT) {
      parts.push("Message will be sent as multiple segments");
    }
    return parts.join(". ");
  }, [characterCount, maxLength, segmentCount]);

  const totalAttachmentsSize = attachmentsList.reduce(
    (acc, curr) => acc + curr.file.size,
    0,
  );

  const formattedTotalSize =
    totalAttachmentsSize > 0
      ? `${(totalAttachmentsSize / 1024 / 1024).toFixed(2)}MB`
      : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 border-t border-gray-700 bg-gray-900 transition-colors duration-200 relative",
        isDragging && "bg-gray-800 ring-2 ring-inset ring-purple-500",
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/gif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-purple-900/20 backdrop-blur-[1px] border-2 border-dashed border-purple-500 rounded-lg flex items-center justify-center pointer-events-none mx-2 mt-2 mb-16">
          <div className="bg-gray-900 rounded-xl p-4 shadow-xl flex flex-col items-center gap-2">
            <ImageIcon className="w-8 h-8 text-purple-400" />
            <p className="text-white font-medium">Drop images here</p>
            <p className="text-gray-400 text-xs text-center max-w-[200px]">
              Supports JPEG, PNG, GIF (Max {MAX_FILES} files)
            </p>
          </div>
        </div>
      )}

      {/* Template Preview (if template selected) */}
      {selectedTemplate && (
        <div className="mb-2 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-300 transition-colors focus:outline-none"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">Template:</span>
              <span className="text-gray-300">{selectedTemplate.name}</span>
            </span>
            {isPreviewExpanded ? (
              <HiChevronUp className="h-4 w-4" />
            ) : (
              <HiChevronDown className="h-4 w-4" />
            )}
          </button>

          {isPreviewExpanded && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-700/50">
              <TemplatePreview
                template={selectedTemplate}
                variableValues={variableValues}
              />
            </div>
          )}
        </div>
      )}

      {/* Unresolved Variables Warning */}
      {hasUnresolvedVars && (
        <div
          className="flex items-center gap-2 rounded-lg border border-yellow-600/50 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-300"
          role="alert"
        >
          <span>⚠️</span>
          <span>
            The following snippets need to be filled in:{" "}
            {unresolvedVariables.map((v) => `{{${v}}}`).join(", ")}
          </span>
        </div>
      )}

      {/* Textarea container */}
      <div className="flex gap-2 items-end relative z-0">
        {/* Quick Template Button - show once we have any templates available */}
        {!isLoadingFrequent &&
          !isLoadingTemplates &&
          quickTemplates.length > 0 && (
            <QuickTemplateButton
              templates={quickTemplates}
              onSelect={handleTemplateSelect}
              disabled={disabled || isSending}
            />
          )}

        {/* Template Selector Button */}
        <Tooltip content="Select message template" placement="top">
          <button
            type="button"
            onClick={() => setShowTemplateSelector(true)}
            disabled={disabled || isSending}
            aria-label="Select template"
            className={cn(
              "flex-shrink-0 inline-flex items-center justify-center",
              "h-11 w-11 rounded-lg",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
              disabled || isSending
                ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                : [
                    "bg-gray-800 text-gray-300 border border-gray-700",
                    "hover:bg-gray-700 hover:text-white",
                    "focus:ring-purple-500",
                  ],
            )}
          >
            <HiTemplate className="h-5 w-5" aria-hidden={true} />
          </button>
        </Tooltip>

        {/* Attachment Button */}
        <Tooltip
          content={
            attachmentsCount >= MAX_FILES
              ? `Maximum ${MAX_FILES} attachments reached`
              : "Attach image"
          }
          placement="top"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending || attachmentsCount >= MAX_FILES}
              aria-label="Attach image"
              className={cn(
                "flex-shrink-0 inline-flex items-center justify-center",
                "h-11 w-11 rounded-lg",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
                disabled || isSending || attachmentsCount >= MAX_FILES
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                  : [
                      "bg-gray-800 text-gray-300 border border-gray-700",
                      "hover:bg-gray-700 hover:text-white",
                      "focus:ring-purple-500",
                    ],
              )}
            >
              <Paperclip className="h-5 w-5" aria-hidden={true} />
            </button>
            {attachmentsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-gray-900 pointer-events-none">
                {attachmentsCount}
              </span>
            )}
          </div>
        </Tooltip>

        {/* Emoji Picker Button & Popup */}
        <Tooltip content="Add emoji" placement="top">
          <div className="relative flex-shrink-0">
            <EmojiPickerButton
              isOpen={showEmojiPicker}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled || isSending}
              className="h-11 w-11 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
            />
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full left-0 mb-2 z-50"
              >
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>
        </Tooltip>

        <div className="relative flex-1 flex flex-col items-start bg-gray-800 rounded-lg border border-gray-600 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-colors">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            aria-label="Message input"
            aria-describedby="message-composer-status"
            aria-invalid={isOverLimit || hasUnresolvedVars}
            className={cn(
              "w-full resize-none bg-transparent px-4 py-3 text-sm text-gray-100",
              "placeholder:text-gray-500 border-none",
              "focus:outline-none focus:ring-0",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isOverLimit && "text-red-400",
            )}
            style={{ minHeight: "44px", maxHeight: "200px" }}
          />

          {/* Attachments Preview Strip */}
          {hasAttachments && (
            <div className="w-full px-3 pb-3 pt-1 border-t border-gray-700/50 mt-1">
              <div className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent pb-1">
                {attachmentsList.map((attachment) => (
                  <AttachmentPreview
                    key={attachment.fileId}
                    attachment={attachment}
                    onCancel={() => onCancelUpload?.(attachment.fileId)}
                    onRemove={() => onRemoveAttachment?.(attachment.fileId)}
                    onRetry={() => void handleRetryAttachment(attachment)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Send button */}
        <Tooltip
          content={
            isSending
              ? "Sending message"
              : isUploading
                ? "Uploading attachments..."
                : "Send message"
          }
          placement="top"
        >
          <button
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled}
            aria-label={isSending ? "Sending message" : "Send message"}
            className={cn(
              "flex-shrink-0 inline-flex items-center justify-center",
              "h-11 w-11 rounded-lg",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
              // Enabled state: purple/blue gradient
              !isSendDisabled && [
                "bg-gradient-to-r from-purple-600 to-blue-600",
                "hover:from-purple-500 hover:to-blue-500",
                "text-white",
                "focus:ring-purple-500",
                "shadow-lg shadow-purple-500/25",
              ],
              // Disabled state: gray
              isSendDisabled && [
                "bg-gray-700",
                "text-gray-500",
                "cursor-not-allowed",
              ],
            )}
          >
            {isSending ? (
              <SpinnerIcon aria-hidden={true} />
            ) : (
              <SendIcon aria-hidden={true} />
            )}
            {completedAttachmentsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-gray-900 pointer-events-none">
                {completedAttachmentsCount}
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Status bar: character count and segment info */}
      <div
        id="message-composer-status"
        className="flex items-center justify-between text-xs mt-1 px-1"
        role="status"
        aria-live="polite"
      >
        {/* Character count & Attachment count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={cn("tabular-nums", charCountColor)}>
              {characterCount} / {GSM7_FIRST_SEGMENT}
            </span>

            {/* Segment count (only shown for multi-segment messages) */}
            {segmentInfo && (
              <>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">{segmentInfo}</span>
              </>
            )}
          </div>

          {hasAttachments && formattedTotalSize && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {attachmentsCount} file{attachmentsCount !== 1 ? "s" : ""} (
                {formattedTotalSize} / {MAX_TOTAL_SIZE_DISPLAY_MB}MB)
              </span>
            </>
          )}
        </div>

        {/* Keyboard shortcut hint */}
        <div className="text-gray-500 hidden sm:block">
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">
            Enter
          </kbd>
          <span className="mx-1">to send</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">
            Shift+Enter
          </kbd>
          <span className="ml-1">for newline</span>
        </div>
      </div>

      {/* Screen reader only: full description */}
      <span className="sr-only">{ariaDescription}</span>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleTemplateModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-selector-title"
        >
          <div
            ref={modalRef}
            className={cn(
              "relative z-10 w-full max-w-2xl mx-4",
              "bg-gray-800 rounded-xl shadow-2xl",
              "border border-gray-700",
              "max-h-[90vh] overflow-hidden flex flex-col",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2
                id="template-selector-title"
                className="text-lg font-semibold text-white"
              >
                Select Template
              </h2>
              <button
                type="button"
                onClick={() => setShowTemplateSelector(false)}
                className={cn(
                  "p-2 rounded-lg text-gray-400",
                  "hover:text-white hover:bg-gray-700",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
                aria-label="Close template selector"
              >
                <CloseIcon aria-hidden={true} />
              </button>
            </div>

            {/* Template Selector */}
            <div className="flex-1 overflow-y-auto p-6">
              <TemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplate?.id || null}
                onSelect={handleTemplateSelect}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLoading={isLoadingTemplates}
              />
            </div>
          </div>
        </div>
      )}

      {/* Variable Prompt Modal */}
      {showVariablePrompt && pendingSend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleVariablePromptBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="variable-prompt-title"
        >
          <div
            ref={variablePromptRef}
            className={cn(
              "relative z-10 w-full max-w-md mx-4",
              "bg-gray-800 rounded-xl shadow-2xl",
              "border border-gray-700",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2
                id="variable-prompt-title"
                className="text-lg font-semibold text-yellow-300"
              >
                Unresolved Template Variables
              </h2>
              <button
                type="button"
                onClick={handleVariablePromptClose}
                className={cn(
                  "p-2 rounded-lg text-gray-400",
                  "hover:text-white hover:bg-gray-700",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
                aria-label="Close"
              >
                <CloseIcon aria-hidden={true} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-300 mb-4">
                Your message contains unresolved template variables that must be
                replaced before sending:
              </p>
              <div className="mb-4 rounded-lg border border-red-600/50 bg-red-900/20 p-3">
                <div className="flex flex-wrap gap-2">
                  {unresolvedVariables.map((variable) => (
                    <span
                      key={variable}
                      className="rounded bg-red-900/40 px-2 py-1 text-xs font-mono text-red-300"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Please replace all variables in the message before sending. The
                send button is disabled until all variables are resolved.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-700">
              <button
                type="button"
                onClick={handleVariablePromptClose}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-purple-600 text-white",
                  "hover:bg-purple-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageComposer;
