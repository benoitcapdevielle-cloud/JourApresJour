const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
const PROVIDER_TIMEOUT_MS = 18000;

const SYSTEM_PROMPT = `Tu es le compagnon Jour après Jour.
Réponds avec empathie, sans jugement ni morale.
Ne pose aucun diagnostic et ne fais aucune promesse médicale.
Ne prétends jamais connaître les intentions d'une autre personne.
Distingue clairement les faits, les hypothèses et les interprétations.
Ne conseille jamais d'arrêter ou de modifier un médicament ou un traitement.
Utilise le contexte utilisateur seulement lorsqu'il est pertinent.
N'invente aucun souvenir, événement ou information personnelle.
Si une situation paraît urgente ou dangereuse, encourage à contacter les services d'urgence ou une personne de confiance.`;

class OpenAIProviderError extends Error {
  constructor(code, statusCode = 502) { super(code); this.name = 'OpenAIProviderError'; this.code = code; this.statusCode = statusCode; }
}

const extractReply = (response) => {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  const parts = Array.isArray(response?.output) ? response.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []) : [];
  return parts.filter((part) => part?.type === 'output_text' && typeof part.text === 'string').map((part) => part.text.trim()).filter(Boolean).join('\n');
};

function createOpenAIProvider({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, fetchImpl = globalThis.fetch } = {}) {
  return Object.freeze({
    id: 'openai', model,
    async generate({ message, context }) {
      if (!apiKey) throw new OpenAIProviderError('OPENAI_NOT_CONFIGURED', 503);
      if (typeof fetchImpl !== 'function') throw new OpenAIProviderError('OPENAI_TRANSPORT_UNAVAILABLE');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, instructions: SYSTEM_PROMPT, input: [{ role: 'user', content: [{ type: 'input_text', text: `Contexte utilisateur compact :\n${JSON.stringify(context)}\n\nMessage utilisateur :\n${message}` }] }], max_output_tokens: 500, store: false }),
        });
        if (!response.ok) throw new OpenAIProviderError('OPENAI_REQUEST_FAILED');
        const reply = extractReply(await response.json());
        if (!reply) throw new OpenAIProviderError('OPENAI_EMPTY_RESPONSE');
        return reply;
      } catch (error) {
        if (error instanceof OpenAIProviderError) throw error;
        if (error?.name === 'AbortError') throw new OpenAIProviderError('OPENAI_TIMEOUT', 504);
        throw new OpenAIProviderError('OPENAI_UNAVAILABLE');
      } finally { clearTimeout(timer); }
    },
  });
}

module.exports = { createOpenAIProvider, DEFAULT_OPENAI_MODEL, OpenAIProviderError, SYSTEM_PROMPT };
