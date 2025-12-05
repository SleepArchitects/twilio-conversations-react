"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConversationList } from "@/components/conversations/ConversationList";
import { NewConversationModal } from "@/components/conversations/NewConversationModal";
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
