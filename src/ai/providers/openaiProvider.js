import { API_TIMEOUT_MS, CHAT_ENDPOINT } from '../../config/apiConfig';

export class BackendProviderError extends Error {
  constructor(code) { super(code); this.name = 'BackendProviderError'; this.code = code; }
}

export function createBackendProvider({ fetchImpl = globalThis.fetch, endpoint = CHAT_ENDPOINT, timeoutMs = API_TIMEOUT_MS } = {}) {
  return Object.freeze({
    id: 'openai',
    async generate({ messages, context }) {
      const message = Array.isArray(messages) ? [...messages].reverse().find((item) => item?.role === 'user' && typeof item.text === 'string')?.text?.trim() : '';
      if (!message) throw new BackendProviderError('INVALID_MESSAGE');
      if (typeof fetchImpl !== 'function') throw new BackendProviderError('BACKEND_UNAVAILABLE');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, context }) });
        if (!response.ok) throw new BackendProviderError(response.status === 503 ? 'BACKEND_NOT_CONFIGURED' : 'BACKEND_ERROR');
        const payload = await response.json();
        const reply = typeof payload?.reply === 'string' ? payload.reply.trim() : '';
        if (!reply) throw new BackendProviderError('EMPTY_REPLY');
        return reply;
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
