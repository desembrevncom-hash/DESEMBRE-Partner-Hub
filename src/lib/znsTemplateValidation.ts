export interface ZnsTemplate {
  id: string;
  sender_account_id: string;
  zalo_template_id: string;
  template_name: string;
  purpose?: string;
  category?: string;
  status: string;
  required_params: string[];
  sample_payload: Record<string, any>;
  is_active: boolean;
  last_synced_at?: string;
}

export function getMissingRequiredParams(
  requiredParams: string[],
  payload: Record<string, any>,
): string[] {
  if (!requiredParams || !Array.isArray(requiredParams)) {
    return [];
  }

  return requiredParams.filter(
    (param) => payload[param] === undefined || payload[param] === null || payload[param] === "",
  );
}

export function validateZnsTemplatePayload(
  template: ZnsTemplate,
  payload: Record<string, any>,
): { isValid: boolean; missingParams: string[]; error?: string } {
  if (!template) {
    return { isValid: false, missingParams: [], error: "Template is required" };
  }

  if (!template.is_active) {
    return { isValid: false, missingParams: [], error: "Template is not active" };
  }

  const missingParams = getMissingRequiredParams(template.required_params, payload);

  if (missingParams.length > 0) {
    return {
      isValid: false,
      missingParams,
      error: `Missing required parameters: ${missingParams.join(", ")}`,
    };
  }

  return { isValid: true, missingParams: [] };
}

export function normalizeZnsParams(paramsStr: string): string[] {
  if (!paramsStr) return [];

  return paramsStr
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
