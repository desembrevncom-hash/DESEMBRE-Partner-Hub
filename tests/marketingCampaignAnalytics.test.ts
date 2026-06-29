import { describe, it, expect } from "vitest";
import { aggregateCampaignAnalytics, AnalyticsJobRow, AnalyticsEventRow } from "../src/lib/marketing/campaignAnalytics";

describe("Marketing Campaign Analytics (M38)", () => {
  it("should group by campaign_id and handle null as unassigned", () => {
    const jobs: AnalyticsJobRow[] = [
      { id: "1", campaign_id: null, status: "sent" },
      { id: "2", campaign_id: "c1", status: "sent" },
      { id: "3", campaign_id: "c1", status: "sent" }
    ];
    
    const res = aggregateCampaignAnalytics(jobs, []);
    
    expect(res["unassigned"].sent_jobs).toBe(1);
    expect(res["c1"].sent_jobs).toBe(2);
  });

  it("should safely handle zero denominator for rates", () => {
    const jobs: AnalyticsJobRow[] = [{ id: "1", campaign_id: "c1", status: "pending" }];
    const res = aggregateCampaignAnalytics(jobs, []);
    
    expect(res["c1"].delivery_rate).toBe(0);
    expect(res["c1"].open_rate).toBe(0);
    expect(res["c1"].click_rate).toBe(0);
    expect(res["c1"].click_to_open_rate).toBe(0);
    expect(res["c1"].bounce_rate).toBe(0);
    expect(res["c1"].complaint_rate).toBe(0);
  });

  it("should accurately count total events vs unique jobs", () => {
    const jobs: AnalyticsJobRow[] = [
      { id: "1", campaign_id: "c1", status: "sent" },
      { id: "2", campaign_id: "c1", status: "sent" }
    ];
    const events: AnalyticsEventRow[] = [
      { job_id: "1", event_type: "delivered" },
      { job_id: "1", event_type: "opened" },
      { job_id: "1", event_type: "opened" }, // duplicate open
      { job_id: "2", event_type: "delivered" }
    ];

    const res = aggregateCampaignAnalytics(jobs, events)["c1"];

    expect(res.sent_jobs).toBe(2);
    expect(res.delivered_unique_jobs).toBe(2);
    expect(res.delivered_events).toBe(2);
    
    expect(res.opened_unique_jobs).toBe(1);
    expect(res.opened_events).toBe(2); // total events

    expect(res.delivery_rate).toBe(1); // 2/2
    expect(res.open_rate).toBe(0.5); // 1/2
  });

  it("should filter sandbox jobs correctly", () => {
    const jobs: AnalyticsJobRow[] = [
      { id: "1", campaign_id: "c1", status: "sent" }, // non-sandbox
      { id: "2", campaign_id: "c1", status: "sent", safety_result: { sandbox: { executed: true } } } // sandbox
    ];

    const all = aggregateCampaignAnalytics(jobs, []);
    expect(all["c1"].sandbox_jobs_count).toBe(1);
    expect(all["c1"].non_sandbox_jobs_count).toBe(1);
    expect(all["c1"].sent_jobs).toBe(2);

    const sandboxOnly = aggregateCampaignAnalytics(jobs, [], { sandbox_mode: "sandbox_only" });
    expect(sandboxOnly["c1"].sent_jobs).toBe(1);
    expect(sandboxOnly["c1"].sandbox_jobs_count).toBe(1);
    expect(sandboxOnly["c1"].non_sandbox_jobs_count).toBe(0);

    const nonSandboxOnly = aggregateCampaignAnalytics(jobs, [], { sandbox_mode: "non_sandbox_only" });
    expect(nonSandboxOnly["c1"].sent_jobs).toBe(1);
    expect(nonSandboxOnly["c1"].non_sandbox_jobs_count).toBe(1);
    expect(nonSandboxOnly["c1"].sandbox_jobs_count).toBe(0);
  });

  it("should track risk metrics and failure reasons properly", () => {
    const jobs: AnalyticsJobRow[] = [
      { id: "1", campaign_id: "c1", status: "failed", provider_error_message: "Rate limit exceeded" },
      { id: "2", campaign_id: "c1", status: "sent" },
      { id: "3", campaign_id: "c1", status: "sent" }
    ];
    const events: AnalyticsEventRow[] = [
      { job_id: "2", event_type: "bounced" },
      { job_id: "3", event_type: "complained" }
    ];

    const res = aggregateCampaignAnalytics(jobs, events)["c1"];
    
    expect(res.failed_jobs).toBe(1);
    expect(res.bounced_unique_jobs).toBe(1);
    expect(res.complained_unique_jobs).toBe(1);

    expect(res.failure_reasons["Rate limit exceeded"]).toBe(1);
    expect(res.failure_reasons["Provider Bounced"]).toBe(1);
    expect(res.failure_reasons["Provider Complained"]).toBe(1);
  });
});
