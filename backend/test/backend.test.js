const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../server');
const { createBackendAiService } = require('../src/ai/backendAiService');
const { createOpenAIProvider, DEFAULT_OPENAI_MODEL } = require('../src/ai/providers/openaiProvider');
const projectRoot = path.resolve(__dirname, '..', '..');

const withServer = async (aiService, test) => {
  const server = createServer({ aiService }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await test(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); await once(server, 'close'); }
};

(async () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.4-mini');
  let providerRequest;
  const provider = createOpenAIProvider({ apiKey: 'test-placeholder', fetchImpl: async (url, options) => { providerRequest = { url, options }; return { ok: true, status: 200, headers: { get: () => 'req_test' }, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'Réponse test' }] }] }) }; } });
  assert.equal(await provider.generate({ message: 'Réponds en français : ça fonctionne ?', context: { goal: 'reduce' } }), 'Réponse test');
  const providerBody = JSON.parse(providerRequest.options.body); assert.equal(providerBody.store, false); assert.equal(providerBody.model, 'gpt-5.4-mini'); assert.equal(typeof providerBody.input, 'string'); assert.match(providerBody.input, /Réponds en français : ça fonctionne \?/);
  await assert.rejects(createOpenAIProvider({ apiKey: '' }).generate({ message: 'Bonjour', context: {} }), { code: 'OPENAI_NOT_CONFIGURED', statusCode: 503 });

  const failedProvider = createOpenAIProvider({ apiKey: 'test-placeholder', fetchImpl: async () => ({
    ok: false,
    status: 400,
    headers: { get: (name) => name === 'x-request-id' ? 'req_failure' : null },
    json: async () => ({ error: { code: 'invalid_request_error', message: 'Unsupported field.' } }),
  }) });
  await assert.rejects(failedProvider.generate({ message: 'Bonjour', context: {} }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.deepEqual(error.providerDetails, { status: 400, code: 'invalid_request_error', message: 'Unsupported field.', requestId: 'req_failure' });
    return true;
  });

  await withServer({ sendMessage: async ({ message, context }) => ({ reply: `${message} / ${context.goal}` }) }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: { goal: 'reduce' } }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { reply: 'Test / reduce' });
  });
  const unconfiguredServer = createServer({
    aiService: createBackendAiService({ provider: createOpenAIProvider({ apiKey: '' }) }),
    logger: { error: () => {} },
  });
  unconfiguredServer.listen(0, '127.0.0.1'); await once(unconfiguredServer, 'listening');
  try {
    const baseUrl = `http://127.0.0.1:${unconfiguredServer.address().port}`;
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: {} }) });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: { code: 'AI_NOT_CONFIGURED', message: 'The companion is unavailable.' } });
  } finally { unconfiguredServer.close(); await once(unconfiguredServer, 'close'); }

  const logLines = [];
  const loggedError = Object.assign(new Error('OPENAI_REQUEST_FAILED'), {
    code: 'OPENAI_REQUEST_FAILED', statusCode: 502,
    providerDetails: { status: 400, code: 'invalid_request_error', message: 'Unsupported field.', requestId: 'req_failure' },
  });
  const loggingServer = createServer({
    aiService: { sendMessage: async () => { throw loggedError; } },
    logger: { error: (line) => logLines.push(line) },
  });
  loggingServer.listen(0, '127.0.0.1'); await once(loggingServer, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${loggingServer.address().port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'secret user content', context: {} }) });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: { code: 'AI_UNAVAILABLE', message: 'The companion is unavailable.' } });
  } finally { loggingServer.close(); await once(loggingServer, 'close'); }
  assert.match(logLines[0], /status=400 code=invalid_request_error/);
  assert.match(logLines[0], /request_id=req_failure/);
  assert.doesNotMatch(logLines[0], /secret user content|Authorization|test-placeholder/);

  const mobileSource = fs.readFileSync(path.join(projectRoot, 'src/ai/providers/openaiProvider.js'), 'utf8');
  assert.equal(/api\.openai\.com|OPENAI_API_KEY|Authorization/.test(mobileSource), false);
  const backendSource = fs.readFileSync(path.join(projectRoot, 'backend/src/ai/providers/openaiProvider.js'), 'utf8');
  assert.equal(/store:\s*false/.test(backendSource), true); assert.equal(/file_search|retrieveScientificContext|eventExtraction/.test(backendSource), false);
  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8'); assert.equal(/^\.env$/m.test(gitignore), true);
  const backendPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend/package.json'), 'utf8'));
  assert.match(backendPackage.scripts.start, /--use-system-ca/);
  console.log('Backend HTTP, provider OpenAI et transport mobile validés.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
