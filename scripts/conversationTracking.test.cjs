const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const babel = require('@babel/core');

const originalExtension = Module._extensions['.js'];
Module._extensions['.js'] = (loaded, filename) => {
  if (!filename.includes('src')) return originalExtension(loaded, filename);
  const source = fs.readFileSync(filename, 'utf8');
  const code = babel.transformSync(source, { plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  loaded._compile(code, filename);
};

const stored = new Map();
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') return {
    getItem: async (key) => stored.get(key) ?? null,
    setItem: async (key, value) => stored.set(key, value),
    removeItem: async (key) => stored.delete(key),
  };
  return originalLoad.call(this, request, parent, isMain);
};

const { isConfirmableEventSuggestion, normalizeEventExtraction, toTrackerEventSuggestion } = require('../src/ai/eventExtraction');
const { normalizeEvent } = require('../src/utils/eventUtils');
const { loadEvents, saveEvents, STORAGE_KEY, upsertTrackerEvent } = require('../src/services/storageService');
const { buildBehaviorSummary } = require('../src/utils/behaviorAnalysis');
const lexiconService = require('../src/services/personalLexiconService');
const pendingEventService = require('../src/services/pendingConversationEventService');
const safetyContextService = require('../src/services/safetyContextService');
const safetyUtils = require('../src/utils/safetyUtils');
const conversationService = require('../src/services/conversationService');

const suggestion = (target, extra = {}) => ({
  detected: true, confidence: 0.94, eventType: 'consumption', targets: [target], craving: null, emotion: null,
  context: null, triggers: [], strategies: [], occurredAt: '2026-08-21T15:36:00.000Z', occurredAtPrecision: 'exact', missingFields: [], ambiguity: [], ...extra,
});
const target = (category, type, measurement) => ({ category, type, measurement });

(async () => {
  await conversationService.clearConversation();
  for (let index = 1; index <= 16; index += 1) await conversationService.addUserMessage(`Message ${index}`);
  const longConversation = await conversationService.loadConversation();
  assert.equal(longConversation.length, 16); assert.equal(longConversation[15].text, 'Message 16');

  const alcohol = normalizeEventExtraction(suggestion(target('substance', 'Alcool', { quantity: 3, unit: 'verre(s)', source: 'conversation' })));
  assert.equal(isConfirmableEventSuggestion(alcohol), true);
  const tracker = toTrackerEventSuggestion(alcohol);
  const event = normalizeEvent({ ...tracker, id: 'conversation-1', date: tracker.date });
  assert.equal(event.targets[0].measurement.source, 'conversation');
  await saveEvents([event]);
  const reloaded = await loadEvents();
  assert.equal(reloaded.length, 1); assert.equal(reloaded[0].id, 'conversation-1');
  assert.equal(reloaded[0].targets[0].measurement.quantity, 3);
  assert.equal(buildBehaviorSummary(reloaded).topTarget.value, 'Alcool');
  assert.ok(stored.has(STORAGE_KEY));

  const phoneFlowEvent = normalizeEvent({ ...toTrackerEventSuggestion(normalizeEventExtraction(suggestion(target('substance', 'Cannabis', { quantity: 2, unit: 'joint(s)', source: 'conversation' }), { autoSaveEligible: true, confidence: 0.97, context: 'Après le travail' }))), id: 'phone-auto-cannabis' });
  const phoneSaved = await upsertTrackerEvent(phoneFlowEvent);
  assert.equal(phoneSaved.some(({ id }) => id === phoneFlowEvent.id), true);
  const phoneReloaded = await loadEvents();
  assert.equal(phoneReloaded.find(({ id }) => id === phoneFlowEvent.id).targets[0].type, 'Cannabis');
  const phoneEnriched = normalizeEvent({ ...phoneFlowEvent, craving: 8, emotion: 'Colère', triggers: ['Problèmes de planning'], targets: [...phoneFlowEvent.targets, target('substance', 'Cocaïne', { quantity: 2, unit: 'trace(s)', source: 'conversation' })], updatedAt: '2026-08-21T18:30:00.000Z', lastUpdatedFrom: 'conversation' });
  const phoneUpdated = await upsertTrackerEvent(phoneEnriched);
  assert.equal(phoneUpdated.length, phoneSaved.length);
  assert.equal(phoneUpdated.filter(({ id }) => id === phoneFlowEvent.id).length, 1);
  assert.equal(phoneUpdated.find(({ id }) => id === phoneFlowEvent.id).targets.length, 2);
  const finalPhoneEvent = (await loadEvents()).find(({ id }) => id === phoneFlowEvent.id);
  assert.equal(finalPhoneEvent.targets.length, 2); assert.equal(finalPhoneEvent.craving, 8); assert.equal(finalPhoneEvent.emotion, 'Colère');
  assert.equal((await loadEvents()).filter(({ id }) => id === phoneFlowEvent.id).length, 1);

  const cannabisEvent = normalizeEvent({ ...toTrackerEventSuggestion(normalizeEventExtraction(suggestion(target('substance', 'Cannabis', { quantity: 2, unit: 'joint(s)', source: 'conversation' })))), id: 'conversation-2' });
  const concurrentSave = saveEvents([event]);
  const appended = saveEvents([event, cannabisEvent]);
  await concurrentSave;
  const appendResult = await appended;
  assert.equal(appendResult.length, 2);
  assert.equal(appendResult.some(({ id }) => id === 'conversation-2'), true);
  assert.equal((await loadEvents()).some(({ id }) => id === 'conversation-2'), true);
  const cannabisWithCocaine = normalizeEvent({ ...cannabisEvent, targets: [
    cannabisEvent.targets[0], target('substance', 'Cocaïne', { quantity: 2, unit: 'trace(s)', source: 'conversation' }),
  ], updatedAt: '2026-08-21T18:10:00.000Z', lastUpdatedFrom: 'conversation' });
  await saveEvents((await loadEvents()).map((item) => item.id === cannabisEvent.id ? cannabisWithCocaine : item));
  const afterPolyEnrichment = await loadEvents();
  assert.equal(afterPolyEnrichment.filter(({ id }) => id === cannabisEvent.id).length, 1);
  assert.equal(afterPolyEnrichment.find(({ id }) => id === cannabisEvent.id).targets.length, 2);
  assert.ok(buildBehaviorSummary(afterPolyEnrichment).polyConsumptionRate > 0);

  const youtube = normalizeEventExtraction(suggestion(target('digital', 'YouTube / vidéos', { durationMinutes: 300, source: 'conversation' })));
  const gambling = normalizeEventExtraction(suggestion(target('behavior', 'Jeux d’argent / paris', { moneySpent: 80, source: 'conversation' })));
  assert.equal(youtube.targets[0].measurement.durationMinutes, 300);
  assert.equal(gambling.targets[0].measurement.moneySpent, 80);
  const multi = normalizeEventExtraction(suggestion(target('digital', 'YouTube / vidéos', { durationMinutes: 120, source: 'conversation' }), { targets: [target('digital', 'YouTube / vidéos', { durationMinutes: 120, source: 'conversation' }), target('digital', 'Instagram', { durationMinutes: 30, source: 'conversation' })] }));
  assert.equal(multi.targets.length, 2);

  const resisted = normalizeEventExtraction(suggestion(target('substance', 'Cannabis', { source: 'conversation' }), { eventType: 'craving_resisted', strategies: ['Attendre'] }));
  assert.equal(isConfirmableEventSuggestion(resisted), true);
  const ambiguous = normalizeEventExtraction(suggestion(target('substance', 'Cannabis', { source: 'conversation' }), { confidence: 0.65, missingFields: ['quantity'], ambiguity: ['La quantité totale n’est pas certaine'] }));
  assert.equal(isConfirmableEventSuggestion(ambiguous), false);
  const partiallyEnriched = normalizeEventExtraction(suggestion(target('substance', 'Alcool', { quantity: 3, unit: 'verre(s)', source: 'conversation' }), { location: 'Chez moi', missingFields: ['socialContext'] }));
  assert.equal(isConfirmableEventSuggestion(partiallyEnriched), true);

  const persistedCases = [
    normalizeEvent({ ...toTrackerEventSuggestion(youtube), id: 'conversation-youtube' }),
    normalizeEvent({ ...toTrackerEventSuggestion(gambling), id: 'conversation-gambling' }),
    normalizeEvent({ ...toTrackerEventSuggestion(multi), id: 'conversation-multi' }),
    normalizeEvent({ ...toTrackerEventSuggestion(resisted), id: 'conversation-resisted' }),
  ];
  await saveEvents([...(await loadEvents()), ...persistedCases]);
  const allPersisted = await loadEvents();
  assert.ok(allPersisted.some(({ id }) => id === 'conversation-youtube'));
  assert.ok(allPersisted.some(({ id }) => id === 'conversation-gambling'));
  assert.equal(allPersisted.find(({ id }) => id === 'conversation-multi').targets.length, 2);
  assert.equal(allPersisted.find(({ id }) => id === 'conversation-resisted').eventType, 'craving_resisted');
  assert.ok(allPersisted.some(({ id }) => id === 'conversation-1'));

  const enriched = normalizeEventExtraction(suggestion(target('substance', 'Cannabis', { quantity: 2, unit: 'joint(s)', source: 'conversation' }), {
    emotion: 'Stress', context: 'Après le travail', triggers: ['Stress'], socialContext: 'Seul', timeOfDay: 'Soir', location: 'Chez moi',
    circumstances: 'En rentrant du travail', immediateConsequence: 'S’est senti ralenti', explicitIntention: 'Décompresser', feelingAfter: 'Fatigué',
  }));
  const enrichedTracker = toTrackerEventSuggestion(enriched);
  assert.equal(enrichedTracker.context, 'Après le travail'); assert.equal(enrichedTracker.emotion, 'Stress'); assert.deepEqual(enrichedTracker.triggers, ['Stress']);
  assert.deepEqual(enrichedTracker.conversationDetails, { socialContext: 'Seul', timeOfDay: 'Soir', location: 'Chez moi', circumstances: 'En rentrant du travail', immediateConsequence: 'S’est senti ralenti', explicitIntention: 'Décompresser', feelingAfter: 'Fatigué' });
  const enrichedEvent = normalizeEvent({ ...enrichedTracker, id: 'conversation-enriched' });
  await saveEvents([...(await loadEvents()), enrichedEvent]);
  assert.equal((await loadEvents()).find(({ id }) => id === 'conversation-enriched').conversationDetails.location, 'Chez moi');
  const enrichedUpdate = normalizeEvent({ ...enrichedEvent, craving: 8, emotion: 'Colère', triggers: [...enrichedEvent.triggers, 'Problèmes de planning'], updatedAt: '2026-08-21T18:00:00.000Z', lastUpdatedFrom: 'conversation' });
  await saveEvents((await loadEvents()).map((item) => item.id === enrichedEvent.id ? enrichedUpdate : item));
  const afterEnrichment = await loadEvents();
  assert.equal(afterEnrichment.filter(({ id }) => id === enrichedEvent.id).length, 1);
  assert.equal(afterEnrichment.find(({ id }) => id === enrichedEvent.id).craving, 8);
  assert.equal(afterEnrichment.find(({ id }) => id === enrichedEvent.id).emotion, 'Colère');
  assert.ok(afterEnrichment.find(({ id }) => id === enrichedEvent.id).triggers.includes('Problèmes de planning'));

  await pendingEventService.savePendingConversationEvent(enriched);
  const restoredPending = await pendingEventService.loadPendingConversationEvent();
  assert.equal(restoredPending.targets[0].type, 'Cannabis'); assert.equal(restoredPending.emotion, 'Stress');
  await pendingEventService.clearPendingConversationEvent();
  assert.equal(await pendingEventService.loadPendingConversationEvent(), null);
  await pendingEventService.saveActiveConversationEventId('conversation-enriched');
  assert.equal(await pendingEventService.loadActiveConversationEventId(), 'conversation-enriched');
  const safetyPending = await pendingEventService.savePendingConversationEvent({ ...enriched, safetyRelevant: true, relatedSafetyContextId: 'safety-1', trackingStatus: 'unconfirmed' });
  assert.match(safetyPending.conversationEventId, /^pending-/); assert.equal(safetyPending.trackingStatus, 'unconfirmed'); assert.equal(safetyPending.safetyRelevant, true);
  await safetyContextService.saveActiveSafetyContext({ id: 'safety-1', level: 'emergency', mustFollowUp: true, followUpType: 'safety_check', active: true, relatedEventId: null, exitReason: null, startedAt: '2026-08-21T18:00:00.000Z' });
  const restoredSafety = await safetyContextService.loadActiveSafetyContext();
  assert.equal(restoredSafety.level, 'emergency'); assert.equal(restoredSafety.mustFollowUp, true); assert.equal(restoredSafety.id, 'safety-1');
  await safetyContextService.clearActiveSafetyContext(); assert.equal(await safetyContextService.loadActiveSafetyContext(), null);
  const localEmergency = safetyUtils.resolveEffectiveSafety({ message: "J'ai pris 14taz", now: new Date('2026-08-21T18:00:00.000Z') });
  assert.equal(localEmergency.currentLevel, 'emergency'); assert.equal(localEmergency.effectiveLevel, 'emergency'); assert.equal(localEmergency.mustFollowUp, true);
  const localPastIncident = safetyUtils.resolveEffectiveSafety({ message: "C’était hier, c’est fini", previous: localEmergency, now: new Date('2026-08-21T18:00:10.000Z') });
  assert.equal(localPastIncident.active, false); assert.equal(localPastIncident.resolved, true); assert.equal(localPastIncident.exitReason, 'incident_no_longer_current');
  assert.doesNotMatch(safetyUtils.buildLocalSafetyReply("C’était hier, c’est fini", localPastIncident), /Appelle le 15|As-tu pu lancer l’appel/);
  const localBareYes = safetyUtils.resolveEffectiveSafety({ message: 'Oui', previous: null, now: new Date('2026-08-21T18:00:15.000Z') });
  assert.equal(localBareYes.active, false); assert.equal(localBareYes.exitReason, null);
  const afterAnd = safetyUtils.resolveEffectiveSafety({ message: 'Et', previous: localEmergency, now: new Date('2026-08-21T18:01:00.000Z') });
  assert.equal(afterAnd.currentLevel, 'normal'); assert.equal(afterAnd.effectiveLevel, 'emergency'); assert.equal(afterAnd.active, true);
  assert.match(safetyUtils.buildLocalSafetyReply('Et', afterAnd), /Appelle le 15 ou le 112 maintenant/);
  const localFirstReply = safetyUtils.buildLocalSafetyReply("J'ai pris 14taz", localEmergency);
  const localWithQuestion = safetyUtils.rememberLocalSafetyQuestion(localEmergency, localFirstReply);
  assert.equal(localWithQuestion.lastAssistantQuestion, 'Tu es seul ?');
  const localAnsweredAlone = safetyUtils.resolveEffectiveSafety({ message: 'oui', previous: localWithQuestion, now: new Date('2026-08-21T18:00:30.000Z') });
  const localCallReply = safetyUtils.buildLocalSafetyReply('oui', localAnsweredAlone);
  assert.match(localCallReply, /lancer l’appel/); assert.notEqual(localCallReply, localFirstReply);
  const localWithCallQuestion = safetyUtils.rememberLocalSafetyQuestion(localAnsweredAlone, localCallReply);
  const localDeclinedCall = safetyUtils.resolveEffectiveSafety({ message: 'non', previous: localWithCallQuestion, now: new Date('2026-08-21T18:00:40.000Z') });
  const localDeclinedReply = safetyUtils.buildLocalSafetyReply('non', localDeclinedCall);
  assert.match(localDeclinedReply, /tu n’as pas lancé l’appel/); assert.doesNotMatch(localDeclinedReply, /Peux-tu lancer l’appel tout de suite/);
  const localWithNearbyQuestion = safetyUtils.rememberLocalSafetyQuestion(localDeclinedCall, localDeclinedReply);
  const localNoLoopReply = safetyUtils.buildLocalSafetyReply('personne', localWithNearbyQuestion);
  assert.match(localNoLoopReply, /Envoie maintenant un message à un proche/); assert.doesNotMatch(localNoLoopReply, /Quelqu’un peut-il venir près de toi maintenant/);
  const localConfirmedCall = safetyUtils.resolveEffectiveSafety({ message: 'oui', previous: localWithCallQuestion, now: new Date('2026-08-21T18:00:45.000Z') });
  assert.equal(localConfirmedCall.active, false); assert.equal(localConfirmedCall.exitReason, 'emergency_services_contacted');
  const afterWell = safetyUtils.resolveEffectiveSafety({ message: 'Je vais bien', previous: afterAnd, now: new Date('2026-08-21T18:02:00.000Z') });
  assert.equal(afterWell.effectiveLevel, 'emergency'); assert.equal(afterWell.mustFollowUp, true);
  const afterCaVa = safetyUtils.resolveEffectiveSafety({ message: 'Ça va', previous: afterAnd, now: new Date('2026-08-21T18:02:10.000Z') });
  assert.equal(afterCaVa.active, true); assert.equal(afterCaVa.exitReason, null);
  const localDetected = safetyUtils.buildLocalSafetyDetectedEvent("J'ai pris 14taz", new Date('2026-08-21T18:00:00.000Z'));
  assert.equal(localDetected.trackingStatus, 'unconfirmed'); assert.equal(localDetected.trackerEventId, null); assert.equal(localDetected.targets[0].measurement.unit, 'taz');
  const afterCall = safetyUtils.resolveEffectiveSafety({ message: "J'ai appelé le 15", previous: afterWell, now: new Date('2026-08-21T18:03:00.000Z') });
  assert.equal(afterCall.active, false); assert.equal(afterCall.resolved, true); assert.equal(afterCall.exitReason, 'emergency_services_contacted');

  assert.deepEqual(await lexiconService.loadPersonalLexicon(), []);
  await assert.rejects(lexiconService.addUserConfirmedExpression({ expression: 'fusée', meaning: '' }), TypeError);
  const addedLexicon = await lexiconService.addUserConfirmedExpression({ expression: 'fusée', meaning: 'joint très chargé' });
  assert.equal(addedLexicon[0].source, 'user_confirmed');
  assert.equal(lexiconService.findConfirmedLexiconMatches('J’ai tiré sur une fusée', addedLexicon)[0].meaning, 'joint très chargé');
  const updatedLexicon = await lexiconService.updateUserConfirmedExpression(addedLexicon[0].id, { expression: 'fusée', meaning: 'joint de cannabis très chargé' });
  assert.equal(updatedLexicon[0].meaning, 'joint de cannabis très chargé');
  assert.deepEqual(await lexiconService.removePersonalLexiconEntry(updatedLexicon[0].id), []);

  const talkSource = fs.readFileSync('./src/screens/TalkScreen.js', 'utf8');
  assert.ok(talkSource.includes('Ajouter au suivi ?'));
  assert.ok(talkSource.includes('onAddEventSuggestion'));
  assert.ok(talkSource.includes('onModifyEventSuggestion'));
  assert.ok(talkSource.includes("setPendingSuggestion(null)"));
  assert.equal(talkSource.includes('<ScrollView'), false);
  assert.ok(talkSource.includes('inverted'));
  assert.ok(talkSource.includes('displayedMessages'));
  assert.ok(talkSource.includes('scrollToOffset({ offset: 0'));
  assert.ok(talkSource.includes('isNearBottomRef'));
  assert.ok(talkSource.includes('nativeEvent.contentOffset.y < 80'));
  assert.ok(talkSource.includes('if (shouldFollowAssistant) requestAutoScroll()'));
  assert.ok(talkSource.includes('getAutoSaveDecision'));
  assert.ok(talkSource.includes('!appliedEnrichment && mergedSuggestion'));
  assert.ok(talkSource.includes("enabled={Platform.OS === 'ios'}"));
  assert.ok(talkSource.includes("Keyboard.addListener('keyboardDidShow'"));
  assert.ok(talkSource.includes("Keyboard.addListener('keyboardDidHide'"));
  assert.ok(talkSource.includes('setKeyboardInset(0)'));
  assert.ok(talkSource.includes("Dimensions.get('window').height"));
  assert.ok(talkSource.includes('DEBUG tracker:'));
  assert.ok(talkSource.includes('messages.slice(-7)'));
  assert.ok(talkSource.includes('pendingConversationEvent: pendingSuggestion'));
  assert.ok(talkSource.includes('activeRecentEvent: compactActiveEvent(activeRecentEvent)'));
  assert.ok(talkSource.includes("['urgent', 'emergency'].includes(nextSafetyContext.level)"));
  assert.ok(talkSource.includes("autoSaveReasons: criticalSafety ? ['safety_priority']"));
  assert.ok(talkSource.includes('TRACK blockedBySafety'));
  assert.ok(talkSource.includes('isApplicableEventEnrichment'));
  const appSource = fs.readFileSync('./App.js', 'utf8');
  assert.ok(appSource.includes('await saveEvents(normalized)'));
  assert.ok(appSource.includes('const persisted = await loadEvents()'));
  assert.ok(appSource.includes('await upsertTrackerEvent(normalized)'));
  assert.ok(appSource.includes('await commitTrackerEvent(eventData)'));
  assert.ok(appSource.includes('await commitTrackerEvent(updated)'));
  assert.ok(appSource.includes('setEvents(finalEvents)'));
  assert.ok(appSource.includes('trackerDebug={trackerDebug}'));
  assert.ok(appSource.includes("lastUpdatedFrom: 'conversation'"));
  assert.ok(appSource.includes("addAssistantMessage('Ajouté à ton suivi.')"));
  console.log('Confirmation conversationnelle, persistance tracker et analyses validées.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
