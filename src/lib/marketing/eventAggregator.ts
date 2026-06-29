export interface DeliveryJobBase {
  status: string;
  safety_result?: {
    sandbox?: {
      executed?: boolean;
    };
  } | null;
}

export interface DeliveryEvent {
  event_type: string;
  occurred_at: string;
}

export interface DeliveryAggregationResult {
  latest_delivery_state: string;
  event_counts: Record<string, number>;
  last_event_at: string | null;
  has_bounce: boolean;
  has_open: boolean;
  has_click: boolean;
  sandbox_badge: boolean;
}

const RISK_STATES = ["failed", "bounced", "complained"];

const POSITIVE_STATE_RANKING: Record<string, number> = {
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
};

export function aggregateDeliveryEvents(
  job: DeliveryJobBase,
  events: DeliveryEvent[]
): DeliveryAggregationResult {
  const sandboxBadge = job.safety_result?.sandbox?.executed === true;
  
  const result: DeliveryAggregationResult = {
    latest_delivery_state: job.status,
    event_counts: {},
    last_event_at: null,
    has_bounce: false,
    has_open: false,
    has_click: false,
    sandbox_badge: sandboxBadge,
  };

  if (!events || events.length === 0) {
    return result;
  }

  // Ensure chronological ordering for processing
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  result.last_event_at = sortedEvents[sortedEvents.length - 1].occurred_at;

  let maxPositiveRank = 0;
  let maxPositiveState = "sent";
  let riskStateOverridden = false;

  for (const event of sortedEvents) {
    const type = event.event_type;

    // Increment raw counts
    result.event_counts[type] = (result.event_counts[type] || 0) + 1;

    // Track boolean flags
    if (type === "bounced") result.has_bounce = true;
    if (type === "opened") result.has_open = true;
    if (type === "clicked") result.has_click = true;

    // Handle state derivation (only if base job is sent, to not override blocked/approved states incorrectly, though typically timeline events only exist after sent)
    if (job.status === "sent") {
      if (RISK_STATES.includes(type)) {
        // First risk state encountered becomes the permanent risk state (e.g., bounced > anything else)
        if (!riskStateOverridden) {
          result.latest_delivery_state = type;
          riskStateOverridden = true;
        }
      } else if (!riskStateOverridden) {
        // Process positive states if no risk state has triggered
        const rank = POSITIVE_STATE_RANKING[type];
        if (rank && rank > maxPositiveRank) {
          maxPositiveRank = rank;
          maxPositiveState = type;
          result.latest_delivery_state = maxPositiveState;
        }
      }
    }
  }

  return result;
}
