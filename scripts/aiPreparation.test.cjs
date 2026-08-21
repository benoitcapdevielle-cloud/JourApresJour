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
const conversationService = require('../src/services/conversationService');
const { buildAIContext } = require('../src/ai/buildAIContext');
const { buildTalkPreview, hasEnoughBehaviorData } = require('../src/utils/talkPreview');
const event = (id, type, date, targets, extra = {}) => ({ id, eventType: type, date, craving: 5, note: `note complète ${id}`, targets, triggers: [], strategies: [], ...extra });
const target = (category, type) => ({ category, type, measurement: { source: 'manual' } });

(async () => {
  const privacyKey = 'jourApresJourPrivacyV1'; const privacySettings = JSON.stringify({ aiEnabled: false, aiMemoryEnabled: false, aiConsentGivenAt: null }); stored.set(privacyKey, privacySettings);
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);
  await memoryService.saveMemories({ firstName: ' Léa ', motivations: [' Retrouver mon énergie ', ''], importantPeople: ['Sam'], riskSituations: ['Fatigue'], helpfulStrategies: ['Marcher'], personalNotes: ['Parler à Alex'] });
  assert.deepEqual(await memoryService.loadMemories(), { firstName: 'Léa', motivations: ['Retrouver mon énergie'], importantPeople: ['Sam'], riskSituations: ['Fatigue'], helpfulStrategies: ['Marcher'], personalNotes: ['Parler à Alex'] });
  await memoryService.saveMemories({ firstName: 'Léa', motivations: ['Dormir mieux'], importantPeople: ['Sam'], riskSituations: ['Soirées'], helpfulStrategies: ['Marcher'], personalNotes: ['Parler à Alex'] });
  assert.deepEqual((await memoryService.loadMemories()).motivations, ['Dormir mieux']); assert.deepEqual((await memoryService.loadMemories()).riskSituations, ['Soirées']);
  await memoryService.saveMemories({ firstName: 'Léa', motivations: [], importantPeople: ['Sam'], riskSituations: ['Soirées'], helpfulStrategies: [], personalNotes: [] });
  assert.deepEqual((await memoryService.loadMemories()).motivations, []); assert.deepEqual((await memoryService.loadMemories()).helpfulStrategies, []); assert.equal(stored.get(privacyKey), privacySettings);
  assert.deepEqual(await memoryService.clearMemories(), memoryService.EMPTY_MEMORIES);
  assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);

  assert.deepEqual(await conversationService.loadConversation(), []);
  assert.equal(await conversationService.addUserMessage('   '), null);
  const firstMessage = await conversationService.addUserMessage(' Test numéro 1 ');
  const secondMessage = await conversationService.addUserMessage('Deuxième message');
  const assistantMessage = await conversationService.addAssistantMessage('Réponse du compagnon');
  assert.equal(firstMessage.role, 'user'); assert.equal(firstMessage.text, 'Test numéro 1'); assert.ok(firstMessage.id); assert.ok(firstMessage.createdAt);
  assert.equal(assistantMessage.role, 'assistant'); assert.deepEqual((await conversationService.loadConversation()).map(({ role }) => role), ['user', 'user', 'assistant']);
  stored.set(conversationService.CONVERSATION_STORAGE_KEY, JSON.stringify({ version: 1, messages: [null, undefined, firstMessage, { text: 'invalide' }] }));
  assert.deepEqual((await conversationService.loadConversation()).map(({ text }) => text), ['Test numéro 1']);
  stored.set(conversationService.CONVERSATION_STORAGE_KEY, '{invalide'); assert.deepEqual(await conversationService.loadConversation(), []);
  stored.set(conversationService.CONVERSATION_STORAGE_KEY, JSON.stringify({ version: 1, messages: [firstMessage, secondMessage] }));
  assert.deepEqual(await conversationService.clearConversation(), []); assert.deepEqual(await conversationService.loadConversation(), []);
  assert.equal(stored.get(privacyKey), privacySettings); assert.deepEqual(await memoryService.loadMemories(), memoryService.EMPTY_MEMORIES);

  const emptyContext = buildAIContext({ events: [], profile: { goal: 'reduce' }, memories: {} });
  assert.equal(emptyContext.goal, 'reduce'); assert.equal(emptyContext.behaviorSummary.consumptionEventCount, 0); assert.equal('recentEvent' in emptyContext, false); assert.deepEqual(buildTalkPreview({ context: emptyContext }), []); assert.equal(hasEnoughBehaviorData(emptyContext), false);
  const events = [
    event('1', 'consumption', '2026-08-19T20:00:00', [target('substance', 'Alcool')], { triggers: ['Fatigue'], emotion: 'Stress' }),
    event('2', 'consumption', '2026-08-20T20:00:00', [target('digital', 'YouTube / vidéos')], { triggers: ['Fatigue'], emotion: 'Stress' }),
    event('3', 'consumption', '2026-08-21T20:00:00', [target('digital', 'YouTube / vidéos'), target('behavior', 'Jeux vidéo')], { triggers: ['Fatigue'], emotion: 'Stress' }),
    event('4', 'craving_resisted', '2026-08-22T20:00:00', [target('behavior', 'Jeux vidéo')], { strategies: ['Sortir marcher'] }),
    event('5', 'craving_resisted', '2026-08-23T20:00:00', [target('behavior', 'Jeux vidéo')], { strategies: ['Sortir marcher'] }),
    event('6', 'craving_resisted', '2026-08-24T20:00:00', [target('digital', 'YouTube / vidéos')], { strategies: ['Sortir marcher'] }),
  ];
  const context = buildAIContext({ events, profile: { goal: 'reduce' }, memories: { firstName: 'Léa', motivations: ['A', 'B'], importantPeople: ['Sam'], riskSituations: ['Fatigue'], helpfulStrategies: ['Marcher'], personalNotes: ['Information volontaire'] } });
  assert.equal(context.behaviorSummary.consumptionEventCount, 3); assert.equal(context.behaviorSummary.resistedEventCount, 3); assert.equal(context.behaviorSummary.topTarget.value, 'YouTube / vidéos'); assert.deepEqual(context.personalContext.importantPeople, ['Sam']); assert.deepEqual(context.personalContext.personalNotes, ['Information volontaire']);
  const preview = buildTalkPreview({ context, goalLabel: 'Réduire' }); assert.ok(preview.includes('Ton objectif : Réduire')); assert.ok(preview.includes('Élément suivi le plus fréquent : YouTube / vidéos')); assert.ok(preview.includes('2 motivations personnelles enregistrées')); assert.ok(preview.includes('1 personne importante enregistrée'));
  assert.ok(preview.includes('Déclencheur fréquent : Fatigue')); assert.ok(preview.includes('Émotion fréquente : Stress')); assert.ok(preview.includes('Moment fréquent : Soir')); assert.ok(preview.includes('Stratégie souvent utilisée : Sortir marcher')); assert.equal(hasEnoughBehaviorData(context), true);
  const sparseContext = buildAIContext({ events: [events[0]], profile: {}, memories: {} }); assert.equal(hasEnoughBehaviorData(sparseContext), false); assert.equal(buildTalkPreview({ context: sparseContext }).some((item) => item.includes('fréquent')), false);
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes('note complète'), false); assert.equal(serialized.includes('Information volontaire'), true); assert.equal(serialized.includes('targets'), false); assert.equal(serialized.includes('2026-08-'), false); assert.equal(serialized.includes('"events"'), false);
  assert.equal(serialized.includes(JSON.stringify(events)), false);
  const memoryScreen = fs.readFileSync('./src/screens/MemoryScreen.js', 'utf8'); assert.ok(memoryScreen.includes('ne sont envoyées à aucun service externe')); assert.ok(memoryScreen.includes('onSave'));
  const talkScreen = fs.readFileSync('./src/screens/TalkScreen.js', 'utf8'); assert.ok(talkScreen.includes('contexte compact sont transmis')); assert.ok(talkScreen.includes('onManageMemory')); assert.ok(talkScreen.includes('Continue à enregistrer quelques situations')); assert.ok(talkScreen.includes('Effacer la conversation')); assert.ok(talkScreen.includes("text: 'Annuler'")); assert.ok(talkScreen.includes('loadConversation')); assert.ok(talkScreen.includes('addUserMessage')); assert.ok(talkScreen.includes('addAssistantMessage')); assert.ok(talkScreen.includes('aiService.sendMessage')); assert.ok(talkScreen.includes('KeyboardAvoidingView')); assert.ok(talkScreen.includes('<FlatList')); assert.ok(talkScreen.includes('scrollToLatest')); assert.ok(talkScreen.includes('Saisie vocale, bientôt disponible')); assert.ok(talkScreen.includes('contextOpen')); assert.equal(talkScreen.includes('<ScrollView'), false);
  const appSource = fs.readFileSync('./App.js', 'utf8'); assert.ok(appSource.includes("setScreen('memory')")); assert.ok(appSource.includes("setScreen('talk')"));
  const sourceFiles = fs.readdirSync('./src', { recursive: true }).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(`./src/${name}`, 'utf8')).join('\n'); assert.equal(/SectionList|VirtualizedList/.test(sourceFiles), false); assert.equal(/&&\s*['"][^'"]+['"]/.test(talkScreen + memoryScreen), false);
  console.log('Mémoire locale et génération de contexte validées.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
