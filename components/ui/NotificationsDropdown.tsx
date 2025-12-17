"use client";

import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from "flowbite-react";
import Link from "next/link";
import { NotificationsIcon } from "@/components/icons";
import { formatDistanceToNowStrict } from "date-fns";
import { customDropdownTheme } from "@/lib/flowbite-theme";
import type { Notification } from "@/types/notifications";
import { enrichNotifications } from "@/utils/notificationHelpers";
import { Ticket, User, Building } from "lucide-react";

export default function NotificationsDropdown({
  notifications,
  unreadCount,
  totalCount,
}: {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}) {
  // Enrich notifications with parsed payload data
  const enrichedNotifications = enrichNotifications(notifications);
  // Show all notifications that were fetched (no slicing)
  const displayedNotifications = enrichedNotifications;

  return (
    <div>
      <Dropdown
        arrowIcon={false}
        inline
        theme={customDropdownTheme}
        label={
          <div className="relative">
            <div className="cursor-pointer rounded-lg p-2 text-gray-500 hover:bg-purple-50 focus:outline-none focus:ring-0 dark:text-gray-400 dark:hover:bg-purple-900/30 transition-colors">
              <span className="sr-only">View notifications</span>
              <NotificationsIcon className="h-6 w-6" />
              {unreadCount > 0 && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white shadow-lg">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </div>
          </div>
        }
      >
        <DropdownHeader>
          <div className="flex items-center justify-between gap-4 min-w-[320px]">
            <span className="block text-base font-bold text-gray-900 dark:text-white tracking-tight">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                {unreadCount} new
              </span>
            )}
          </div>
        </DropdownHeader>

        <div className="max-h-[400px] overflow-y-auto min-w-[320px]">
          {notifications.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <NotificationsIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No notifications yet
              </p>
            </div>
          ) : (
            displayedNotifications.map((notification) => {
              const enriched = notification.enriched;
              const hasEnrichedData =
                enriched && Object.keys(enriched).length > 0;

              return (
                <Link
                  href={
                    enriched?.action_url ||
                    notification.action_url ||
                    "/notifications"
                  }
                  key={notification.notification_id}
                  className="block"
                >
                  <DropdownItem
                    className={`
                    ${!notification.is_read ? "bg-purple-50/50 dark:bg-purple-900/10" : ""} 
                    cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 
                    border-l-4 
                    ${!notification.is_read ? "border-l-purple-600" : "border-l-transparent"}
                    transition-all duration-150
                  `}
                  >
                    <div className="w-full py-1">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1 flex-1">
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-purple-600 flex-shrink-0 mt-1"></span>
                        )}
                      </div>

                      {/* Enriched data preview badges */}
                      {hasEnrichedData && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {enriched?.ticket_number && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              <Ticket className="h-2.5 w-2.5" />#
                              {enriched.ticket_number}
                            </span>
                          )}
                          {enriched?.patient_name && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <User className="h-2.5 w-2.5" />
                              {enriched.patient_name}
                            </span>
                          )}
                          {enriched?.practice_name && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              <Building className="h-2.5 w-2.5" />
                              {enriched.practice_name}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mb-1.5">
                        {notification.message.replace(/<[^>]*>/g, "")}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDistanceToNowStrict(
                            new Date(notification.created_on),
                            { addSuffix: true },
                          )}
                        </span>
                        {notification.priority === "critical" && (
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">
                            Urgent
                          </span>
                        )}
                        {notification.priority === "high" && (
                          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                            High
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownItem>
                </Link>
              );
            })
          )}
        </div>

        {notifications.length > 0 && (
          <>
            <DropdownDivider />
            <Link
              className="block w-full px-4 py-2.5 text-center text-sm font-semibold text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors"
              href="/notifications"
            >
              {totalCount > notifications.length
                ? `View all ${totalCount} notifications →`
                : "View all notifications →"}
            </Link>
          </>
        )}
      </Dropdown>
    </div>
  );
}
