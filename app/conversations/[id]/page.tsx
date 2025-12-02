"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ConversationDetail } from "@/components/conversations/ConversationDetail";
import { useTwilioClient } from "@/hooks/useTwilioClient";
import type { Conversation } from "@/types/sms";

/**
 * Conversation Detail Page
 *
 * Displays a single conversation with real-time messaging capabilities.
 * Uses Twilio Conversations SDK for real-time updates.
 */
export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const { client, isLoading, error } = useTwilioClient();
  const [conversation, setConversation] = React.useState<Conversation | null>(
    null,
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Fetch conversation metadata
  React.useEffect(() => {
    async function fetchConversation() {
      try {
        const response = await fetch(
          `/outreach/api/outreach/conversations/${conversationId}`,
          {
            credentials: "include",
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              `Failed to load conversation: ${response.status}`,
          );
        }

        const data = await response.json();
        setConversation(data.conversation || data);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load conversation",
        );
      }
    }

    if (conversationId) {
      fetchConversation();
    }
  }, [conversationId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Connecting to Twilio...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">Connection Error</div>
          <p className="text-gray-400">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">Failed to Load</div>
          <p className="text-gray-400">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900">
      <ConversationDetail
        conversationId={conversationId}
        conversation={conversation}
        twilioClient={client}
      />
    </div>
  );
}
