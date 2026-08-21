import { resolveModelRoute, AI_TASK_TYPES } from './modelRouter';
import anthropicProvider from './providers/anthropicProvider';
import googleProvider from './providers/googleProvider';
import openaiProvider from './providers/openaiProvider';
import { retrieveScientificContext } from './science/retrievalService';

export const COMPANION_SAFETY_RULES = Object.freeze([
  'Do not diagnose.', 'Do not invent the intentions of third parties.', 'Separate facts, hypotheses, and interpretations.',
  'Do not recommend stopping or changing medication or treatment.', 'Use non-judgmental language.',
  'Be cautious when discussing causality and correlation.', 'Use scientific sources for important scientific claims.',
  'Never invent a scientific source.',
]);

export const DEFAULT_PROVIDER_REGISTRY = Object.freeze({ openai: openaiProvider, anthropic: anthropicProvider, google: googleProvider });

export class AIServiceNotConfiguredError extends Error {
  constructor(taskType) { super(`AI service not configured for task: ${taskType}`); this.name = 'AIServiceNotConfiguredError'; this.code = 'AI_SERVICE_NOT_CONFIGURED'; }
}

const cleanMessages = (messages) => Array.isArray(messages) ? messages.filter((item) => item && typeof item === 'object' && typeof item.text === 'string').map(({ role, text }) => ({ role: role === 'assistant' ? 'assistant' : 'user', text: text.trim() })).filter(({ text }) => text) : [];

export function createAIService({ routeResolver = resolveModelRoute, providers = DEFAULT_PROVIDER_REGISTRY, scientificRetriever = retrieveScientificContext } = {}) {
  return Object.freeze({
    async sendMessage({ message, context = {}, messages = [], taskType = AI_TASK_TYPES.CONVERSATION, tags = [] } = {}) {
      const cleanMessage = typeof message === 'string' ? message.trim() : '';
      if (!cleanMessage) throw new TypeError('A non-empty message is required.');
      const route = routeResolver(taskType);
      if (!route.providerId || !route.modelId) throw new AIServiceNotConfiguredError(taskType);
      const provider = providers?.[route.providerId];
      if (!provider || typeof provider.generate !== 'function') throw new AIServiceNotConfiguredError(taskType);
      const scientificContext = route.useScientificContext ? await scientificRetriever({ query: cleanMessage, tags, limit: 5 }) : [];
      return provider.generate({ messages: [...cleanMessages(messages), { role: 'user', text: cleanMessage }], context, taskType, modelId: route.modelId, scientificContext, safetyRules: COMPANION_SAFETY_RULES });
    },
  });
}

export const aiService = createAIService();
export const sendMessage = (request) => aiService.sendMessage(request);
export default aiService;
