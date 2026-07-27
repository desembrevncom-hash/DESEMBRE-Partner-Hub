import { ZNS_TEMPLATE_MAPPING, isValidTemplateId } from './config.js';
import { safeResolveZaloCredential } from './shared.js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const host = req.headers?.host || 'localhost';
    const urlObj = new URL(req.url || '', `http://${host}`);
    const senderKey = urlObj.searchParams.get('sender_key') || 'oa_desembre';

    const resolution = await safeResolveZaloCredential(senderKey);

    const responseTemplate: any = {
      ok: resolution.ok,
      sender_key: senderKey,
      resolverCalled: resolution.resolverCalled,
      resolverStatus: resolution.resolverStatus,
      hasAuthorizationHeader: Boolean(process.env['HUB_SUPABASE_ANON_KEY'] || process.env['HUB_SUPABASE_SERVICE_ROLE_KEY']),
      hasInternalFunctionKeyHeader: Boolean(process.env['HUB_INTERNAL_FUNCTION_KEY']),
      expectedHeaderName: 'X-Internal-Key / Authorization',
      hasAccessToken: Boolean(resolution.accessToken),
      accessTokenLength: resolution.accessToken ? resolution.accessToken.length : null,
      tokenPrefixSafe: resolution.accessToken ? resolution.accessToken.substring(0, 10) + '...' : null,
      templateMapping: {
        registration_received: isValidTemplateId(ZNS_TEMPLATE_MAPPING[senderKey]?.['registration_received']),
        registration_confirmed: isValidTemplateId(ZNS_TEMPLATE_MAPPING[senderKey]?.['registration_confirmed'])
      },
      errorCode: resolution.errorCode,
      errorMessage: resolution.errorMessage
    };

    return res.status(200).json(responseTemplate);
  } catch (error: any) {
    return res.status(200).json({
      ok: false,
      sender_key: "unknown",
      resolverCalled: false,
      resolverStatus: null,
      hasAccessToken: false,
      accessTokenLength: null,
      tokenPrefixSafe: null,
      templateMapping: {
        registration_received: false,
        registration_confirmed: false
      },
      errorCode: "UNHANDLED_EXCEPTION",
      errorMessage: error.message || "Unknown error occurred"
    });
  }
}
