import { ZNS_TEMPLATE_MAPPING, isValidTemplateId } from './config.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = process.env['ACADEMY_SUPABASE_URL'];
  const serviceRoleKey = process.env['ACADEMY_SUPABASE_SERVICE_ROLE_KEY'];
  const cronSecret = process.env['CRON_SECRET'];
  const hubWorkerSecret = process.env['HUB_WORKER_SECRET'];
  const hubSupabaseUrl = process.env['HUB_SUPABASE_URL'];
  const hubInternalKey = process.env['HUB_INTERNAL_FUNCTION_KEY'];

  // Check mappings for default sender 'oa_desembre'
  const oaDesembreMap = ZNS_TEMPLATE_MAPPING['oa_desembre'] || {};
  const hasRegReceived = isValidTemplateId(oaDesembreMap['registration_received']);
  const hasRegConfirmed = isValidTemplateId(oaDesembreMap['registration_confirmed']);

  let canResolveZaloAccessToken = false;
  let credentialResolverErrorCode: string | null = null;

  if (hubSupabaseUrl && hubInternalKey) {
    try {
      const credRes = await fetch(`${hubSupabaseUrl}/functions/v1/resolve-zalo-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': hubInternalKey
        },
        body: JSON.stringify({ sender_key: 'oa_desembre' })
      });
      if (credRes.ok) {
        const credData = await credRes.json();
        const token = credData.access_token || credData.accessToken || credData.token;
        if (token) {
          canResolveZaloAccessToken = true;
        } else {
          credentialResolverErrorCode = 'MISSING_ACCESS_TOKEN';
        }
      } else {
         const errText = await credRes.text();
         try {
           const parsed = JSON.parse(errText);
           credentialResolverErrorCode = parsed.error || `HTTP_${credRes.status}`;
         } catch(e) {
           credentialResolverErrorCode = `HTTP_${credRes.status}`;
         }
      }
    } catch (err: any) {
      credentialResolverErrorCode = 'FETCH_FAILED';
    }
  } else {
    credentialResolverErrorCode = 'MISSING_ENV_CONFIG';
  }

  return res.status(200).json({
    ok: true,
    env: {
      hasAcademySupabaseUrl: Boolean(supabaseUrl),
      hasAcademyServiceRoleKey: Boolean(serviceRoleKey),
      hasCronSecret: Boolean(cronSecret),
      hasHubWorkerSecret: Boolean(hubWorkerSecret),
      hasZaloSenderCredential: Boolean(hubSupabaseUrl && hubInternalKey),
      canCallResolveFunction: Boolean(hubSupabaseUrl && hubInternalKey),
      canResolveZaloAccessToken,
      credentialResolverErrorCode,
      hasRegistrationReceivedTemplateMapping: hasRegReceived,
      hasRegistrationConfirmedTemplateMapping: hasRegConfirmed,
      hasTemplateMappings: hasRegReceived && hasRegConfirmed
    }
  });
}
