export type TimelineSource = 'activity' | 'calendar' | 'task' | 'order' | 'channel' | 'interaction';

export interface TimelineItem {
  id: string;
  source: TimelineSource;
  type: string;
  title: string;
  description: string;
  occurred_at: string;
  created_by: string | null;
  created_by_name: string | null;
  customer_id: string;
  related_id: string;
  status: string | null;
  metadata: Record<string, any> | null;
}
