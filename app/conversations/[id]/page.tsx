"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "flowbite-react";
import { ConversationDetail } from "@/components/conversations/ConversationDetail";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArrowLeftIcon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import type { Conversation } from "@/types/sms";

// =============================================================================
// Types
// =============================================================================

interface ConversationResponse {
  data: Conversation;
}

// =============================================================================
// Page Component
// =============================================================================

/**
 * Conversation Detail Page
 *
 * Displays a single conversation with messaging capabilities.
 * Uses polling for real-time updates (Twilio Messaging API).
 * Implements auto-scroll (T039) and mark as read (T040) via ConversationDetail.
 */
export default function ConversationPage(): React.ReactElement {
  const params = useParams();
  const conversationId = params.id as string;

  // Conversation data
  const [conversation, setConversation] = React.useState<Conversation | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // ==========================================================================
  // Fetch Conversation
  // ==========================================================================

  React.useEffect(() => {
    async function fetchConversation() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await api.get<ConversationResponse>(
          `/api/outreach/conversations/${conversationId}`,
        );

        setConversation(response.data);
      } catch (err) {
        console.error("Error fetching conversation:", err);
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setLoadError("Conversation not found");
          } else if (err.status === 403) {
            setLoadError("You don't have permission to view this conversation");
          } else {
            setLoadError(err.message);
          }
        } else {
          setLoadError("Failed to load conversation");
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  // ==========================================================================
  // Mark as Read (T040)
  // ==========================================================================

  React.useEffect(() => {
    async function markAsRead() {
      if (!conversation || conversation.unreadCount === 0) return;

      try {
        await api.post(`/api/outreach/conversations/${conversationId}/read`);
        setConversation((prev) => (prev ? { ...prev, unreadCount: 0 } : prev));
      } catch (err) {
        console.error("Error marking conversation as read:", err);
      }
    }

    markAsRead();
  }, [conversationId, conversation]);

  // ==========================================================================
  // Render States
  // ==========================================================================

  // =========================================================================

  // Loading conversation metadata
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <Spinner size="xl" color="info" className="mb-4" />
          <p className="text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Error loading conversation
  if (loadError || !conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="rounded-lg bg-gray-800 p-8 text-center">
          <div className="mb-4 text-yellow-400">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">
            {loadError || "Conversation not found"}
          </h2>
          <p className="mb-4 text-gray-400">
            The conversation you&apos;re looking for might have been deleted or
            you don&apos;t have access.
          </p>
          <Link
            href="/conversations"
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Conversations
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <div className="flex flex-col bg-gray-900">
      {/* Header with back button */}
      <PageHeader
        title={conversation.friendlyName}
        className="px-4 py-3"
        startAction={
          <Link
            href="/conversations"
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </Link>
        }
      />

      {/* Conversation Detail Component handles messages, scrolling, etc */}
      <div className="flex-1 overflow-hidden">
        <ConversationDetail
          conversationId={conversationId}
          conversation={conversation}
        />
      </div>
    </div>
  );
}
