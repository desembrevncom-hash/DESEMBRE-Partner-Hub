export interface PilotSettings {
  pilot_mode: boolean;
  pilot_user_ids: string[];
  enabled_features: {
    ai_summary: boolean;
    ai_suggestion: boolean;
    ai_rewrite: boolean;
    ai_rag: boolean;
    automation_advanced: boolean;
    product_knowledge_qa: boolean;
  };
}

const DEFAULT_SETTINGS: PilotSettings = {
  pilot_mode: false,
  pilot_user_ids: [],
  enabled_features: {
    ai_summary: true,
    ai_suggestion: true,
    ai_rewrite: true,
    ai_rag: true,
    automation_advanced: true,
    product_knowledge_qa: true,
  },
};

const STORAGE_KEY = "pilotModeSettings";

export function getPilotSettings(): PilotSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        enabled_features: {
          ...DEFAULT_SETTINGS.enabled_features,
          ...(parsed.enabled_features || {}),
        },
      };
    } catch (e) {
      console.error("Failed to parse pilot settings", e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function savePilotSettings(settings: PilotSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isPilotUser(userId: string): boolean {
  const settings = getPilotSettings();
  if (!settings.pilot_mode) return true;
  return settings.pilot_user_ids.includes(userId);
}

export function isFeatureEnabledForUser(
  featureKey: keyof PilotSettings["enabled_features"],
  userId: string | undefined,
): boolean {
  if (!userId) return false;
  const settings = getPilotSettings();
  if (!settings.pilot_mode) return true;
  if (!settings.enabled_features[featureKey]) return false;
  return settings.pilot_user_ids.includes(userId);
}
