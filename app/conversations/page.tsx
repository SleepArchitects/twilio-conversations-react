"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Tooltip } from "flowbite-react";
import { HiTemplate } from "react-icons/hi";
import { ConversationList } from "@/components/conversations/ConversationList";
import {
  ConversationFilter,
  type ConversationFilterValue,
} from "@/components/conversations/ConversationFilter";
import { NewConversationModal } from "@/components/conversations/NewConversationModal";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <div className="flex flex-col h-full bg-gray-900">
      <PageHeader
        title="SMS Conversations"
        subtitle="Manage patient conversations"
      >
        {/* Templates Link */}
        <Tooltip content="Manage message templates" placement="bottom">
          <Link href="/templates">
            <Button color="gray" size="sm">
              <HiTemplate className="mr-2 h-4 w-4" />
              Templates
            </Button>
          </Link>
        </Tooltip>

        {/* Status filter - FR-014c */}
        <ConversationFilter
          value={filterStatus}
          onChange={handleFilterChange}
        />
      </PageHeader>

      {/* Main Content - ConversationList handles its own data fetching */}
      <main className="flex-1 overflow-hidden flex">
        <ConversationList
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          onNewConversation={handleNewConversation}
          filterStatus={filterStatus}
          searchQuery={searchQuery}
          className="h-full w-full flex-1"
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
