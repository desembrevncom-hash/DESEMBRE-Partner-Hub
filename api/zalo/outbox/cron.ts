import { processOutbox } from './shared';

function getHeader(req: any, name: string) {
  const headers = req.headers;
  const lower = name.toLowerCase();

  if (headers && typeof headers.get === "function") {
    return headers.get(name) || headers.get(lower);
  }

  return headers?.[lower] || headers?.[name];
}

export default async function handler(req: any, res: any) {
  // Allow GET and POST for Cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cronSecret = process.env['CRON_SECRET'];
  const hubWorkerSecret = process.env['HUB_WORKER_SECRET'];

  const authHeader = getHeader(req, "authorization");
  const workerSecretHeader = getHeader(req, "x-hub-worker-secret");

  const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isManualAuthorized = hubWorkerSecret && workerSecretHeader === hubWorkerSecret;

  if (!isCronAuthorized && !isManualAuthorized) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized cron request",
      debug: {
        hasCronSecret: Boolean(cronSecret),
        hasHubWorkerSecret: Boolean(hubWorkerSecret),
        hasAuthorizationHeader: Boolean(authHeader),
        hasHubWorkerSecretHeader: Boolean(workerSecretHeader),
        authModeAccepted: ["Authorization: Bearer <CRON_SECRET>", "x-hub-worker-secret: <HUB_WORKER_SECRET>"]
      }
    });
  }

  try {
    const host = getHeader(req, 'host') || 'localhost';
    const urlObj = new URL(req.url, `http://${host}`);
    const qsMode = urlObj.searchParams.get('mode');
    const qsLimit = urlObj.searchParams.get('limit');
    const dryRun = urlObj.searchParams.get('dryRun') === '1' || urlObj.searchParams.get('dryRun') === 'true';

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, mode: qsMode || 'simulate', auth: true });
    }

    // Default to 'simulate' for local dev if specified, otherwise 'real'
    const mode = qsMode === 'simulate' ? 'simulate' : 'real';
    const limit = qsLimit && !isNaN(parseInt(qsLimit, 10)) ? parseInt(qsLimit, 10) : 10;

    const result = await processOutbox(mode, limit, 'cron');
    
    // Return standard JSON for Vercel Cron logging
    return res.status(200).json({
      ok: true,
      triggered_by: 'cron',
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      message: result.message
    });

  } catch (error: any) {
    if (error.message && error.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(error.message);
        return res.status(500).json(parsed);
      } catch (e) {}
    }
    console.error('Hub ZNS cron error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
