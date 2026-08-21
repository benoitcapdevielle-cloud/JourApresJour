const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const { createServer } = require('../server');
const { createBackendAiService } = require('../src/ai/backendAiService');
const { createOpenAIProvider, DEFAULT_OPENAI_MODEL } = require('../src/ai/providers/openaiProvider');

const withServer = async (aiService, test) => {
  const server = createServer({ aiService }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await test(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); await once(server, 'close'); }
};

(async () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.4-mini');
  let providerRequest;
  const provider = createOpenAIProvider({ apiKey: 'test-placeholder', fetchImpl: async (url, options) => { providerRequest = { url, options }; return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: 'Réponse test' }] }] }) }; } });
  assert.equal(await provider.generate({ message: 'Bonjour', context: { goal: 'reduce' } }), 'Réponse test');
  const providerBody = JSON.parse(providerRequest.options.body); assert.equal(providerBody.store, false); assert.equal(providerBody.model, 'gpt-5.4-mini'); assert.equal(providerBody.input.length, 1);
  await assert.rejects(createOpenAIProvider({ apiKey: '' }).generate({ message: 'Bonjour', context: {} }), { code: 'OPENAI_NOT_CONFIGURED', statusCode: 503 });

  await withServer({ sendMessage: async ({ message, context }) => ({ reply: `${message} / ${context.goal}` }) }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: { goal: 'reduce' } }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { reply: 'Test / reduce' });
  });
  await withServer(createBackendAiService({ provider: createOpenAIProvider({ apiKey: '' }) }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: {} }) });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: { code: 'AI_NOT_CONFIGURED', message: 'The companion is unavailable.' } });
  });

  const mobileSource = fs.readFileSync('./src/ai/providers/openaiProvider.js', 'utf8');
  assert.equal(/api\.openai\.com|OPENAI_API_KEY|Authorization/.test(mobileSource), false);
  const backendSource = fs.readFileSync('./backend/src/ai/providers/openaiProvider.js', 'utf8');
  assert.equal(/store:\s*false/.test(backendSource), true); assert.equal(/file_search|retrieveScientificContext|eventExtraction/.test(backendSource), false);
  const gitignore = fs.readFileSync('./.gitignore', 'utf8'); assert.equal(/^\.env$/m.test(gitignore), true);
  console.log('Backend HTTP, provider OpenAI et transport mobile validés.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
