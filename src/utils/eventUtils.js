import { SCHEMA_VERSION } from '../constants/trackingOptions';
const finiteOrNull = (value) => value === null || value === '' || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export function substanceToTarget(substance = {}) { const safeSubstance = isObject(substance) ? substance : {}; return { category: 'substance', type: safeSubstance.name || 'Autre substance', measurement: { quantity: finiteOrNull(safeSubstance.quantity), unit: safeSubstance.unit || null, source: 'manual' } }; }
export function normalizeTarget(target = {}) {
  const safeTarget = isObject(target) ? target : {}; const measurement = isObject(safeTarget.measurement) ? safeTarget.measurement : {};
  return { category: safeTarget.category || 'behavior', type: safeTarget.type || safeTarget.name || 'Autre comportement', measurement: {
    ...(finiteOrNull(measurement.quantity) !== null ? { quantity: finiteOrNull(measurement.quantity) } : {}), ...(measurement.unit ? { unit: measurement.unit } : {}),
    ...(finiteOrNull(measurement.durationMinutes) !== null ? { durationMinutes: finiteOrNull(measurement.durationMinutes) } : {}), ...(finiteOrNull(measurement.episodes) !== null ? { episodes: finiteOrNull(measurement.episodes) } : {}),
    ...(finiteOrNull(measurement.moneySpent) !== null ? { moneySpent: finiteOrNull(measurement.moneySpent) } : {}), source: measurement.source === 'device_usage' ? 'device_usage' : 'manual',
  } };
}
export function getEventTargets(event = {}) {
  if (!isObject(event)) return [];
  if (Array.isArray(event.targets)) return event.targets.filter(isObject).map(normalizeTarget);
  if (Array.isArray(event.substances)) return event.substances.filter(isObject).map(substanceToTarget);
  if (event.substance) return [substanceToTarget({ name: event.substance, quantity: event.quantity, unit: event.unit })];
  return [];
}
export function normalizeEvent(event, index = 0) { if (!isObject(event)) return null; const normalized = { ...event, schemaVersion: SCHEMA_VERSION, id: event.id || `${Date.now()}-${index}`, eventType: event.eventType || 'consumption', date: event.date || new Date().toISOString(), targets: getEventTargets(event), craving: event.craving !== undefined ? event.craving : null, emotion: event.emotion || null, context: event.context || null, triggers: Array.isArray(event.triggers) ? event.triggers : [], strategies: Array.isArray(event.strategies) ? event.strategies : [], note: event.note || null }; delete normalized.substances; delete normalized.substance; delete normalized.quantity; delete normalized.unit; return normalized; }
export const normalizeEvents = (events) => Array.isArray(events) ? events.map(normalizeEvent).filter(Boolean) : [];
export const sortEventsByMostRecent = (events) => (Array.isArray(events) ? events : []).filter(isObject).sort((a, b) => new Date(b.date) - new Date(a.date));
