import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVE_SAFETY_CONTEXT_KEY = 'jourApresJourActiveSafetyContextV1';
const LEVELS = ['normal', 'concern', 'urgent', 'emergency'];

export function normalizeSafetyContext(value) {
  if (!value || typeof value !== 'object' || !LEVELS.includes(value.level)) return null;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null,
    level: value.level,
    currentLevel: LEVELS.includes(value.currentLevel) ? value.currentLevel : value.level,
    effectiveLevel: LEVELS.includes(value.effectiveLevel) ? value.effectiveLevel : value.level,
    mustFollowUp: value.mustFollowUp === true,
    followUpType: value.followUpType === 'safety_check' ? 'safety_check' : null,
    active: value.active === true,
    relatedEventId: typeof value.relatedEventId === 'string' && value.relatedEventId.trim() ? value.relatedEventId.trim() : null,
    exitReason: typeof value.exitReason === 'string' && value.exitReason.trim() ? value.exitReason.trim() : null,
    resolved: value.resolved === true,
    relatedConversationEventId: typeof value.relatedConversationEventId === 'string' && value.relatedConversationEventId.trim() ? value.relatedConversationEventId.trim() : null,
    reason: typeof value.reason === 'string' && value.reason.trim() ? value.reason.trim() : null,
    quantity: Number.isFinite(Number(value.quantity)) ? Number(value.quantity) : null,
    startedAt: typeof value.startedAt === 'string' && !Number.isNaN(Date.parse(value.startedAt)) ? new Date(value.startedAt).toISOString() : null,
  };
}

export async function loadActiveSafetyContext() {
  const saved = await AsyncStorage.getItem(ACTIVE_SAFETY_CONTEXT_KEY);
  if (!saved) return null;
  try { return normalizeSafetyContext(JSON.parse(saved)); } catch { return null; }
}

export async function saveActiveSafetyContext(value) {
  const normalized = normalizeSafetyContext(value);
  if (!normalized || (!normalized.active && !normalized.exitReason)) { await AsyncStorage.removeItem(ACTIVE_SAFETY_CONTEXT_KEY); return null; }
  await AsyncStorage.setItem(ACTIVE_SAFETY_CONTEXT_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function clearActiveSafetyContext() {
  await AsyncStorage.removeItem(ACTIVE_SAFETY_CONTEXT_KEY);
}
