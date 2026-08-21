import AsyncStorage from '@react-native-async-storage/async-storage';

export const MEMORY_STORAGE_KEY = 'jourApresJourMemoriesV1';
export const EMPTY_MEMORIES = Object.freeze({ firstName: '', motivations: [], importantPeople: [], riskSituations: [], helpfulStrategies: [], personalNotes: [] });
const LIST_FIELDS = ['motivations', 'importantPeople', 'riskSituations', 'helpfulStrategies', 'personalNotes'];
const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const cleanList = (value) => Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];

export function normalizeMemories(value) {
  const source = value && typeof value === 'object' ? value : {};
  return LIST_FIELDS.reduce((result, field) => ({ ...result, [field]: cleanList(source[field]) }), { firstName: cleanText(source.firstName) });
}
export async function loadMemories() {
  const saved = await AsyncStorage.getItem(MEMORY_STORAGE_KEY);
  if (!saved) return { ...EMPTY_MEMORIES };
  try { return normalizeMemories(JSON.parse(saved)); } catch { return { ...EMPTY_MEMORIES }; }
}
export async function saveMemories(memories) {
  const normalized = normalizeMemories(memories);
  await AsyncStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
export async function clearMemories() { await AsyncStorage.removeItem(MEMORY_STORAGE_KEY); return { ...EMPTY_MEMORIES }; }
