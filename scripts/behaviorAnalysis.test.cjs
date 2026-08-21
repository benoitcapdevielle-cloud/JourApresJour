const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');

function loadModule(path) {
  const source = fs.readFileSync(path, 'utf8');
  const code = babel.transformSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  const loaded = new Module(path, module); loaded.filename = path; loaded.paths = module.paths; loaded._compile(code, path); return loaded.exports;
}
const { buildAntiZeroStats, buildBehaviorSummary, getTimePeriod } = loadModule('./src/utils/behaviorAnalysis.js');
const now = new Date('2026-08-21T12:00:00');
const event = (id, type, date, extra = {}) => ({ id, eventType: type, date, craving: 5, substances: [], triggers: [], strategies: [], ...extra });

assert.deepEqual(buildAntiZeroStats([], now), { masteredDays7d: 7, masteredDays30d: 30, resistedCount30d: 0, consumptionCount7d: 0, previousConsumptionCount7d: 0, consumptionDifference7d: 0, evolutionText: 'Fréquence stable par rapport à la semaine précédente' });
const events = [
  event('1', 'consumption', '2026-08-20T08:00:00', { craving: 7, substances: [{ name: 'Alcool' }], triggers: ['Fatigue'], emotion: 'Stress', context: 'Seul' }),
  event('2', 'consumption', '2026-08-20T20:00:00', { craving: 8, substances: [{ name: 'Alcool' }, { name: 'Cannabis' }], triggers: ['Fatigue'], emotion: 'Stress', context: 'Seul' }),
  event('3', 'consumption', '2026-08-19T20:00:00', { craving: 7, substances: [{ name: 'Alcool' }], triggers: ['Fatigue'], emotion: 'Stress', context: 'Seul' }),
  event('4', 'craving_resisted', '2026-08-18T14:00:00', { craving: 8, strategies: ['Sortir marcher'] }),
  event('5', 'craving_resisted', '2026-08-17T14:00:00', { craving: 6, strategies: ['Sortir marcher'] }),
  event('6', 'craving_resisted', '2026-08-16T14:00:00', { craving: 7, strategies: ['Respirer'] }),
];
const stats = buildAntiZeroStats(events, now); assert.equal(stats.masteredDays7d, 5); assert.equal(stats.consumptionCount7d, 3); assert.equal(stats.resistedCount30d, 3);
const summary = buildBehaviorSummary(events, now); assert.equal(summary.averageConsumptionCraving, 7.3); assert.equal(summary.averageResistedCraving, 7); assert.equal(summary.topSubstance.value, 'Alcool'); assert.equal(summary.topTrigger.value, 'Fatigue'); assert.equal(summary.topTimePeriod.value, 'Soir'); assert.equal(summary.polyConsumptionRate, 33); assert.equal(summary.topResistedStrategy.value, 'Sortir marcher');
assert.equal(getTimePeriod('2026-08-21T05:00:00'), 'Matin'); assert.equal(getTimePeriod('2026-08-21T12:00:00'), 'Midi / après-midi'); assert.equal(getTimePeriod('2026-08-21T18:00:00'), 'Soir'); assert.equal(getTimePeriod('2026-08-21T23:00:00'), 'Nuit');

const memory = new Map(); const originalLoad = Module._load;
Module._load = function (request, parent, isMain) { if (request === '@react-native-async-storage/async-storage') return { getItem: async (key) => memory.get(key) ?? null, setItem: async (key, value) => memory.set(key, value) }; return originalLoad.call(this, request, parent, isMain); };
const { loadProfile, saveGoal } = loadModule('./src/services/profileService.js');
(async () => { assert.equal((await loadProfile()).goal, null); await saveGoal('reduce'); assert.equal((await loadProfile()).goal, 'reduce'); await saveGoal('understand'); assert.equal((await loadProfile()).goal, 'understand'); console.log('Tous les scénarios comportement et objectif sont validés.'); })().catch((error) => { console.error(error); process.exitCode = 1; });
