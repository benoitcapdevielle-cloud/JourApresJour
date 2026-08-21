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
const stored = new Map(); const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => stored.set(key, value),
    removeItem: async (key) => stored.delete(key),
  };
  return originalLoad.call(this, request, parent, isMain);
};

const memoryService = require('../src/services/memoryService');
const { buildAIContext } = require('../src/ai/buildAIContext');
const event = (id, type, date, extra = {}) => ({ id, eventType: type, date, craving: 5, note: `note complète ${id}`, substances: [], triggers: [], strategies: [], ...extra });

(async () => {
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);
  await memoryService.saveMemories({ firstName: ' Léa ', motivations: [' Retrouver mon énergie ', ''], importantPeople: ['Sam'] });
  assert.deepEqual(await memoryService.loadMemories(), { firstName: 'Léa', motivations: ['Retrouver mon énergie'], importantPeople: ['Sam'], riskSituations: [], helpfulStrategies: [], personalNotes: [] });
  await memoryService.saveMemories({ firstName: 'Léa', motivations: ['Dormir mieux'], riskSituations: ['Fatigue'] });
  assert.deepEqual((await memoryService.loadMemories()).motivations, ['Dormir mieux']);
  assert.deepEqual(await memoryService.clearMemories(), memoryService.EMPTY_MEMORIES);
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);

  const emptyContext = buildAIContext({ events: [], profile: { goal: 'reduce' }, memories: {} });
  assert.equal(emptyContext.goal, 'reduce'); assert.equal(emptyContext.behaviorSummary.consumptionEventCount, 0); assert.equal('recentEvent' in emptyContext, false);
  const events = [
    event('1', 'consumption', '2026-08-19T20:00:00', { triggers: ['Fatigue'] }),
    event('2', 'craving_resisted', '2026-08-20T20:00:00', { strategies: ['Sortir marcher'] }),
  ];
  const context = buildAIContext({ events, profile: { goal: 'reduce' }, memories: { motivations: ['A', 'B'], personalNotes: ['Information privée complète'] } });
  assert.equal(context.behaviorSummary.consumptionEventCount, 1); assert.equal(context.recentEvent.type, 'craving_resisted');
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('note complète'), false); assert.equal(serialized.includes('Information privée complète'), false); assert.equal(serialized.includes('substances'), false); assert.equal(serialized.includes('personalNotes'), false);
  assert.equal(serialized.includes(JSON.stringify(events)), false);
  console.log('Mémoire locale et génération de contexte validées.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
