import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeEvent, normalizeEvents } from '../utils/eventUtils';

export const STORAGE_KEY = 'jourApresJourEventsV2';
export const LEGACY_STORAGE_KEY = 'consumptionEvents';
export const PRIVACY_KEY = 'jourApresJourPrivacyV1';
export const DEFAULT_PRIVACY_SETTINGS = { aiEnabled: false, aiMemoryEnabled: false, aiConsentGivenAt: null };
let eventWriteQueue = Promise.resolve();

const debugEventStorage = (message, details) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.log(`[TRACK] storage ${message}`, details);
};

const readStoredEvents = async () => {
  let savedEvents = await AsyncStorage.getItem(STORAGE_KEY);
  if (!savedEvents) savedEvents = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!savedEvents) return [];
  try { return normalizeEvents(JSON.parse(savedEvents)); } catch { return []; }
};

const enqueueEventWrite = (operation) => {
  const next = eventWriteQueue.then(operation, operation);
  eventWriteQueue = next.catch(() => {});
  return next;
};

export async function loadEvents() {
  if (!await AsyncStorage.getItem(PRIVACY_KEY)) await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(DEFAULT_PRIVACY_SETTINGS));
  return readStoredEvents();
}
export const saveEvents = (events) => enqueueEventWrite(async () => {
  const normalized = normalizeEvents(events);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  debugEventStorage('saved', { count: normalized.length });
  return normalized;
});

export const upsertTrackerEvent = (event) => enqueueEventWrite(async () => {
  const normalizedEvent = normalizeEvent(event);
  if (!normalizedEvent) throw new TypeError('INVALID_EVENT');
  const current = await readStoredEvents();
  const exists = current.some(({ id }) => id === normalizedEvent.id);
  const next = normalizeEvents(exists ? current.map((item) => item.id === normalizedEvent.id ? normalizedEvent : item) : [...current, normalizedEvent]);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  const reloaded = await readStoredEvents();
  if (reloaded.length !== next.length || !reloaded.some(({ id }) => id === normalizedEvent.id)) throw new Error('EVENT_UPSERT_PERSISTENCE_FAILED');
  debugEventStorage(exists ? 'updated' : 'added', { operation: exists ? 'UPDATE' : 'CREATE', id: normalizedEvent.id, targets: normalizedEvent.targets.length, countBefore: current.length, countAfter: reloaded.length });
  return reloaded;
});

export async function clearEvents() { await AsyncStorage.removeItem(STORAGE_KEY); await AsyncStorage.removeItem(LEGACY_STORAGE_KEY); }
