"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Tooltip, Dropdown } from "flowbite-react";
import { HiTemplate, HiMenu, HiCheck } from "react-icons/hi";
import { ConversationList } from "@/components/conversations/ConversationList";
import {
  ConversationFilter,
  type ConversationFilterValue,
} from "@/components/conversations/ConversationFilter";
import { NewConversationModal } from "@/components/conversations/NewConversationModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/search-input";
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
  const conversationFilterOptions = [
    "all",
    "unread",
    "sla_risk",
    // "archived"
  ];
  const initialFilter: ConversationFilterValue =
    urlFilterStatus && conversationFilterOptions.includes(urlFilterStatus)
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

  // Search query state
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

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
    <div className="flex flex-col h-full w-full lg:basis-1/2 bg-gray-900">
      <PageHeader
        title="SMS Conversations"
        subtitle="Manage patient conversations"
      >
        {/* Search Input */}
        <SearchInput
          placeholder="Search conversations..."
          onChange={handleSearch}
          className="w-full max-w-xs hidden md:block"
        />

        {/* Mobile Menu - Hidden on md+ */}
        <div className="md:hidden">
          <Dropdown
            label={<HiMenu className="h-5 w-5" />}
            arrowIcon={false}
            color="gray"
            size="sm"
            dismissOnClick={false}
          >
            <Dropdown.Header>
              <span className="block text-sm font-medium text-center text-gray-900 dark:text-gray-200 mb-2">
                Filters
              </span>
            </Dropdown.Header>
            <Dropdown.Item
              onClick={() => handleFilterChange("all")}
              icon={filterStatus === "all" ? HiCheck : undefined}
            >
              All Conversations
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => handleFilterChange("unread")}
              icon={filterStatus === "unread" ? HiCheck : undefined}
            >
              Unread
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => handleFilterChange("sla_risk")}
              icon={filterStatus === "sla_risk" ? HiCheck : undefined}
            >
              SLA Risk
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item>
              <Link href="/templates" className="flex items-center w-full">
                <HiTemplate className="mr-2 h-4 w-4" />
                Templates
              </Link>
            </Dropdown.Item>
          </Dropdown>
        </div>

        {/* Templates Link - Hidden on mobile */}
        <div className="hidden md:block">
          <Tooltip content="Manage message templates" placement="bottom">
            <Link href="/templates">
              <Button color="gray" size="sm">
                <HiTemplate className="mr-2 h-4 w-4" />
                Templates
              </Button>
            </Link>
          </Tooltip>
        </div>

        {/* Status filter - Hidden on mobile */}
        <div className="hidden md:block">
          <ConversationFilter
            value={filterStatus}
            onChange={handleFilterChange}
          />
        </div>
      </PageHeader>

      {/* Mobile Search - Visible only on small screens */}
      <div className="md:hidden px-4 py-3 bg-gray-800 border-b border-gray-700">
        <SearchInput
          placeholder="Search..."
          onChange={handleSearch}
          className="w-full"
        />
      </div>

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
