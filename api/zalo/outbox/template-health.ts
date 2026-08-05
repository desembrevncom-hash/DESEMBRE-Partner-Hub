import { ZNS_TEMPLATE_MAPPING, isValidTemplateId } from './config.js';

const TEMPLATE_ENV_KEYS: Record<string, string> = {
  'registration_received': 'ZALO_ZNS_TEMPLATE_REGISTRATION_RECEIVED',
  'registration_confirmed': 'ZALO_ZNS_TEMPLATE_REGISTRATION_CONFIRMED',
  'class_reminder': 'ZALO_ZNS_TEMPLATE_CLASS_REMINDER',
  'student_login_otp': 'ZALO_ZNS_TEMPLATE_STUDENT_LOGIN_OTP'
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const senderKey = 'oa_desembre';
    const mapping = ZNS_TEMPLATE_MAPPING[senderKey] || {};

    const templates: Record<string, any> = {};
    let allValid = true;

    const regRecValue = (mapping['registration_received'] || '').trim();
    const classRemValue = (mapping['class_reminder'] || '').trim();

    for (const [templateCode, envKey] of Object.entries(TEMPLATE_ENV_KEYS)) {
      const value = (mapping[templateCode] || '').trim();
      const configured = Boolean(value);
      let valid = isValidTemplateId(value);
      let warning: string | null = null;

      if (templateCode === 'class_reminder') {
        if (!configured || !valid) {
          warning = 'CLASS_REMINDER_TEMPLATE_NOT_CONFIGURED';
          valid = false;
        } else if (regRecValue && isValidTemplateId(regRecValue) && value === regRecValue) {
          warning = 'CLASS_REMINDER_TEMPLATE_ID_MUST_BE_SEPARATE';
          valid = false;
        }
      }

      if (templateCode === 'student_login_otp') {
        if (!configured || !valid) {
          warning = 'STUDENT_LOGIN_OTP_TEMPLATE_NOT_CONFIGURED';
          valid = false;
        } else if ((regRecValue && isValidTemplateId(regRecValue) && value === regRecValue) ||
                   (classRemValue && isValidTemplateId(classRemValue) && value === classRemValue)) {
          warning = 'STUDENT_LOGIN_OTP_TEMPLATE_ID_MUST_BE_SEPARATE';
          valid = false;
        }
      }

      if (!valid) allValid = false;

      templates[templateCode] = {
        envKey,
        configured,
        valid,
        warning,
        length: value.length,
        preview: valid ? value.substring(0, 2) + '...' : null
      };
    }

    return res.status(200).json({
      ok: allValid,
      sender_key: senderKey,
      templates
    });
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      sender_key: 'oa_desembre',
      templates: {},
      errorCode: 'UNHANDLED_EXCEPTION',
      errorMessage: error.message || 'Unknown error'
    });
  }
}
