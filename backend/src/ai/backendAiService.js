const { createOpenAIProvider } = require('./providers/openaiProvider');

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function createBackendAiService({ provider = createOpenAIProvider() } = {}) {
  return Object.freeze({
    async sendMessage({ message, context }) {
      const cleanMessage = typeof message === 'string' ? message.trim() : '';
      if (!cleanMessage || cleanMessage.length > 4000) { const error = new Error('INVALID_MESSAGE'); error.code = 'INVALID_MESSAGE'; error.statusCode = 400; throw error; }
      if (!isPlainObject(context)) { const error = new Error('INVALID_CONTEXT'); error.code = 'INVALID_CONTEXT'; error.statusCode = 400; throw error; }
      if (JSON.stringify(context).length > 50000) { const error = new Error('CONTEXT_TOO_LARGE'); error.code = 'CONTEXT_TOO_LARGE'; error.statusCode = 413; throw error; }
      const reply = await provider.generate({ message: cleanMessage, context });
      if (typeof reply !== 'string' || !reply.trim()) { const error = new Error('EMPTY_REPLY'); error.code = 'EMPTY_REPLY'; error.statusCode = 502; throw error; }
      return { reply: reply.trim() };
    },
  });
}

module.exports = { createBackendAiService };
