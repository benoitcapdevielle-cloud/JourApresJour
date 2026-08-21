const http = require('node:http');
const { createBackendAiService } = require('./src/ai/backendAiService');

const MAX_BODY_BYTES = 65536;
const RATE_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 30;

const sendJson = (response, statusCode, payload, origin) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  response.writeHead(statusCode, headers); response.end(JSON.stringify(payload));
};

const readJsonBody = (request) => new Promise((resolve, reject) => {
  let body = ''; let size = 0;
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY_BYTES) { const error = new Error('REQUEST_TOO_LARGE'); error.statusCode = 413; reject(error); request.destroy(); return; }
    body += chunk;
  });
  request.on('end', () => {
    try { resolve(JSON.parse(body || '{}')); } catch { const error = new Error('INVALID_JSON'); error.statusCode = 400; reject(error); }
  });
  request.on('error', reject);
});

const cleanLogValue = (value, fallback) => {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.replace(/[\r\n]+/g, ' ').replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 500);
};

const logBackendError = (error, logger) => {
  if (typeof logger?.error !== 'function') return;
  const details = error?.providerDetails;
  if (details) {
    const status = Number.isInteger(details.status) ? details.status : 'network';
    const code = cleanLogValue(details.code, error?.code || 'unknown');
    const message = cleanLogValue(details.message, 'Provider request failed.');
    const requestId = cleanLogValue(details.requestId, 'n/a');
    logger.error(`OpenAI error: status=${status} code=${code} message=${JSON.stringify(message)} request_id=${requestId}`);
    return;
  }
  logger.error(`Backend AI error: code=${cleanLogValue(error?.code, 'unknown')}`);
};

function createServer({ aiService = createBackendAiService(), allowedOrigin = process.env.ALLOWED_ORIGIN || '', logger = console } = {}) {
  const clients = new Map();
  const isRateLimited = (address) => {
    const now = Date.now(); const previous = clients.get(address);
    const entry = !previous || now - previous.startedAt >= RATE_WINDOW_MS ? { startedAt: now, count: 0 } : previous;
    entry.count += 1; clients.set(address, entry); return entry.count > MAX_REQUESTS_PER_WINDOW;
  };
  return http.createServer(async (request, response) => {
    const requestOrigin = request.headers.origin;
    const corsOrigin = allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : '';
    if (request.method === 'OPTIONS' && request.url === '/api/chat') {
      if (requestOrigin && !corsOrigin) return sendJson(response, 403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed.' } });
      response.writeHead(204, { 'Access-Control-Allow-Origin': corsOrigin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); response.end(); return;
    }
    if (request.method === 'GET' && request.url === '/health') return sendJson(response, 200, { status: 'ok' }, corsOrigin);
    if (request.method !== 'POST' || request.url !== '/api/chat') return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.' } }, corsOrigin);
    if (requestOrigin && !corsOrigin) return sendJson(response, 403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed.' } });
    if (isRateLimited(request.socket.remoteAddress || 'unknown')) return sendJson(response, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }, corsOrigin);
    try {
      const result = await aiService.sendMessage(await readJsonBody(request));
      return sendJson(response, 200, result, corsOrigin);
    } catch (error) {
      logBackendError(error, logger);
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      const code = statusCode === 503 ? 'AI_NOT_CONFIGURED' : statusCode < 500 ? 'INVALID_REQUEST' : statusCode === 504 ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE';
      return sendJson(response, statusCode, { error: { code, message: statusCode < 500 ? 'Invalid request.' : 'The companion is unavailable.' } }, corsOrigin);
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3001;
  createServer().listen(port, '0.0.0.0', () => console.log(`Jour après Jour backend listening on port ${port}`));
}

module.exports = { createServer, logBackendError };
