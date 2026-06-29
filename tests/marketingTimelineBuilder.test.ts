import { describe, it, expect } from "vitest";
import { buildDeliveryTimeline, MarketingSendJobEventType } from "../src/lib/marketing/timelineBuilder";

describe("Marketing Timeline Builder", () => {
  it("should generate basic lifecycle from empty events", () => {
    const job = {
      id: "job-123",
      status: "sent",
      created_at: "2026-06-29T10:00:00Z",
      approved_at: "2026-06-29T10:05:00Z",
      sent_at: "2026-06-29T10:10:00Z",
      provider_message_id: "resend-msg-123",
    };

    const timeline = buildDeliveryTimeline(job, []);
    
    expect(timeline.length).toBe(3);
    expect(timeline[0].eventType).toBe("created");
    expect(timeline[1].eventType).toBe("approved");
    expect(timeline[2].eventType).toBe("sent");
    expect(timeline[2].providerMessageId).toBe("resend-msg-123");
    expect(timeline[2].isSandbox).toBe(false);
  });

  it("should apply sandbox badge when safety_result is executed", () => {
    const job = {
      id: "job-123",
      status: "sent",
      created_at: "2026-06-29T10:00:00Z",
      sent_at: "2026-06-29T10:10:00Z",
      safety_result: { sandbox: { executed: true } },
    };

    const timeline = buildDeliveryTimeline(job, []);
    const sentNode = timeline.find((n) => n.eventType === "sent");
    expect(sentNode?.isSandbox).toBe(true);
  });

  it("should extract provider error message for failed jobs", () => {
    const job = {
      id: "job-123",
      status: "failed",
      created_at: "2026-06-29T10:00:00Z",
      updated_at: "2026-06-29T10:10:00Z",
      provider_error_message: "Invalid recipient email",
    };

    const timeline = buildDeliveryTimeline(job, []);
    const failedNode = timeline.find((n) => n.eventType === "failed");
    expect(failedNode?.providerErrorMessage).toBe("Invalid recipient email");
  });

  it("should order explicit events and synthetic events chronologically", () => {
    const job = {
      id: "job-123",
      status: "sent",
      created_at: "2026-06-29T10:00:00Z", // Synthetic created
    };

    const events = [
      {
        id: "evt-1",
        event_type: "delivered",
        occurred_at: "2026-06-29T10:15:00Z",
      },
      {
        id: "evt-2",
        event_type: "sent",
        occurred_at: "2026-06-29T10:05:00Z", // Before delivered
      },
    ];

    const timeline = buildDeliveryTimeline(job, events);
    
    expect(timeline.length).toBe(3);
    expect(timeline[0].eventType).toBe("created");
    expect(timeline[1].eventType).toBe("sent");
    expect(timeline[2].eventType).toBe("delivered");
  });
});
