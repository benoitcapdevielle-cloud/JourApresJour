const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');
const originalExtension = Module._extensions['.js'];
Module._extensions['.js'] = (loaded, filename) => { if (!filename.includes('src')) return originalExtension(loaded, filename); const source = fs.readFileSync(filename, 'utf8'); const code = babel.transformSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code; loaded._compile(code, filename); };
const storage = new Map(); const originalLoad = Module._load;
Module._load = function (request, parent, isMain) { if (request === '@react-native-async-storage/async-storage') return { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value), removeItem: async (key) => storage.delete(key) }; return originalLoad.call(this, request, parent, isMain); };

const { SCHEMA_VERSION, findTargetConfig } = require('../src/constants/trackingOptions');
const { getEventTargets, normalizeEvent, normalizeEvents, sortEventsByMostRecent } = require('../src/utils/eventUtils');
const { formatTargetMeasurements } = require('../src/utils/targetUtils');
const { buildBehaviorSummary } = require('../src/utils/behaviorAnalysis');
const storageService = require('../src/services/storageService');
const target = (category, type, measurement) => ({ category, type, measurement: { ...measurement, source: 'manual' } });
const event = (id, eventType, targets) => ({ id, eventType, targets, date: `2026-08-${String(10 + Number(id)).padStart(2, '0')}T12:00:00`, craving: 5, triggers: ['Fatigue'], strategies: eventType === 'craving_resisted' ? ['Sortir marcher'] : [] });

(async () => {
  const oldAlcohol = { id: 'old', date: '2026-08-10T12:00:00', substances: [{ name: 'Alcool', quantity: 3, unit: 'verre(s)' }], craving: 6 };
  assert.deepEqual(getEventTargets(null), []); assert.deepEqual(getEventTargets(undefined), []); assert.deepEqual(getEventTargets('invalide'), []);
  const migrated = normalizeEvent(oldAlcohol, 0); assert.equal(migrated.schemaVersion, SCHEMA_VERSION); assert.equal('substances' in migrated, false);
  assert.deepEqual(migrated.targets[0], target('substance', 'Alcool', { quantity: 3, unit: 'verre(s)' }));
  const editedLegacy = normalizeEvent({ ...migrated, craving: 7, targets: [target('substance', 'Alcool', { quantity: 4, unit: 'verre(s)' })] }); assert.equal(editedLegacy.id, 'old'); assert.equal(editedLegacy.targets[0].measurement.quantity, 4);
  const legacySingle = normalizeEvent({ substance: 'Alcool', quantity: 2, unit: 'verre(s)' }, 1); assert.equal(legacySingle.targets[0].type, 'Alcool');

  const alcohol = target('substance', 'Alcool', { quantity: 2, unit: 'verre(s)' }); const cocaine = target('substance', 'Cocaïne', { quantity: 1, unit: 'prise(s)' });
  const youtube = target('digital', 'YouTube / vidéos', { durationMinutes: 155 }); const instagram = target('digital', 'Instagram', { durationMinutes: 45 });
  const gaming = target('behavior', 'Jeux vidéo', { durationMinutes: 250 }); const gambling = target('behavior', 'Jeux d’argent / paris', { durationMinutes: 80, moneySpent: 75 });
  const work = target('behavior', 'Travail', { durationMinutes: 180 });
  assert.deepEqual(formatTargetMeasurements(alcohol), ['2 verres']); assert.deepEqual(formatTargetMeasurements(youtube), ['2 h 35 min']); assert.deepEqual(formatTargetMeasurements(gambling), ['1 h 20 min', '75 € dépensés']);
  assert.equal(findTargetConfig('digital', 'YouTube / vidéos').measurements[0].key, 'durationMinutes'); assert.equal(findTargetConfig('behavior', 'Travail').measurements[0].key, 'durationMinutes');

  const events = [event('1', 'consumption', [alcohol]), event('2', 'consumption', [alcohol, cocaine]), event('3', 'consumption', [youtube]), event('4', 'consumption', [gaming]), event('5', 'consumption', [gambling]), event('6', 'consumption', [work]), event('7', 'consumption', [youtube, instagram]), event('8', 'craving_resisted', [youtube])];
  const mixedEvents = [null, undefined, events[0]]; const normalizedMixed = normalizeEvents(mixedEvents); assert.equal(normalizedMixed.length, 1); assert.equal(normalizedMixed[0].id, '1'); assert.equal(sortEventsByMostRecent(mixedEvents).length, 1);
  const summary = buildBehaviorSummary(events, new Date('2026-08-25T12:00:00')); assert.equal(summary.topTarget.value, 'YouTube / vidéos'); assert.equal(summary.topSubstance.value, 'Alcool'); assert.equal(summary.polyConsumptionRate, 50); assert.equal(summary.multiTargetRate, 29); assert.equal(summary.averageConsumptionCraving, 5); assert.equal(summary.topResistedStrategy.value, 'Sortir marcher');
  const mixedSummary = buildBehaviorSummary(mixedEvents, new Date('2026-08-25T12:00:00')); assert.equal(mixedSummary.consumptionEventCount, 1); assert.equal(mixedSummary.topTarget.value, 'Alcool');

  storage.set(storageService.LEGACY_STORAGE_KEY, JSON.stringify([oldAlcohol])); const loaded = await storageService.loadEvents(); assert.equal(loaded[0].targets[0].type, 'Alcool');
  await storageService.saveEvents(normalizeEvents(events)); const persisted = JSON.parse(storage.get(storageService.STORAGE_KEY)); assert.equal(persisted[2].targets[0].measurement.source, 'manual');
  await storageService.clearEvents(); assert.equal(await storageService.loadEvents().then((items) => items.length), 0);
  const mixedStoredValue = JSON.stringify([null, undefined, events[0]]); storage.set(storageService.STORAGE_KEY, mixedStoredValue); const loadedMixed = await storageService.loadEvents(); assert.equal(loadedMixed.length, 1); assert.equal(loadedMixed[0].id, '1'); assert.equal(storage.get(storageService.STORAGE_KEY), mixedStoredValue);
  console.log('Migration, targets, mesures, historique et analyses validés.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
