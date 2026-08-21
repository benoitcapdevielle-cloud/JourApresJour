import AsyncStorage from '@react-native-async-storage/async-storage';

export const PERSONAL_LEXICON_STORAGE_KEY = 'jourApresJourPersonalLexiconV1';
export const PERSONAL_LEXICON_VERSION = 1;
export const LEXICON_SOURCES = Object.freeze({ USER_CONFIRMED: 'user_confirmed' });

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const expression = cleanText(entry.expression);
  const meaning = cleanText(entry.meaning);
  if (!expression || !meaning || entry.source !== LEXICON_SOURCES.USER_CONFIRMED) return null;
  const now = new Date().toISOString();
  return {
    id: cleanText(entry.id) || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    expression,
    meaning,
    source: LEXICON_SOURCES.USER_CONFIRMED,
    createdAt: !Number.isNaN(Date.parse(entry.createdAt)) ? entry.createdAt : now,
    updatedAt: !Number.isNaN(Date.parse(entry.updatedAt)) ? entry.updatedAt : now,
  };
};

export const normalizePersonalLexicon = (value) => {
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? value.entries : [];
  if (!Array.isArray(entries)) return [];
  const unique = new Map();
  entries.map(normalizeEntry).filter(Boolean).forEach((entry) => unique.set(entry.expression.toLocaleLowerCase('fr-FR'), entry));
  return [...unique.values()];
};

export async function loadPersonalLexicon() {
  const saved = await AsyncStorage.getItem(PERSONAL_LEXICON_STORAGE_KEY);
  if (!saved) return [];
  try { return normalizePersonalLexicon(JSON.parse(saved)); } catch { return []; }
}

const savePersonalLexicon = async (entries) => {
  const normalized = normalizePersonalLexicon(entries);
  await AsyncStorage.setItem(PERSONAL_LEXICON_STORAGE_KEY, JSON.stringify({ version: PERSONAL_LEXICON_VERSION, entries: normalized }));
  return normalized;
};

export async function addUserConfirmedExpression({ expression, meaning }) {
  const candidate = normalizeEntry({ expression, meaning, source: LEXICON_SOURCES.USER_CONFIRMED });
  if (!candidate) throw new TypeError('A confirmed expression and meaning are required.');
  const current = await loadPersonalLexicon();
  const existing = current.find((entry) => entry.expression.toLocaleLowerCase('fr-FR') === candidate.expression.toLocaleLowerCase('fr-FR'));
  const next = existing
    ? current.map((entry) => entry.id === existing.id ? { ...entry, meaning: candidate.meaning, updatedAt: new Date().toISOString() } : entry)
    : [...current, candidate];
  return savePersonalLexicon(next);
}

export async function removePersonalLexiconEntry(id) {
  const cleanId = cleanText(id);
  const current = await loadPersonalLexicon();
  return savePersonalLexicon(current.filter((entry) => entry.id !== cleanId));
}

export async function updateUserConfirmedExpression(id, { expression, meaning }) {
  const cleanId = cleanText(id);
  const candidate = normalizeEntry({ id: cleanId, expression, meaning, source: LEXICON_SOURCES.USER_CONFIRMED });
  if (!cleanId || !candidate) throw new TypeError('A confirmed lexicon entry is required.');
  const current = await loadPersonalLexicon();
  if (!current.some((entry) => entry.id === cleanId)) throw new Error('LEXICON_ENTRY_NOT_FOUND');
  return savePersonalLexicon(current.map((entry) => entry.id === cleanId ? { ...candidate, createdAt: entry.createdAt, updatedAt: new Date().toISOString() } : entry));
}

export const findConfirmedLexiconMatches = (text, entries) => {
  const source = cleanText(text).toLocaleLowerCase('fr-FR');
  if (!source) return [];
  return normalizePersonalLexicon(entries).filter(({ expression }) => source.includes(expression.toLocaleLowerCase('fr-FR')));
};
