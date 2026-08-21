import { API_TIMEOUT_MS, CHAT_ENDPOINT } from '../../config/apiConfig';
import { normalizeEventExtraction } from '../eventExtraction';

export class BackendProviderError extends Error {
  constructor(code) { super(code); this.name = 'BackendProviderError'; this.code = code; }
}

export function createBackendProvider({ fetchImpl = globalThis.fetch, endpoint = CHAT_ENDPOINT, timeoutMs = API_TIMEOUT_MS } = {}) {
  return Object.freeze({
    id: 'openai',
    async generate({ messages, context, pendingConversationEvent = null, activeRecentEvent = null, recentEventCandidates = [], activeSafetyContext = null }) {
      const reversedMessageIndex = Array.isArray(messages) ? [...messages].reverse().findIndex((item) => item?.role === 'user' && typeof item.text === 'string') : -1;
      const messageIndex = reversedMessageIndex < 0 ? -1 : messages.length - 1 - reversedMessageIndex;
      const message = messageIndex >= 0 ? messages[messageIndex].text.trim() : '';
      if (!message) throw new BackendProviderError('INVALID_MESSAGE');
      if (typeof fetchImpl !== 'function') throw new BackendProviderError('BACKEND_UNAVAILABLE');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const recentMessages = Array.isArray(messages) ? messages.filter((_, index) => index !== messageIndex).slice(-7).map(({ role, text }) => ({ role, text })) : [];
        const response = await fetchImpl(endpoint, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, context, recentMessages, pendingConversationEvent, activeRecentEvent, activeSafetyContext, recentEventCandidates: Array.isArray(recentEventCandidates) ? recentEventCandidates.slice(0, 3) : [] }) });
        if (!response.ok) throw new BackendProviderError(response.status === 503 ? 'BACKEND_NOT_CONFIGURED' : 'BACKEND_ERROR');
        const payload = await response.json();
        const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
        if (!reply) throw new BackendProviderError('EMPTY_REPLY');
        return { reply, eventSuggestion: normalizeEventExtraction(payload?.eventSuggestion), eventEnrichment: payload?.eventEnrichment || null, detectedConversationEvent: normalizeEventExtraction(payload?.detectedConversationEvent), safety: payload?.safety || null };
      } catch (error) {
        if (error instanceof BackendProviderError) throw error;
        if (error?.name === 'AbortError') throw new BackendProviderError('BACKEND_TIMEOUT');
        throw new BackendProviderError('BACKEND_UNAVAILABLE');
      } finally { clearTimeout(timer); }
    },
  });
}

export const openaiProvider = createBackendProvider();
export default openaiProvider;
