export interface AnalyticsJobRow {
  id: string;
  campaign_id: string | null;
  status: string;
  provider_error_message?: string | null;
  safety_result?: {
    sandbox?: {
      executed?: boolean;
    };
  } | null;
}

export interface AnalyticsEventRow {
  job_id: string;
  event_type: string;
}

export interface CampaignBucket {
  campaign_id: string | null; // null represents "Unassigned / QA Sandbox"
  sandbox_jobs_count: number;
  non_sandbox_jobs_count: number;
  
  // Job-level counts
  sent_jobs: number;
  safety_blocked_jobs: number;
  failed_jobs: number;

  // Unique jobs with events
  delivered_unique_jobs: number;
  opened_unique_jobs: number;
  clicked_unique_jobs: number;
  bounced_unique_jobs: number;
  complained_unique_jobs: number;

  // Total raw events
  delivered_events: number;
  opened_events: number;
  clicked_events: number;
  bounced_events: number;
  complained_events: number;

  // Rates
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  click_to_open_rate: number;
  bounce_rate: number;
  complaint_rate: number;

  // Insights
  failure_reasons: Record<string, number>;
}

export interface AnalyticsFilter {
  sandbox_mode: "all" | "sandbox_only" | "non_sandbox_only";
}

export function aggregateCampaignAnalytics(
  jobs: AnalyticsJobRow[],
  events: AnalyticsEventRow[],
  filter: AnalyticsFilter = { sandbox_mode: "all" }
): Record<string, CampaignBucket> {
  const buckets: Record<string, CampaignBucket> = {};

  const getBucket = (campaignId: string | null) => {
    const key = campaignId || "unassigned";
    if (!buckets[key]) {
      buckets[key] = {
        campaign_id: campaignId,
        sandbox_jobs_count: 0,
        non_sandbox_jobs_count: 0,
        sent_jobs: 0,
        safety_blocked_jobs: 0,
        failed_jobs: 0,
        delivered_unique_jobs: 0,
        opened_unique_jobs: 0,
        clicked_unique_jobs: 0,
        bounced_unique_jobs: 0,
        complained_unique_jobs: 0,
        delivered_events: 0,
        opened_events: 0,
        clicked_events: 0,
        bounced_events: 0,
        complained_events: 0,
        delivery_rate: 0,
        open_rate: 0,
        click_rate: 0,
        click_to_open_rate: 0,
        bounce_rate: 0,
        complaint_rate: 0,
        failure_reasons: {}
      };
    }
    return buckets[key];
  };

  // Group events by job_id for quick lookup
  const eventsByJob: Record<string, AnalyticsEventRow[]> = {};
  for (const event of events) {
    if (!eventsByJob[event.job_id]) {
      eventsByJob[event.job_id] = [];
    }
    eventsByJob[event.job_id].push(event);
  }

  for (const job of jobs) {
    const isSandbox = job.safety_result?.sandbox?.executed === true;

    // Apply sandbox filter
    if (filter.sandbox_mode === "sandbox_only" && !isSandbox) continue;
    if (filter.sandbox_mode === "non_sandbox_only" && isSandbox) continue;

    const bucket = getBucket(job.campaign_id);

    if (isSandbox) bucket.sandbox_jobs_count++;
    else bucket.non_sandbox_jobs_count++;

    // Base job status
    if (job.status === "sent") bucket.sent_jobs++;
    if (job.status === "safety_blocked") bucket.safety_blocked_jobs++;
    if (job.status === "failed") {
      bucket.failed_jobs++;
      const reason = job.provider_error_message || "Unknown Failure";
      bucket.failure_reasons[reason] = (bucket.failure_reasons[reason] || 0) + 1;
    }

    // Process events for this job
    const jobEvents = eventsByJob[job.id] || [];
    const uniqueEventTypes = new Set<string>();

    for (const event of jobEvents) {
      const type = event.event_type;
      uniqueEventTypes.add(type);

      if (type === "delivered") bucket.delivered_events++;
      if (type === "opened") bucket.opened_events++;
      if (type === "clicked") bucket.clicked_events++;
      if (type === "bounced") {
        bucket.bounced_events++;
        // Count bounces as failures automatically in the UI insight
        bucket.failure_reasons["Provider Bounced"] = (bucket.failure_reasons["Provider Bounced"] || 0) + 1;
      }
      if (type === "complained") {
        bucket.complained_events++;
        bucket.failure_reasons["Provider Complained"] = (bucket.failure_reasons["Provider Complained"] || 0) + 1;
      }
    }

    // Add unique counts
    if (uniqueEventTypes.has("delivered")) bucket.delivered_unique_jobs++;
    if (uniqueEventTypes.has("opened")) bucket.opened_unique_jobs++;
    if (uniqueEventTypes.has("clicked")) bucket.clicked_unique_jobs++;
    if (uniqueEventTypes.has("bounced")) bucket.bounced_unique_jobs++;
    if (uniqueEventTypes.has("complained")) bucket.complained_unique_jobs++;
  }

  // Calculate rates
  for (const key in buckets) {
    const bucket = buckets[key];
    const safeDiv = (num: number, den: number) => den === 0 ? 0 : num / den;

    bucket.delivery_rate = safeDiv(bucket.delivered_unique_jobs, bucket.sent_jobs);
    bucket.open_rate = safeDiv(bucket.opened_unique_jobs, bucket.delivered_unique_jobs);
    bucket.click_rate = safeDiv(bucket.clicked_unique_jobs, bucket.delivered_unique_jobs);
    bucket.click_to_open_rate = safeDiv(bucket.clicked_unique_jobs, bucket.opened_unique_jobs);
    bucket.bounce_rate = safeDiv(bucket.bounced_unique_jobs, bucket.sent_jobs);
    bucket.complaint_rate = safeDiv(bucket.complained_unique_jobs, bucket.sent_jobs);
  }

  return buckets;
}
