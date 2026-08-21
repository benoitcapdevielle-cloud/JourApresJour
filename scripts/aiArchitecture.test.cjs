const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');

const originalExtension = Module._extensions['.js'];
Module._extensions['.js'] = (loaded, filename) => {
  if (!filename.includes('src')) return originalExtension(loaded, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const code = babel.transformSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  loaded._compile(code, filename);
};

const aiServiceModule = require('../src/ai/aiService');
const router = require('../src/ai/modelRouter');
const { createBackendProvider } = require('../src/ai/providers/openaiProvider');
const anthropicProvider = require('../src/ai/providers/anthropicProvider').default;
const googleProvider = require('../src/ai/providers/googleProvider').default;
const scienceRepository = require('../src/ai/science/scienceRepository');
const { retrieveScientificContext } = require('../src/ai/science/retrievalService');
const extraction = require('../src/ai/eventExtraction');
const { normalizeEvent } = require('../src/utils/eventUtils');

const target = (category, type, measurement = {}) => ({ category, type, measurement });
const detected = (targets, extra = {}) => ({ detected: true, confidence: 0.92, eventType: 'consumption', targets, craving: null, emotion: null, context: null, triggers: [], strategies: [], occurredAt: null, missingFields: [], ...extra });

(async () => {
  assert.equal(typeof aiServiceModule.aiService.sendMessage, 'function');
  assert.equal(typeof router.resolveModelRoute, 'function');
  assert.equal(router.resolveModelRoute(router.AI_TASK_TYPES.CONVERSATION).capabilityTier, 'economy');
  assert.equal(router.resolveModelRoute(router.AI_TASK_TYPES.SCIENTIFIC_ANSWER).useScientificContext, true);
  assert.equal(router.resolveModelRoute(router.AI_TASK_TYPES.CONVERSATION).modelId, 'backend-default');
  assert.equal(router.resolveModelRoute(router.AI_TASK_TYPES.CONVERSATION).providerId, 'openai');

  for (const provider of [anthropicProvider, googleProvider]) {
    assert.equal(typeof provider.generate, 'function');
    await assert.rejects(provider.generate({ messages: [], context: {}, taskType: 'conversation' }), { code: 'AI_PROVIDER_NOT_CONFIGURED' });
  }
  let backendRequest;
  const backendProvider = createBackendProvider({ endpoint: 'http://backend.test/api/chat', fetchImpl: async (url, options) => { backendRequest = { url, options }; return { ok: true, json: async () => ({ reply: ' Réponse locale ' }) }; } });
  assert.equal(await backendProvider.generate({ messages: [{ role: 'user', text: 'Bonjour' }], context: { goal: 'reduce' } }), 'Réponse locale');
  assert.deepEqual(JSON.parse(backendRequest.options.body), { message: 'Bonjour', context: { goal: 'reduce' } });
  assert.deepEqual(Object.keys(JSON.parse(backendRequest.options.body)).sort(), ['context', 'message']);
  await assert.rejects(createBackendProvider({ fetchImpl: async () => { throw new Error('offline'); } }).generate({ messages: [{ role: 'user', text: 'Test' }], context: {} }), { code: 'BACKEND_UNAVAILABLE' });
  await assert.rejects(createBackendProvider({ fetchImpl: async () => ({ ok: false, status: 503 }) }).generate({ messages: [{ role: 'user', text: 'Test' }], context: {} }), { code: 'BACKEND_NOT_CONFIGURED' });
  await assert.rejects(createBackendProvider({ fetchImpl: async () => ({ ok: true, json: async () => ({ reply: ' ' }) }) }).generate({ messages: [{ role: 'user', text: 'Test' }], context: {} }), { code: 'EMPTY_REPLY' });

  assert.deepEqual(scienceRepository.listScientificDocuments(), []);
  assert.equal(scienceRepository.getScientificDocumentById('missing'), null);
  assert.deepEqual(await retrieveScientificContext({ query: 'question', tags: ['addiction'], limit: 3 }), []);
  assert.equal(scienceRepository.normalizeScientificDocument({ id: 'fake', title: 'Fake', text: 'No fictional corpus', trustLevel: 'unknown' }), null);

  const alcohol = extraction.normalizeEventExtraction(detected([target('substance', 'Alcool', { quantity: 2, unit: 'verre(s)' })]));
  assert.equal(alcohol.targets[0].measurement.source, 'conversation'); assert.equal(alcohol.targets[0].measurement.quantity, 2);
  const youtube = extraction.normalizeEventExtraction(detected([target('digital', 'YouTube / vidéos', { durationMinutes: 75 })]));
  assert.equal(youtube.targets[0].measurement.durationMinutes, 75);
  const resisted = extraction.normalizeEventExtraction(detected([target('digital', 'Instagram')], { eventType: 'craving_resisted', craving: 7, strategies: ['Sortir marcher'] }));
  assert.equal(resisted.eventType, 'craving_resisted'); assert.deepEqual(resisted.strategies, ['Sortir marcher']);
  const multi = extraction.normalizeEventExtraction(detected([target('substance', 'Alcool'), target('substance', 'Cocaïne')]));
  assert.equal(multi.targets.length, 2); assert.ok(multi.targets.every(({ measurement }) => measurement.source === 'conversation'));
  const pending = extraction.createPendingEventSuggestion(detected([target('behavior', 'Jeux vidéo', { durationMinutes: 120 })]));
  assert.equal(pending.status, 'pending'); assert.equal(pending.requiresConfirmation, true); assert.equal(pending.trackerEvent.targets[0].measurement.source, 'conversation');
  assert.equal(extraction.DEFAULT_CONVERSATION_TRACKING_MODE, 'confirm');
  assert.equal(extraction.normalizeEventExtraction(null), null);
  assert.equal(extraction.normalizeEventExtraction({ detected: true, confidence: 2, eventType: 'unknown', targets: [] }), null);
  assert.equal(extraction.createPendingEventSuggestion({ detected: false, confidence: 1, targets: [] }), null);
  const normalizedTrackerEvent = normalizeEvent({ id: 'conversation-event', eventType: 'consumption', targets: pending.trackerEvent.targets });
  assert.equal(normalizedTrackerEvent.targets[0].measurement.source, 'conversation');

  const aiFiles = fs.readdirSync('./src/ai', { recursive: true }).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(`./src/ai/${name}`, 'utf8')).join('\n');
  assert.equal(/XMLHttpRequest|axios|https:\/\/api\.openai/i.test(aiFiles), false);
  assert.equal(/sk-[a-z0-9_-]{10,}|AIza[a-z0-9_-]{10,}|Bearer\s+[a-z0-9._-]{10,}/i.test(aiFiles), false);
  const talkScreen = fs.readFileSync('./src/screens/TalkScreen.js', 'utf8');
  assert.equal(/providers\/(openai|anthropic|google)/.test(talkScreen), false);
  console.log('Architecture IA modulaire, extraction et RAG abstrait validés.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
