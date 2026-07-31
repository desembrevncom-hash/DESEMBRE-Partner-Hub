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

  if (templateCode === 'class_reminder') {
    const regRecValue = senderMapping['registration_received'];
    
    if (!templateId) {
      return {
        ok: false,
        errorCode: 'CLASS_REMINDER_TEMPLATE_NOT_CONFIGURED',
        message: 'Class Reminder ZNS Template is not configured in environment (ZALO_ZNS_TEMPLATE_CLASS_REMINDER)',
        expectedEnvKey: envKey
      };
    }

    if (!isValidTemplateId(templateId)) {
      return {
        ok: false,
        errorCode: 'CLASS_REMINDER_TEMPLATE_NOT_CONFIGURED',
        message: 'Class Reminder ZNS Template (ZALO_ZNS_TEMPLATE_CLASS_REMINDER) has an invalid value',
        expectedEnvKey: envKey
      };
    }

    if (regRecValue && isValidTemplateId(regRecValue) && templateId.trim() === regRecValue.trim()) {
      return {
        ok: false,
        errorCode: 'CLASS_REMINDER_TEMPLATE_ID_MUST_BE_SEPARATE',
        message: 'ZALO_ZNS_TEMPLATE_CLASS_REMINDER cannot be identical to ZALO_ZNS_TEMPLATE_REGISTRATION_RECEIVED (must be a separate ZNS template)',
        expectedEnvKey: envKey
      };
    }
  }

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
