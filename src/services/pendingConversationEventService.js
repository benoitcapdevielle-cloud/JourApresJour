import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeEventExtraction } from '../ai/eventExtraction';

export const PENDING_CONVERSATION_EVENT_KEY = 'jourApresJourPendingConversationEventV1';
export const ACTIVE_CONVERSATION_EVENT_KEY = 'jourApresJourActiveConversationEventV1';
const ACTIVE_EVENT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export async function loadPendingConversationEvent() {
  const saved = await AsyncStorage.getItem(PENDING_CONVERSATION_EVENT_KEY);
  if (!saved) return null;
  try { return normalizeEventExtraction(JSON.parse(saved)); } catch { return null; }
}

export async function savePendingConversationEvent(value) {
  const normalized = normalizeEventExtraction(value);
  if (!normalized?.detected) {
    await AsyncStorage.removeItem(PENDING_CONVERSATION_EVENT_KEY);
    return null;
  }
  const persisted = { ...normalized, conversationEventId: normalized.conversationEventId || `pending-${Date.now()}`, trackingStatus: normalized.trackingStatus || 'unconfirmed', source: 'conversation_pending' };
  await AsyncStorage.setItem(PENDING_CONVERSATION_EVENT_KEY, JSON.stringify(persisted));
  return persisted;
}

export async function clearPendingConversationEvent() {
  await AsyncStorage.removeItem(PENDING_CONVERSATION_EVENT_KEY);
  return null;
}

export async function loadActiveConversationEventId() {
  const saved = await AsyncStorage.getItem(ACTIVE_CONVERSATION_EVENT_KEY);
  if (!saved) return null;
  try {
    const value = JSON.parse(saved);
    if (!value?.touchedAt || Number.isNaN(Date.parse(value.touchedAt)) || Date.now() - Date.parse(value.touchedAt) > ACTIVE_EVENT_MAX_AGE_MS) return null;
    return typeof value?.eventId === 'string' && value.eventId.trim() ? value.eventId.trim() : null;
  } catch { return null; }
}

export async function saveActiveConversationEventId(eventId) {
  const cleanId = typeof eventId === 'string' ? eventId.trim() : '';
  if (!cleanId) return null;
  await AsyncStorage.setItem(ACTIVE_CONVERSATION_EVENT_KEY, JSON.stringify({ eventId: cleanId, touchedAt: new Date().toISOString() }));
  return cleanId;
}

export async function clearActiveConversationEventId() {
  await AsyncStorage.removeItem(ACTIVE_CONVERSATION_EVENT_KEY);
}
