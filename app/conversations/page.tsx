"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/conversations/ConversationList";
import {
  ConversationFilter,
  type ConversationFilterValue,
} from "@/components/conversations/ConversationFilter";
import { NewConversationModal } from "@/components/conversations/NewConversationModal";
import type { Conversation } from "@/types/sms";

// =============================================================================
// Page Component
// =============================================================================

/**
 * Main conversation list page.
 * Displays all active conversations with filtering and search capabilities.
 * Supports creating new conversations via modal.
 * Implements FR-014c: Status filters with URL query param persistence.
 */
export default function ConversationsPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filter from URL query params (FR-014c)
  const urlFilterStatus = searchParams.get(
    "status",
  ) as ConversationFilterValue | null;
  const initialFilter: ConversationFilterValue =
    urlFilterStatus &&
    ["all", "unread", "sla_risk", "archived"].includes(urlFilterStatus)
      ? urlFilterStatus
      : "all";

  // State for filters
  const [filterStatus, setFilterStatus] =
    React.useState<ConversationFilterValue>(initialFilter);

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

  const handleFilterChange = React.useCallback(
    (newFilter: ConversationFilterValue) => {
      setFilterStatus(newFilter);

      // Update URL query params for bookmarkability (FR-014c)
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", newFilter);
      router.push(`/conversations?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

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

          {/* Status filter - FR-014c */}
          <ConversationFilter
            value={filterStatus}
            onChange={handleFilterChange}
          />
        </div>
      </header>

      {/* Main Content - ConversationList handles its own data fetching */}
      <main className="flex-1 overflow-hidden">
        <ConversationList
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          filterStatus={filterStatus}
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
