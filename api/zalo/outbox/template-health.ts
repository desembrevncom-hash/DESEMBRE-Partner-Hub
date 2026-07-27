import { ZNS_TEMPLATE_MAPPING, isValidTemplateId } from './config.js';

const TEMPLATE_ENV_KEYS: Record<string, string> = {
  'registration_received': 'ZALO_ZNS_TEMPLATE_REGISTRATION_RECEIVED',
  'registration_confirmed': 'ZALO_ZNS_TEMPLATE_REGISTRATION_CONFIRMED'
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

    for (const [templateCode, envKey] of Object.entries(TEMPLATE_ENV_KEYS)) {
      const value = mapping[templateCode] || '';
      const configured = Boolean(value);
      const valid = isValidTemplateId(value);
      if (!valid) allValid = false;

      templates[templateCode] = {
        envKey,
        configured,
        valid,
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
