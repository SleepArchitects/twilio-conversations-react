import type { Notification, NotificationEnrichedData } from '@/types/notifications';

/**
 * Parse enriched data from notification payload and metadata
 */
export function parseNotificationEnrichedData(notification: Notification): NotificationEnrichedData | null {
  try {
    // Try to parse from payload first (preferred location)
    if (notification.payload) {
      // If payload is a string, parse it
      if (typeof notification.payload === 'string') {
        try {
          const parsed = JSON.parse(notification.payload);
          return parsed as NotificationEnrichedData;
        } catch (e) {
          console.error('[parseNotificationEnrichedData] Failed to parse payload string:', e);
        }
      } else if (typeof notification.payload === 'object') {
        return notification.payload as NotificationEnrichedData;
      }
    }
    
    // Fall back to metadata
    if (notification.metadata) {
      // If metadata is a string, parse it
      if (typeof notification.metadata === 'string') {
        try {
          const parsed = JSON.parse(notification.metadata);
          return parsed as NotificationEnrichedData;
        } catch (e) {
          console.error('[parseNotificationEnrichedData] Failed to parse metadata string:', e);
        }
      } else if (typeof notification.metadata === 'object') {
        return notification.metadata as NotificationEnrichedData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse notification enriched data:', error);
    return null;
  }
}

/**
 * Enrich notification with parsed data
 */
export function enrichNotification(notification: Notification): Notification {
  const enriched = parseNotificationEnrichedData(notification);
  return {
    ...notification,
    enriched: enriched || undefined,
  };
}

/**
 * Enrich array of notifications
 */
export function enrichNotifications(notifications: Notification[]): Notification[] {
  return notifications.map(enrichNotification);
}

/**
 * Check if notification has enriched data
 */
export function hasEnrichedData(notification: Notification): boolean {
  return !!notification.enriched && Object.keys(notification.enriched).length > 0;
}

/**
 * Get display-friendly type label
 */
export function getNotificationTypeLabel(type: string, enriched?: NotificationEnrichedData): string {
  if (enriched?.ticket_type) {
    return enriched.ticket_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

