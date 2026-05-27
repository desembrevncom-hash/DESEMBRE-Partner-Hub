export type TimelineType =
  | "interaction"
  | "task"
  | "automation"
  | "ai"
  | "order"
  | "note"
  | "system";

export const TIMELINE_TYPES: Record<string, TimelineType> = {
  INTERACTION: "interaction",
  TASK: "task",
  AUTOMATION: "automation",
  AI: "ai",
  ORDER: "order",
  NOTE: "note",
  SYSTEM: "system",
};
