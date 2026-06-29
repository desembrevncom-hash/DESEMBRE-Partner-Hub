import { describe, it, expect } from "vitest";
import { aggregateDeliveryEvents } from "../src/lib/marketing/eventAggregator";

describe("Marketing Event Aggregator (M37)", () => {
  const baseJobSent = { status: "sent" };
  const baseJobPending = { status: "pending" };
  const baseJobSandbox = { status: "sent", safety_result: { sandbox: { executed: true } } };

  it("should return base job status if no events exist", () => {
    const res = aggregateDeliveryEvents(baseJobSent, []);
    expect(res.latest_delivery_state).toBe("sent");
    expect(res.event_counts).toEqual({});
  });

  it("should not override non-sent statuses even if events exist", () => {
    const res = aggregateDeliveryEvents(baseJobPending, [{ event_type: "delivered", occurred_at: "2026-06-29" }]);
    expect(res.latest_delivery_state).toBe("pending");
  });

  it("should parse sent + delivered -> delivered", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [{ event_type: "delivered", occurred_at: "2026-06-29" }]);
    expect(res.latest_delivery_state).toBe("delivered");
    expect(res.event_counts.delivered).toBe(1);
  });

  it("should parse sent + delivered + opened x2 -> opened with counts", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [
      { event_type: "delivered", occurred_at: "2026-06-29T10:00:00Z" },
      { event_type: "opened", occurred_at: "2026-06-29T10:01:00Z" },
      { event_type: "opened", occurred_at: "2026-06-29T10:05:00Z" }
    ]);
    expect(res.latest_delivery_state).toBe("opened");
    expect(res.event_counts.delivered).toBe(1);
    expect(res.event_counts.opened).toBe(2);
    expect(res.has_open).toBe(true);
    expect(res.last_event_at).toBe("2026-06-29T10:05:00Z");
  });

  it("should prioritize clicked over opened and delivered", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [
      { event_type: "delivered", occurred_at: "2026-06-29T10:00:00Z" },
      { event_type: "opened", occurred_at: "2026-06-29T10:01:00Z" },
      { event_type: "clicked", occurred_at: "2026-06-29T10:02:00Z" }
    ]);
    expect(res.latest_delivery_state).toBe("clicked");
    expect(res.has_click).toBe(true);
  });

  it("should override positive states with bounced risk state", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [
      { event_type: "delivered", occurred_at: "2026-06-29T10:00:00Z" },
      { event_type: "bounced", occurred_at: "2026-06-29T10:05:00Z" }
    ]);
    expect(res.latest_delivery_state).toBe("bounced");
    expect(res.has_bounce).toBe(true);
  });

  it("should override positive states with complained risk state", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [
      { event_type: "opened", occurred_at: "2026-06-29T10:00:00Z" },
      { event_type: "complained", occurred_at: "2026-06-29T10:05:00Z" }
    ]);
    expect(res.latest_delivery_state).toBe("complained");
  });

  it("should override with failed event", () => {
    const res = aggregateDeliveryEvents(baseJobSent, [
      { event_type: "delivered", occurred_at: "2026-06-29T10:00:00Z" },
      { event_type: "failed", occurred_at: "2026-06-29T10:01:00Z" }
    ]);
    expect(res.latest_delivery_state).toBe("failed");
  });

  it("should correctly identify sandbox jobs", () => {
    const res = aggregateDeliveryEvents(baseJobSandbox, []);
    expect(res.sandbox_badge).toBe(true);
  });
});
