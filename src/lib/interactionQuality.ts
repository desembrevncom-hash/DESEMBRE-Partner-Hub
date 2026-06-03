export type InteractionQuality = "high" | "medium" | "low" | "negative" | "neutral" | "system";

export const INTERACTION_WEIGHTS: Record<string, { weight: number; quality: InteractionQuality }> =
  {
    call_connected: { weight: 5, quality: "high" },
    call_no_answer: { weight: 1, quality: "low" },
    call_wrong_number: { weight: 0, quality: "negative" },
    zalo_message: { weight: 3, quality: "medium" },
    facebook_message: { weight: 3, quality: "medium" },
    email: { weight: 2, quality: "low" },
    meeting: { weight: 10, quality: "high" },
    quote_sent: { weight: 8, quality: "high" },
    task: { weight: 1, quality: "low" },
    note: { weight: 0, quality: "neutral" },
    automation: { weight: 0, quality: "system" },
  };

export function getInteractionWeight(type: string, result?: string): number {
  // Overrides based on result for communication platforms
  if (result === "copied") {
    if (type === "zalo_message" || type === "facebook_message") return 2;
    if (type === "email") return 1;
  }

  if (result === "interested") return 5;
  if (result === "callback") return 4;
  if (result === "no_answer") return 1;
  if (result === "wrong_number") return 0;
  if (result === "unreachable") return 1;
  if (result === "quote_sent") return 8;

  return INTERACTION_WEIGHTS[type]?.weight ?? 0;
}

export function getInteractionQuality(type: string, result?: string): InteractionQuality {
  if (result === "copied") return "low"; // Copy action is always low quality

  if (result === "interested") return "high";
  if (result === "callback") return "medium";
  if (result === "no_answer") return "low";
  if (result === "wrong_number") return "negative";
  if (result === "unreachable") return "low";
  if (result === "quote_sent") return "high";

  return INTERACTION_WEIGHTS[type]?.quality ?? "neutral";
}

export function isRealTouchpoint(type: string): boolean {
  return type !== "note" && type !== "automation";
}

export function isPositiveTouchpoint(type: string, result?: string): boolean {
  const quality = getInteractionQuality(type, result);
  return quality === "high" || quality === "medium";
}
