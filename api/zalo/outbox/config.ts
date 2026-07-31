// Template ID ENV key mapping per template_code
const TEMPLATE_ENV_KEYS: Record<string, string> = {
  'registration_received': 'ZALO_ZNS_TEMPLATE_REGISTRATION_RECEIVED',
  'registration_confirmed': 'ZALO_ZNS_TEMPLATE_REGISTRATION_CONFIRMED',
  'class_reminder': 'ZALO_ZNS_TEMPLATE_CLASS_REMINDER'
};

export function isValidTemplateId(value: unknown): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(your|<|placeholder|\.\.\.|xxx)/i.test(trimmed)) return false;
  return /^\d{4,}$/.test(trimmed);
}

export const ZNS_TEMPLATE_MAPPING: Record<string, Record<string, string>> = {
  'oa_desembre': {
    'registration_received': process.env['ZALO_ZNS_TEMPLATE_REGISTRATION_RECEIVED'] || '',
    'registration_confirmed': process.env['ZALO_ZNS_TEMPLATE_REGISTRATION_CONFIRMED'] || '',
    'class_reminder': process.env['ZALO_ZNS_TEMPLATE_CLASS_REMINDER'] || ''
  }
};

export function resolveZnsTemplateConfig(senderKey: string, templateCode: string): {
  ok: boolean;
  templateId?: string;
  templateCode?: string;
  senderKey?: string;
  errorCode?: string;
  message?: string;
  expectedEnvKey?: string;
} {
  const senderMapping = ZNS_TEMPLATE_MAPPING[senderKey];
  if (!senderMapping) {
    return {
      ok: false,
      errorCode: 'SENDER_KEY_NOT_FOUND',
      message: `No template mapping for sender_key=${senderKey}`
    };
  }

  const templateId = senderMapping[templateCode];
  const envKey = TEMPLATE_ENV_KEYS[templateCode] || `ZALO_ZNS_TEMPLATE_${templateCode.toUpperCase()}`;

  if (!templateId) {
    return {
      ok: false,
      errorCode: 'TEMPLATE_NOT_CONFIGURED',
      message: `ZNS Template not configured: ${templateCode} requires env ${envKey}`,
      expectedEnvKey: envKey
    };
  }

  if (!isValidTemplateId(templateId)) {
    return {
      ok: false,
      errorCode: 'INVALID_TEMPLATE_ID',
      message: `ZNS Template not configured: ${templateCode} requires env ${envKey} (current value is invalid)`,
      expectedEnvKey: envKey
    };
  }

  return {
    ok: true,
    templateId,
    templateCode,
    senderKey
  };
}
