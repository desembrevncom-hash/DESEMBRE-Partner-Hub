import { processOutbox } from './shared';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const expectedSecret = process.env['HUB_WORKER_SECRET'] || '';
  if (!expectedSecret) {
    return res.status(500).json({ error: 'Missing HUB_WORKER_SECRET in Hub environment.' });
  }

  const providedSecret = req.headers['x-hub-worker-secret'];
  if (!providedSecret || providedSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid worker secret' });
  }

  try {
    const mode = req.body?.mode || 'simulate';
    const limit = req.body?.limit || 5;

    const result = await processOutbox(mode, limit, 'manual');
    
    return res.status(200).json(result);

  } catch (error: any) {
    if (error.message && error.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(error.message);
        return res.status(500).json(parsed);
      } catch (e) {}
    }
    console.error('Hub ZNS process error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
