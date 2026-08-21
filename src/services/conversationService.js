import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONVERSATION_STORAGE_KEY = 'jourApresJourConversationV1';
export const CONVERSATION_STORAGE_VERSION = 1;

let writeQueue = Promise.resolve();

const cleanMessage = (message) => {
  if (!message || typeof message !== 'object') return null;
  const id = typeof message.id === 'string' ? message.id.trim() : '';
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const createdAt = typeof message.createdAt === 'string' ? message.createdAt : '';
  if (!id || !text || message.role !== 'user' || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return { id, role: 'user', text, createdAt };
};

export function normalizeConversation(value) {
  const source = Array.isArray(value) ? value : value && typeof value === 'object' ? value.messages : [];
  if (!Array.isArray(source)) return [];
  return source.map(cleanMessage).filter(Boolean).sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

export async function loadConversation() {
  const saved = await AsyncStorage.getItem(CONVERSATION_STORAGE_KEY);
  if (!saved) return [];
  try { return normalizeConversation(JSON.parse(saved)); } catch { return []; }
}

const saveConversation = async (messages) => {
  const normalized = normalizeConversation(messages);
  await AsyncStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify({ version: CONVERSATION_STORAGE_VERSION, messages: normalized }));
  return normalized;
};

const enqueueWrite = (operation) => {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => {});
  return next;
};

const createMessage = (text) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  role: 'user',
  text: text.trim(),
  createdAt: new Date().toISOString(),
});

export function addUserMessage(text) {
  const cleanedText = typeof text === 'string' ? text.trim() : '';
  if (!cleanedText) return Promise.resolve(null);
  return enqueueWrite(async () => {
    const current = await loadConversation();
    const message = createMessage(cleanedText);
    await saveConversation([...current, message]);
    return message;
  });
}

export function clearConversation() {
  return enqueueWrite(async () => {
    await AsyncStorage.removeItem(CONVERSATION_STORAGE_KEY);
    return [];
  });
}
