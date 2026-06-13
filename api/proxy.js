const http = require('http');
const { URL } = require('url');

const GOMCOOK_BASE = 'http://api-eu.gomcook.com';

// Disable Vercel's automatic body parsing so we can forward the raw stream
module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path, ...queryParams } = req.query;
  if (!path) {
    res.status(400).json({ error: 'path parameter required' });
    return;
  }

  const qs = new URLSearchParams(queryParams).toString();
  const targetUrl = `${GOMCOOK_BASE}${path}${qs ? '?' + qs : ''}`;

  try {
    // Read raw body from stream (bodyParser disabled above)
    let body = '';
    if (req.method === 'POST') {
      body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
    }

    const parsedUrl = new URL(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const result = await new Promise((resolve, reject) => {
      const httpReq = http.request(options, httpRes => {
        let data = '';
        httpRes.on('data', chunk => { data += chunk; });
        httpRes.on('end', () => resolve({ status: httpRes.statusCode, data }));
      });
      httpReq.on('error', reject);
      if (body) httpReq.write(body);
      httpReq.end();
    });

    res.status(result.status);
    try {
      res.json(JSON.parse(result.data));
    } catch {
      res.send(result.data);
    }
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
};
