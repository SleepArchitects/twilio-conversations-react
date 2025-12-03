"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "flowbite-react";
import { ConversationList } from "@/components/conversations/ConversationList";
import { NewConversationModal } from "@/components/conversations/NewConversationModal";
import { useTwilioClient } from "@/hooks/useTwilioClient";
import type { ConversationStatus, Conversation } from "@/types/sms";
import { cn } from "@/lib/utils";

// =============================================================================
// Page Component
// =============================================================================

/**
 * Main conversation list page.
 * Displays all active conversations with filtering and search capabilities.
 * Supports creating new conversations via modal.
 */
export default function ConversationsPage(): React.ReactElement {
  const router = useRouter();

  // Twilio client for real-time updates
  const { isLoading: isConnecting, error: twilioError } = useTwilioClient();

  // State for filters
  const [statusFilter, setStatusFilter] =
    React.useState<ConversationStatus>("active");

  // New conversation modal state
  const [isNewConversationOpen, setIsNewConversationOpen] =
    React.useState(false);

  // Currently selected conversation for navigation
  const [selectedConversationId, setSelectedConversationId] = React.useState<
    string | undefined
  >();

  // Search query state (setSearchQuery will be used when search UI is implemented)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleConversationSelect = React.useCallback(
    (conversation: Conversation) => {
      setSelectedConversationId(conversation.id);
      router.push(`/conversations/${conversation.id}`);
    },
    [router],
  );

  const handleNewConversation = React.useCallback(() => {
    setIsNewConversationOpen(true);
  }, []);

  const handleNewConversationClose = React.useCallback(() => {
    setIsNewConversationOpen(false);
  }, []);

  const handleNewConversationSuccess = React.useCallback(
    (conversationId: string) => {
      setIsNewConversationOpen(false);
      // Navigate to the new conversation
      router.push(`/conversations/${conversationId}`);
    },
    [router],
  );

  const handleExistingConversation = React.useCallback(
    (conversationId: string) => {
      setIsNewConversationOpen(false);
      // Navigate to the existing conversation
      router.push(`/conversations/${conversationId}`);
    },
    [router],
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  // Connection error display
  if (twilioError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="rounded-lg bg-gray-800 p-8 text-center">
          <div className="mb-4 text-red-400">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">
            Connection Error
          </h2>
          <p className="mb-4 text-gray-400">
            Failed to connect to messaging service.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <Spinner size="xl" color="info" className="mb-4" />
          <p className="text-gray-400">Connecting to messaging service...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">SMS Conversations</h1>
            <p className="mt-1 text-sm text-gray-400">
              Manage patient conversations
            </p>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("active")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                statusFilter === "active"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white",
              )}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("archived")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                statusFilter === "archived"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white",
              )}
            >
              Archived
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - ConversationList handles its own data fetching */}
      <main className="flex-1 overflow-hidden">
        <ConversationList
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          className="h-full"
        />
      </main>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isNewConversationOpen}
        onClose={handleNewConversationClose}
        onConversationCreated={handleNewConversationSuccess}
        onExistingConversation={handleExistingConversation}
      />
    </div>
  );
}
