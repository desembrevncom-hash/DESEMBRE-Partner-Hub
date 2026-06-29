export type MarketingSendJobEventType =
  | "created"
  | "safety_blocked"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked"
  | "complained";

export interface TimelineNode {
  id: string;
  eventType: MarketingSendJobEventType;
  occurredAt: string;
  provider?: string;
  providerMessageId?: string;
  providerEventId?: string;
  providerErrorMessage?: string;
  eventData?: any;
  isSynthetic: boolean;
  isSandbox?: boolean;
}

export function buildDeliveryTimeline(job: any, events: any[]): TimelineNode[] {
  const nodes: TimelineNode[] = [];

  // Parse safety result to see if sandbox was used
  let isSandbox = false;
  if (job?.safety_result?.sandbox?.executed) {
    isSandbox = true;
  }

  // Generate synthetic events from job lifecycle
  if (job?.created_at) {
    nodes.push({
      id: `synthetic-created-${job.id}`,
      eventType: job.status === "safety_blocked" ? "safety_blocked" : "created",
      occurredAt: job.created_at,
      isSynthetic: true,
    });
  }

  if (job?.approved_at) {
    nodes.push({
      id: `synthetic-approved-${job.id}`,
      eventType: "approved",
      occurredAt: job.approved_at,
      isSynthetic: true,
    });
  }

  if (job?.status === "sent" && job?.sent_at) {
    nodes.push({
      id: `synthetic-sent-${job.id}`,
      eventType: "sent",
      occurredAt: job.sent_at,
      providerMessageId: job.provider_message_id,
      isSynthetic: true,
      isSandbox,
    });
  } else if (job?.status === "failed" && job?.updated_at) {
    nodes.push({
      id: `synthetic-failed-${job.id}`,
      eventType: "failed",
      occurredAt: job.updated_at,
      providerErrorMessage: job.provider_error_message,
      isSynthetic: true,
      isSandbox,
    });
  }

  // Add explicit events from DB
  if (Array.isArray(events)) {
    for (const evt of events) {
      nodes.push({
        id: evt.id,
        eventType: evt.event_type as MarketingSendJobEventType,
        occurredAt: evt.occurred_at,
        provider: evt.provider,
        providerMessageId: evt.provider_message_id,
        providerEventId: evt.provider_event_id,
        eventData: evt.event_data,
        isSynthetic: false,
      });
    }
  }

  // Sort nodes chronologically
  nodes.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  // Deduplicate logical nodes if needed, though they shouldn't conflict heavily if used correctly.
  return nodes;
}
