const { createOpenAIProvider } = require('./providers/openaiProvider');
const { getEmergencyResources } = require('../safety/emergencyResources');
const { buildSafetyDetectedEvent, enforceSafetyReply, evaluateSafety, normalizeSafetyContext } = require('../safety/safetyService');

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanRecentMessages = (value) => Array.isArray(value) ? value.slice(-8).map((item) => ({
  role: item?.role === 'assistant' ? 'assistant' : 'user',
  text: typeof item?.text === 'string' ? item.text.trim().slice(0, 2000) : '',
})).filter(({ text }) => text) : [];

function createBackendAiService({ provider = createOpenAIProvider(), countryCode = process.env.APP_DEFAULT_COUNTRY || 'FR', now = () => new Date() } = {}) {
  const emergencyResources = getEmergencyResources(countryCode);
  return Object.freeze({
    async sendMessage({ message, context, recentMessages = [], pendingConversationEvent = null, activeRecentEvent = null, recentEventCandidates = [], activeSafetyContext = null }) {
      const cleanMessage = typeof message === 'string' ? message.trim() : '';
      if (!cleanMessage || cleanMessage.length > 4000) { const error = new Error('INVALID_MESSAGE'); error.code = 'INVALID_MESSAGE'; error.statusCode = 400; throw error; }
      if (!isPlainObject(context)) { const error = new Error('INVALID_CONTEXT'); error.code = 'INVALID_CONTEXT'; error.statusCode = 400; throw error; }
      if (pendingConversationEvent !== null && !isPlainObject(pendingConversationEvent)) { const error = new Error('INVALID_PENDING_EVENT'); error.code = 'INVALID_PENDING_EVENT'; error.statusCode = 400; throw error; }
      if (activeRecentEvent !== null && !isPlainObject(activeRecentEvent)) { const error = new Error('INVALID_ACTIVE_EVENT'); error.code = 'INVALID_ACTIVE_EVENT'; error.statusCode = 400; throw error; }
      if (activeSafetyContext !== null && !normalizeSafetyContext(activeSafetyContext)) { const error = new Error('INVALID_SAFETY_CONTEXT'); error.code = 'INVALID_SAFETY_CONTEXT'; error.statusCode = 400; throw error; }
      if (!Array.isArray(recentEventCandidates) || recentEventCandidates.some((event) => !isPlainObject(event))) { const error = new Error('INVALID_EVENT_CANDIDATES'); error.code = 'INVALID_EVENT_CANDIDATES'; error.statusCode = 400; throw error; }
      if (JSON.stringify(context).length > 50000) { const error = new Error('CONTEXT_TOO_LARGE'); error.code = 'CONTEXT_TOO_LARGE'; error.statusCode = 413; throw error; }
      const cleanedMessages = cleanRecentMessages(recentMessages);
      const candidates = recentEventCandidates.slice(0, 3);
      if (JSON.stringify(cleanedMessages).length > 18000 || JSON.stringify(pendingConversationEvent).length > 12000 || JSON.stringify(activeRecentEvent).length > 12000 || JSON.stringify(candidates).length > 24000) { const error = new Error('CONVERSATION_STATE_TOO_LARGE'); error.code = 'CONVERSATION_STATE_TOO_LARGE'; error.statusCode = 413; throw error; }
      const safety = evaluateSafety({ message: cleanMessage, activeSafetyContext, relatedEventId: activeRecentEvent?.id || null, now: now() });
      const safetyDetectedEvent = buildSafetyDetectedEvent(cleanMessage, now());
      let result;
      try { result = await provider.generate({ message: cleanMessage, context, recentMessages: cleanedMessages, pendingConversationEvent, activeRecentEvent, recentEventCandidates: candidates, activeSafetyContext: safety }); }
      catch (error) {
        if (!safety.mustFollowUp) throw error;
        return { reply: enforceSafetyReply({ reply: '', safety, message: cleanMessage, resources: emergencyResources }), eventSuggestion: null, eventEnrichment: null, detectedConversationEvent: safetyDetectedEvent, safety };
      }
      const reply = typeof result === 'string' ? result : result?.reply;
      if (typeof reply !== 'string' || !reply.trim()) { const error = new Error('EMPTY_REPLY'); error.code = 'EMPTY_REPLY'; error.statusCode = 502; throw error; }
      const providerSuggestion = result && typeof result === 'object' ? result.eventSuggestion || null : null;
      const critical = safety.active && (safety.level === 'urgent' || safety.level === 'emergency');
      return { reply: enforceSafetyReply({ reply, safety, message: cleanMessage, resources: emergencyResources }), eventSuggestion: critical ? null : providerSuggestion, eventEnrichment: critical ? null : result && typeof result === 'object' ? result.eventEnrichment || null : null, detectedConversationEvent: providerSuggestion || safetyDetectedEvent, safety };
    },
  });
}

module.exports = { createBackendAiService };
