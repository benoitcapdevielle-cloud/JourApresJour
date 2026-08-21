import { SCHEMA_VERSION } from '../constants/trackingOptions';

export function normalizeEvent(event, index) {
  if (Array.isArray(event.substances)) return { ...event, schemaVersion: SCHEMA_VERSION, eventType: event.eventType || 'consumption', triggers: Array.isArray(event.triggers) ? event.triggers : [], strategies: Array.isArray(event.strategies) ? event.strategies : [] };
  return {
    schemaVersion: SCHEMA_VERSION, id: event.id || `${Date.now()}-${index}`, eventType: 'consumption', date: event.date || new Date().toISOString(),
    substances: event.substance ? [{ name: event.substance, quantity: event.quantity !== undefined ? event.quantity : null, unit: event.unit || null }] : [],
    craving: event.craving !== undefined ? event.craving : null, emotion: event.emotion || null, context: event.context || null,
    triggers: Array.isArray(event.triggers) ? event.triggers : [], strategies: [], note: event.note || null,
  };
}
export const normalizeEvents = (events) => Array.isArray(events) ? events.map(normalizeEvent) : [];
export const sortEventsByMostRecent = (events) => [...events].sort((a, b) => new Date(b.date) - new Date(a.date));
