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
const { buildTalkPreview } = require('../src/utils/talkPreview');
const event = (id, type, date, targets, extra = {}) => ({ id, eventType: type, date, craving: 5, note: `note complète ${id}`, targets, triggers: [], strategies: [], ...extra });
const target = (category, type) => ({ category, type, measurement: { source: 'manual' } });

(async () => {
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);
  await memoryService.saveMemories({ firstName: ' Léa ', motivations: [' Retrouver mon énergie ', ''], importantPeople: ['Sam'] });
  assert.deepEqual(await memoryService.loadMemories(), { firstName: 'Léa', motivations: ['Retrouver mon énergie'], importantPeople: ['Sam'], riskSituations: [], helpfulStrategies: [], personalNotes: [] });
  await memoryService.saveMemories({ firstName: 'Léa', motivations: ['Dormir mieux'], importantPeople: ['Sam'], riskSituations: ['Fatigue'] });
  assert.deepEqual((await memoryService.loadMemories()).motivations, ['Dormir mieux']); assert.deepEqual((await memoryService.loadMemories()).importantPeople, ['Sam']);
  await memoryService.saveMemories({ firstName: 'Léa', motivations: [], importantPeople: ['Sam'] });
  assert.deepEqual((await memoryService.loadMemories()).motivations, []); assert.deepEqual((await memoryService.loadMemories()).importantPeople, ['Sam']);
  assert.deepEqual(await memoryService.clearMemories(), memoryService.EMPTY_MEMORIES);
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);

  const emptyContext = buildAIContext({ events: [], profile: { goal: 'reduce' }, memories: {} });
  assert.equal(emptyContext.goal, 'reduce'); assert.equal(emptyContext.behaviorSummary.consumptionEventCount, 0); assert.equal('recentEvent' in emptyContext, false); assert.deepEqual(buildTalkPreview({ context: emptyContext }), []);
  const events = [
    event('1', 'consumption', '2026-08-19T20:00:00', [target('substance', 'Alcool')], { triggers: ['Fatigue'], emotion: 'Stress' }),
    event('2', 'consumption', '2026-08-20T20:00:00', [target('digital', 'YouTube / vidéos')], { triggers: ['Fatigue'], emotion: 'Stress' }),
    event('3', 'craving_resisted', '2026-08-21T20:00:00', [target('digital', 'YouTube / vidéos')], { strategies: ['Sortir marcher'] }),
  ];
  const context = buildAIContext({ events, profile: { goal: 'reduce' }, memories: { firstName: 'Léa', motivations: ['A', 'B'], importantPeople: ['Sam'], helpfulStrategies: ['Marcher'], personalNotes: ['Information privée complète'] } });
  assert.equal(context.behaviorSummary.consumptionEventCount, 2); assert.equal(context.behaviorSummary.topTarget.value, 'YouTube / vidéos'); assert.deepEqual(context.personalContext.importantPeople, ['Sam']);
  const preview = buildTalkPreview({ context, goalLabel: 'Réduire' }); assert.ok(preview.includes('Ton objectif : Réduire')); assert.ok(preview.includes('Élément suivi le plus fréquent : YouTube / vidéos')); assert.ok(preview.includes('2 motivations personnelles enregistrées')); assert.ok(preview.includes('1 personne importante enregistrée'));
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('note complète'), false); assert.equal(serialized.includes('Information privée complète'), false); assert.equal(serialized.includes('targets'), false); assert.equal(serialized.includes('personalNotes'), false); assert.equal(serialized.includes('2026-08-'), false);
  assert.equal(serialized.includes(JSON.stringify(events)), false);
  const memoryScreen = fs.readFileSync('./src/screens/MemoryScreen.js', 'utf8'); assert.ok(memoryScreen.includes('ne sont envoyées à aucun service externe')); assert.ok(memoryScreen.includes('onSave'));
  const talkScreen = fs.readFileSync('./src/screens/TalkScreen.js', 'utf8'); assert.ok(talkScreen.includes('ne sont envoyés à aucune IA')); assert.ok(talkScreen.includes('onManageMemory'));
  console.log('Mémoire locale et génération de contexte validées.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
