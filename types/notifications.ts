export type NotificationType = 
  | 'alert'
  | 'follow-up'
  | 'reminder'
  | 'marketing'
  | 'informational'
  | 'brand'
  | 'system'
  | 'compliance'
  | 'workflow'
  | 'task';

export type NotificationCategory =
  | 'info'
  | 'warning'
  | 'error'
  | 'success'
  | 'task'
  | 'reminder'
  | 'system'
  | 'general';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export type NotificationChannel = 'sms' | 'email' | 'web';

// Enriched metadata for different notification contexts
export interface NotificationEnrichedData {
  // Task Ticket fields
  ticket_id?: number;
  ticket_number?: number;
  ticket_type?: string;
  ticket_title?: string;
  ticket_description?: string;
  
  // Task fields
  task_id?: number;
  task_name?: string;
  task_description?: string;
  task_details?: string;
  
  // Patient context
  patient_id?: number;
  patient_name?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  patient_chart_id?: string;
  
  // Practice context
  practice_name?: string;
  
  // Assignment context
  assigned_by_id?: number;
  assigned_by_name?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  owner_id?: number;
  owner_name?: string;
  
  // Additional context
  comments?: string;
  notes?: string;
  priority_display?: string;
  status?: string;
  status_display?: string;
  
  // Dates
  created_on?: string;
  assigned_on?: string;
  due_date?: string;
  start_date?: string;
  completed_date?: string;
  
  // Links
  deepLink?: string;
  action_url?: string;
}

export interface Notification {
  notification_id: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  channel: NotificationChannel;
  tenant_id: string;
  practice_id: string;
  sax_id: string;
  created_by: string | null;
  actor_id: string | null;
  trigger_event: string | null;
  related_table: string | null;
  related_id: string | null;
  recipient_id: string | null;
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  recipient_deeplink: string | null;
  title: string;
  message: string;
  payload: Record<string, any> | null;
  metadata: Record<string, any> | null;
  tags: string[] | null;
  delivery_status: string;
  delivery_timestamp: string | null;
  delivery_metadata: Record<string, any> | null;
  is_read: boolean;
  read_on: string | null;
  is_dismissed: boolean;
  dismissed_on: string | null;
  action_url: string | null;
  action_taken: boolean;
  acknowledged_on: string | null;
  requires_acknowledgement: boolean;
  sent_at: string;
  expires_on: string | null;
  active: boolean;
  created_on: string;
  updated_on: string | null;
  updated_by: string | null;
  
  // Computed/enriched fields (not in DB, parsed from payload/metadata)
  enriched?: NotificationEnrichedData;
}

export interface NotificationsResponse {
  notifications: Notification[];
  count: number;
  params: {
    p_sax_id: number;
    p_unread_only: boolean;
    p_limit: number;
    p_offset: number;
  };
  elapsed_ms: number;
}

export interface CreateNotificationPayload {
  tenant_id: string;
  practice_id: string;
  sax_id: number;
  type: NotificationType;
  message: string;
  channel?: NotificationChannel;
  title?: string;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  entity_type?: string;
  entity_id?: string;
  link_url?: string;
  icon_type?: string;
  actor_sax_id?: number;
}

