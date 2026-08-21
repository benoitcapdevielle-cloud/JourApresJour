import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeEvents } from '../utils/eventUtils';

export const STORAGE_KEY = 'jourApresJourEventsV2';
export const LEGACY_STORAGE_KEY = 'consumptionEvents';
export const PRIVACY_KEY = 'jourApresJourPrivacyV1';
export const DEFAULT_PRIVACY_SETTINGS = { aiEnabled: false, aiMemoryEnabled: false, aiConsentGivenAt: null };

export async function loadEvents() {
  let savedEvents = await AsyncStorage.getItem(STORAGE_KEY);
  if (!savedEvents) savedEvents = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!await AsyncStorage.getItem(PRIVACY_KEY)) await AsyncStorage.setItem(PRIVACY_KEY, JSON.stringify(DEFAULT_PRIVACY_SETTINGS));
  return savedEvents ? normalizeEvents(JSON.parse(savedEvents)) : [];
}
export const saveEvents = (events) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
export async function clearEvents() { await AsyncStorage.removeItem(STORAGE_KEY); await AsyncStorage.removeItem(LEGACY_STORAGE_KEY); }
