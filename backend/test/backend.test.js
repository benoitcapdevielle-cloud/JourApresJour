const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../server');
const { createBackendAiService } = require('../src/ai/backendAiService');
const { createOpenAIProvider, DEFAULT_OPENAI_MODEL, preventFalseTrackingConfirmation, SYSTEM_PROMPT, PSYCHOLOGICAL_SUPPORT_PROMPT } = require('../src/ai/providers/openaiProvider');
const { buildEmergencyInstructions, getEmergencyResources } = require('../src/safety/emergencyResources');
const { buildSafetyDetectedEvent, evaluateSafety } = require('../src/safety/safetyService');
const projectRoot = path.resolve(__dirname, '..', '..');

const withServer = async (aiService, test) => {
  const server = createServer({ aiService }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await test(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); await once(server, 'close'); }
};

(async () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.4-mini');
  assert.deepEqual(getEmergencyResources('fr'), { countryCode: 'FR', countryName: 'France', medicalEmergency: '15', generalEmergency: '112', accessibleEmergency: '114', sourceUrl: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33954' });
  assert.equal(getEmergencyResources('XX'), null);
  assert.match(buildEmergencyInstructions(null), /N'invente jamais de numéro/);
  const safetyNow = new Date('2026-08-21T20:00:00.000Z');
  const firstSafety = evaluateSafety({ message: 'Je viens de prendre 14 taz.', now: safetyNow });
  assert.equal(firstSafety.level, 'emergency'); assert.equal(firstSafety.mustFollowUp, true); assert.equal(firstSafety.active, true);
  assert.equal(buildSafetyDetectedEvent('Je viens de prendre 14 taz.', safetyNow).targets[0].measurement.quantity, 14);
  const safetyProvider = { generate: async () => ({ reply: 'D’accord.', eventSuggestion: null, eventEnrichment: null }) };
  const safetyService = createBackendAiService({ provider: safetyProvider, now: () => safetyNow });
  const firstEmergencyReply = await safetyService.sendMessage({ message: 'Je viens de prendre 14 taz.', context: {} });
  assert.equal(firstEmergencyReply.reply, '14 taz, c’est une quantité qui peut représenter une urgence médicale. Appelle le 15 ou le 112 maintenant. Tu es seul ?');
  assert.equal(firstEmergencyReply.safety.mustFollowUp, true); assert.equal(firstEmergencyReply.eventSuggestion, null); assert.equal(firstEmergencyReply.detectedConversationEvent.targets[0].type, 'MDMA');
  const pastIncident = await safetyService.sendMessage({ message: 'C’était hier, c’est fini', context: {}, activeSafetyContext: firstEmergencyReply.safety });
  assert.equal(pastIncident.safety.active, false); assert.equal(pastIncident.safety.resolved, true); assert.equal(pastIncident.safety.exitReason, 'incident_no_longer_current');
  assert.doesNotMatch(pastIncident.reply, /Appelle le 15|As-tu pu lancer l’appel/);
  const stillEmergency = await safetyService.sendMessage({ message: 'Je vais bien.', context: {}, activeSafetyContext: firstEmergencyReply.safety });
  assert.equal(stillEmergency.safety.level, 'emergency'); assert.match(stillEmergency.reply, /J’entends que tu te sens bien/); assert.match(stillEmergency.reply, /Quelqu’un est avec toi \?/);
  const caVaEmergency = await safetyService.sendMessage({ message: 'Ça va', context: {}, activeSafetyContext: firstEmergencyReply.safety });
  assert.equal(caVaEmergency.safety.active, true); assert.equal(caVaEmergency.safety.exitReason, null);
  const contextlessEmergencyYes = evaluateSafety({ message: 'Oui', activeSafetyContext: firstSafety, now: safetyNow });
  assert.equal(contextlessEmergencyYes.active, true); assert.equal(contextlessEmergencyYes.exitReason, null);
  const bareYes = await safetyService.sendMessage({ message: 'Oui', context: {}, activeSafetyContext: null });
  assert.equal(bareYes.safety.active, false); assert.equal(bareYes.safety.exitReason, null);
  const aloneEmergency = await safetyService.sendMessage({ message: 'Je suis seul.', context: {}, activeSafetyContext: stillEmergency.safety });
  assert.equal(aloneEmergency.safety.mustFollowUp, true); assert.match(aloneEmergency.reply, /Peux-tu lancer l’appel tout de suite \?/);
  const helpCalled = await safetyService.sendMessage({ message: 'J’ai appelé le 15.', context: {}, activeSafetyContext: aloneEmergency.safety });
  assert.equal(helpCalled.safety.active, false); assert.equal(helpCalled.safety.exitReason, 'emergency_services_contacted'); assert.match(helpCalled.reply, /Suis leurs instructions/);
  const answeredAlone = await safetyService.sendMessage({ message: 'oui', context: {}, activeSafetyContext: firstEmergencyReply.safety });
  assert.equal(answeredAlone.safety.active, true); assert.match(answeredAlone.reply, /lancer l’appel/); assert.notEqual(answeredAlone.safety.lastAssistantQuestion, firstEmergencyReply.safety.lastAssistantQuestion);
  const declinedCall = await safetyService.sendMessage({ message: 'non', context: {}, activeSafetyContext: answeredAlone.safety });
  assert.equal(declinedCall.safety.active, true); assert.match(declinedCall.reply, /tu n’as pas lancé l’appel/); assert.match(declinedCall.reply, /Quelqu’un peut-il venir près de toi maintenant \?/); assert.doesNotMatch(declinedCall.reply, /Peux-tu lancer l’appel tout de suite/);
  const confirmedCall = await safetyService.sendMessage({ message: 'oui', context: {}, activeSafetyContext: answeredAlone.safety });
  assert.equal(confirmedCall.safety.active, false); assert.equal(confirmedCall.safety.exitReason, 'emergency_services_contacted');
  const variedFollowUp = await safetyService.sendMessage({ message: 'je ne sais pas quoi faire', context: {}, activeSafetyContext: firstEmergencyReply.safety });
  assert.equal(variedFollowUp.safety.active, true); assert.notEqual(variedFollowUp.safety.lastAssistantQuestion, firstEmergencyReply.safety.lastAssistantQuestion);
  const noLoopFollowUp = await safetyService.sendMessage({ message: 'personne', context: {}, activeSafetyContext: declinedCall.safety });
  assert.equal(noLoopFollowUp.safety.active, true); assert.match(noLoopFollowUp.reply, /Envoie maintenant un message à un proche/); assert.doesNotMatch(noLoopFollowUp.reply, /Quelqu’un peut-il venir près de toi maintenant/);
  const genericEmergency = await safetyService.sendMessage({ message: 'Je n’arrive plus à respirer.', context: {} });
  assert.equal(genericEmergency.safety.active, true); assert.match(genericEmergency.reply, /As-tu pu lancer l’appel \?/);
  const unavailableSafetyService = createBackendAiService({ provider: { generate: async () => { throw new Error('provider down'); } }, now: () => safetyNow });
  const providerIndependentSafety = await unavailableSafetyService.sendMessage({ message: 'Je viens de prendre 14 taz.', context: {} });
  assert.equal(providerIndependentSafety.safety.level, 'emergency'); assert.match(providerIndependentSafety.reply, /Appelle le 15 ou le 112 maintenant/);
  let providerRequest;
  const structuredOutput = { reply: 'Réponse **test**', detected: true, autoSaveEligible: true, confidence: 0.95, eventType: 'consumption', targets: [{ category: 'substance', type: 'Alcool', measurement: { quantity: 3, unit: 'verre(s)', durationMinutes: null, episodes: null, moneySpent: null, source: 'conversation' } }], craving: null, emotion: null, context: null, triggers: [], strategies: [], occurredAt: '2026-08-21T17:36:00.000Z', occurredAtPrecision: 'exact', missingFields: [], ambiguity: [], eventEnrichment: { detected: true, eventId: 'event-1', confidence: 0.95, updates: { craving: 8 }, ambiguity: [] } };
  const provider = createOpenAIProvider({ apiKey: 'test-placeholder', now: () => new Date('2026-08-21T17:36:00.000Z'), fetchImpl: async (url, options) => { providerRequest = { url, options }; return { ok: true, status: 200, headers: { get: () => 'req_test' }, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(structuredOutput) }] }] }) }; } });
  const generated = await provider.generate({ message: 'Réponds en français : ça fonctionne ?', context: { goal: 'reduce' }, recentMessages: [{ role: 'assistant', text: 'Que ressens-tu ?' }], pendingConversationEvent: structuredOutput, activeRecentEvent: { id: 'event-1', eventType: 'consumption' }, recentEventCandidates: [{ id: 'event-2', eventType: 'consumption' }] });
  assert.equal(generated.reply, 'Réponse test');
  assert.equal(generated.eventSuggestion, null);
  assert.equal(generated.eventEnrichment.eventId, 'event-1'); assert.equal(generated.eventEnrichment.updates.craving, 8);
  const creationOutput = { ...structuredOutput, eventEnrichment: { detected: false, eventId: null, confidence: 0, updates: {}, ambiguity: [] } };
  const creationProvider = createOpenAIProvider({ apiKey: 'test-placeholder', fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'req_create' }, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(creationOutput) }] }] }) }) });
  const creationResult = await creationProvider.generate({ message: 'Je viens de boire 3 verres.', context: {} });
  assert.equal(creationResult.eventSuggestion.targets[0].measurement.quantity, 3); assert.equal(creationResult.eventEnrichment, null);
  const providerBody = JSON.parse(providerRequest.options.body); assert.equal(providerBody.store, false); assert.equal(providerBody.model, 'gpt-5.4-mini'); assert.equal(typeof providerBody.input, 'string'); assert.match(providerBody.input, /Réponds en français : ça fonctionne \?/);
  assert.match(providerBody.input, /Que ressens-tu/); assert.match(providerBody.input, /Événement conversationnel en cours/); assert.match(providerBody.input, /event-1/); assert.match(providerBody.input, /event-2/);
  assert.match(providerBody.instructions, /ne justifie aucune question sur l'alcool/);
  assert.match(providerBody.instructions, /maintiens presque toujours la continuité avec UNE seule relance naturelle et pertinente/);
  assert.match(providerBody.instructions, /Une relance n'est pas forcément une question/);
  assert.match(providerBody.instructions, /Ne transforme pas la conversation en questionnaire/);
  assert.match(providerBody.instructions, /demande explicitement d'arrêter/);
  assert.match(providerBody.instructions, /Reconnais explicitement la réponse au tour précédent/);
  assert.match(providerBody.instructions, /Ne répète jamais mécaniquement la même question/);
  assert.match(SYSTEM_PROMPT, /Fais passer la chaleur avant l'analyse/);
  assert.match(SYSTEM_PROMPT, /philosophie Anti-Zero/);
  assert.match(SYSTEM_PROMPT, /Je viens de boire 3 verres je rentre du taf/);
  assert.match(SYSTEM_PROMPT, /Mon boss m'a encore gonflé/);
  assert.match(SYSTEM_PROMPT, /J'ai fumé 2 joints/);
  assert.match(SYSTEM_PROMPT, /J'ai encore craqué/);
  assert.match(SYSTEM_PROMPT, /Je suis juste fatigué/);
  assert.match(SYSTEM_PROMPT, /sans chercher obligatoirement une cause ni poser une question/);
  assert.match(PSYCHOLOGICAL_SUPPORT_PROMPT, /jamais un psychologue/);
  assert.match(PSYCHOLOGICAL_SUPPORT_PROMPT, /grounding 5-4-3-2-1/);
  assert.match(PSYCHOLOGICAL_SUPPORT_PROMPT, /Une association n'est jamais une cause certaine/);
  assert.match(PSYCHOLOGICAL_SUPPORT_PROMPT, /la sécurité prime/);
  assert.match(PSYCHOLOGICAL_SUPPORT_PROMPT, /Ne conseille jamais d'arrêter un traitement/);
  assert.match(providerBody.instructions, /urgence médicale 15/);
  assert.match(providerBody.instructions, /urgence générale 112/);
  assert.match(providerBody.input, /liste complète/); assert.match(providerBody.input, /même épisode/);
  assert.equal(providerBody.text.format.type, 'json_schema'); assert.equal(providerBody.text.format.strict, true);
  assert.equal(preventFalseTrackingConfirmation('C’est noté dans ton suivi.'), 'Je peux te proposer de l’ajouter à ton suivi après ta confirmation.');
  await assert.rejects(createOpenAIProvider({ apiKey: '' }).generate({ message: 'Bonjour', context: {} }), { code: 'OPENAI_NOT_CONFIGURED', statusCode: 503 });

  const failedProvider = createOpenAIProvider({ apiKey: 'test-placeholder', fetchImpl: async () => ({
    ok: false,
    status: 400,
    headers: { get: (name) => name === 'x-request-id' ? 'req_failure' : null },
    json: async () => ({ error: { code: 'invalid_request_error', message: 'Unsupported field.' } }),
  }) });
  await assert.rejects(failedProvider.generate({ message: 'Bonjour', context: {} }), (error) => {
    assert.equal(error.statusCode, 502);
    assert.deepEqual(error.providerDetails, { status: 400, code: 'invalid_request_error', message: 'Unsupported field.', requestId: 'req_failure' });
    return true;
  });

  await withServer({ sendMessage: async ({ message, context }) => ({ reply: `${message} / ${context.goal}` }) }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: { goal: 'reduce' } }) });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { reply: 'Test / reduce' });
  });
  const unconfiguredServer = createServer({
    aiService: createBackendAiService({ provider: createOpenAIProvider({ apiKey: '' }) }),
    logger: { error: () => {} },
  });
  unconfiguredServer.listen(0, '127.0.0.1'); await once(unconfiguredServer, 'listening');
  try {
    const baseUrl = `http://127.0.0.1:${unconfiguredServer.address().port}`;
    const response = await fetch(`${baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Test', context: {} }) });
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: { code: 'AI_NOT_CONFIGURED', message: 'The companion is unavailable.' } });
  } finally { unconfiguredServer.close(); await once(unconfiguredServer, 'close'); }

  const logLines = [];
  const loggedError = Object.assign(new Error('OPENAI_REQUEST_FAILED'), {
    code: 'OPENAI_REQUEST_FAILED', statusCode: 502,
    providerDetails: { status: 400, code: 'invalid_request_error', message: 'Unsupported field.', requestId: 'req_failure' },
  });
  const loggingServer = createServer({
    aiService: { sendMessage: async () => { throw loggedError; } },
    logger: { error: (line) => logLines.push(line) },
  });
  loggingServer.listen(0, '127.0.0.1'); await once(loggingServer, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${loggingServer.address().port}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'secret user content', context: {} }) });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: { code: 'AI_UNAVAILABLE', message: 'The companion is unavailable.' } });
  } finally { loggingServer.close(); await once(loggingServer, 'close'); }
  assert.match(logLines[0], /status=400 code=invalid_request_error/);
  assert.match(logLines[0], /request_id=req_failure/);
  assert.doesNotMatch(logLines[0], /secret user content|Authorization|test-placeholder/);

  const mobileSource = fs.readFileSync(path.join(projectRoot, 'src/ai/providers/openaiProvider.js'), 'utf8');
  assert.equal(/api\.openai\.com|OPENAI_API_KEY|Authorization/.test(mobileSource), false);
  const backendSource = fs.readFileSync(path.join(projectRoot, 'backend/src/ai/providers/openaiProvider.js'), 'utf8');
  assert.equal(/store:\s*false/.test(backendSource), true); assert.equal(/file_search|retrieveScientificContext/.test(backendSource), false);
  const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8'); assert.equal(/^\.env$/m.test(gitignore), true);
  const backendPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend/package.json'), 'utf8'));
  assert.match(backendPackage.scripts.start, /--use-system-ca/);
  console.log('Backend HTTP, provider OpenAI et transport mobile validés.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
