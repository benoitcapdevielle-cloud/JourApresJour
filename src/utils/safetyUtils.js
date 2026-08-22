const CRITICAL_LEVELS = ['urgent', 'emergency'];
const cleanText = (value) => typeof value === 'string' ? value.trim() : '';

const findHighDoseMdma = (message) => {
  const match = cleanText(message).match(/\b(\d{1,3})\s*(?:taz|ecstasy|mdma)\b/i);
  return match && Number(match[1]) >= 10 ? Number(match[1]) : null;
};

const findExitReason = (message) => {
  const text = cleanText(message);
  if (/\b(?:j['’]ai appel[ée] (?:le 15|le 112|les secours)|les secours (?:arrivent|sont l[àa])|je suis avec (?:un m[ée]decin|les urgences|un professionnel de sant[ée]))\b/i.test(text)) return 'emergency_services_contacted';
  if (/\b(?:quelqu['’]un est avec moi|je suis avec quelqu['’]un|un proche est avec moi|je ne suis plus seul)\b/i.test(text)) return 'trusted_person_present';
  return null;
};

const getBinaryAnswer = (message) => /^(?:oui|ouais|yes|non|non merci)[.!\s]*$/i.test(cleanText(message))
  ? (/^(?:oui|ouais|yes)\b/i.test(cleanText(message)) ? 'yes' : 'no') : null;

const findContextualExitReason = (message, previous) => {
  const answer = getBinaryAnswer(message);
  const question = previous?.lastAssistantQuestion || '';
  if (answer === 'yes' && /appel[ée]|lancer l['’]appel/i.test(question)) return 'emergency_services_contacted';
  if (answer === 'no' && /seul/i.test(question)) return 'trusted_person_present';
  return null;
};

const hasTemporalResolution = (message) => {
  const text = cleanText(message).toLocaleLowerCase('fr-FR');
  return /\b(?:c['’]était|cela (?:s['’]est passé|était)|ça (?:s['’]est passé|date))\s+(?:hier|avant-hier|la semaine dernière)\b/i.test(text)
    || /\b(?:c['’]est|cela est|ça y est,? c['’]est)\s+(?:fini|terminé|passé)|\b(?:ce n['’]est|c['’]est) plus (?:le cas|maintenant|d['’]actualité)|\bplus maintenant\b/i.test(text);
};

const hasCurrentDanger = (message) => /\b(?:maintenant|en ce moment).*(?:surdose|overdose|convulsion|respirer|douleur|partir)|\b(?:surdose|overdose|convulsions?|perte de connaissance|n['’]arrive plus à respirer|douleur (?:dans la poitrine|thoracique)|me sens partir)\b/i.test(cleanText(message));

export const isCriticalSafety = (value) => Boolean(value?.active && CRITICAL_LEVELS.includes(value.level));

export function evaluateCurrentSafety(message, now = new Date()) {
  const quantity = findHighDoseMdma(message);
  if (quantity !== null) return { level: 'emergency', reason: 'very_high_reported_mdma_quantity', quantity, evaluatedAt: now.toISOString() };
  return { level: 'normal', reason: null, quantity: null, evaluatedAt: now.toISOString() };
}

export function resolveEffectiveSafety({ message, previous = null, backend = null, now = new Date() } = {}) {
  const current = evaluateCurrentSafety(message, now);
  const previousCritical = isCriticalSafety(previous);
  const backendCritical = isCriticalSafety(backend);
  const temporalExit = previousCritical && hasTemporalResolution(message) && !hasCurrentDanger(message) ? 'incident_no_longer_current' : null;
  const exitReason = findExitReason(message) || findContextualExitReason(message, previous) || temporalExit;
  if (previousCritical && exitReason) return {
    ...previous, level: 'concern', currentLevel: current.level, effectiveLevel: 'concern', active: false, mustFollowUp: false,
    resolved: true, exitReason, relatedConversationEventId: previous.relatedConversationEventId || null,
  };
  if (current.level === 'emergency') return {
    ...(backendCritical ? backend : previousCritical ? previous : {}), id: backend?.id || previous?.id || `safety-${now.getTime()}`,
    level: 'emergency', currentLevel: 'emergency', effectiveLevel: 'emergency', active: true, mustFollowUp: true,
    followUpType: 'safety_check', resolved: false, exitReason: null, reason: current.reason, quantity: current.quantity,
    startedAt: previous?.startedAt || backend?.startedAt || now.toISOString(), relatedEventId: backend?.relatedEventId || previous?.relatedEventId || null,
    relatedConversationEventId: previous?.relatedConversationEventId || null,
  };
  if (previousCritical) return {
    ...previous, currentLevel: current.level, effectiveLevel: previous.level, active: true, mustFollowUp: true,
    followUpType: 'safety_check', resolved: false, exitReason: null,
  };
  if (backendCritical) return {
    ...backend, currentLevel: current.level, effectiveLevel: backend.level, active: true, mustFollowUp: true,
    followUpType: 'safety_check', resolved: false, exitReason: null,
  };
  return { ...(backend || {}), level: backend?.level || 'normal', currentLevel: current.level, effectiveLevel: backend?.level || 'normal', active: false, mustFollowUp: false, resolved: Boolean(backend?.exitReason), exitReason: backend?.exitReason || null };
}

export function buildLocalSafetyReply(message, safety) {
  const text = cleanText(message).toLocaleLowerCase('fr-FR');
  if (safety?.exitReason === 'incident_no_longer_current') return 'D’accord, je comprends que cet épisode est terminé et qu’il n’y a pas de danger actuel exprimé. Si un symptôme inquiétant apparaît ou revient, contacte immédiatement les urgences.';
  if (!isCriticalSafety(safety)) return null;
  if (findHighDoseMdma(message) !== null) return `${findHighDoseMdma(message)} taz, c’est une quantité qui peut représenter une urgence médicale. Appelle le 15 ou le 112 maintenant. Tu es seul ?`;
  const answer = getBinaryAnswer(text);
  if (answer === 'yes' && /seul/i.test(safety.lastAssistantQuestion || '')) return 'D’accord, tu es seul. Appelle le 15 ou le 112 maintenant et préviens un proche si tu peux. Peux-tu lancer l’appel tout de suite ?';
  if (answer === 'no' && /appel[ée]|lancer l['’]appel/i.test(safety.lastAssistantQuestion || '')) return 'D’accord, tu n’as pas lancé l’appel. Demande immédiatement à quelqu’un de le faire pour toi. Quelqu’un peut-il venir près de toi maintenant ?';
  if (/^(?:et|et\s*\?)$/i.test(text)) return `Je reste sur ce que tu viens de me dire : ${safety.quantity || 14} taz peut représenter une urgence. Appelle le 15 ou le 112 maintenant. Quelqu’un est-il avec toi ?`;
  if (/\b(?:je vais bien|je me sens bien|ça va)\b/i.test(text)) return 'J’entends que tu te sens bien maintenant, mais le risque peut rester sérieux. Appelle le 15 ou le 112 tout de suite. Quelqu’un est avec toi ?';
  if (/\bje suis seul\b/i.test(text)) return 'Appelle le 15 ou le 112 maintenant et préviens quelqu’un de proche si tu peux. Peux-tu lancer l’appel tout de suite ?';
  if (/quelqu['’]un|avec toi|près de toi/i.test(safety.lastAssistantQuestion || '') && safety.followUpAttempt >= 2) return 'Je comprends que l’aide n’est pas encore confirmée. Envoie maintenant un message à un proche avec ton adresse et demande-lui d’appeler le 15 ou le 112, puis dis-moi simplement quand c’est fait.';
  if (/appel[ée]|lancer l['’]appel/i.test(safety.lastAssistantQuestion || '')) return 'Je comprends que l’appel n’est pas encore confirmé. Demande à quelqu’un près de toi d’appeler le 15 ou le 112. Qui peux-tu prévenir maintenant ?';
  return 'Je reste sur l’urgence dont tu viens de parler. Appelle le 15 ou le 112 maintenant et ne reste pas seul si tu peux l’éviter. As-tu pu lancer l’appel ?';
}

export function buildLocalSafetyDetectedEvent(message, now = new Date()) {
  const quantity = findHighDoseMdma(message);
  if (quantity === null) return null;
  return {
    detected: true, autoSaveEligible: false, confidence: 0.99, eventType: 'consumption',
    targets: [{ category: 'substance', type: 'MDMA', measurement: { quantity, unit: 'taz', source: 'conversation' } }],
    craving: null, emotion: null, context: null, triggers: [], strategies: [], occurredAt: now.toISOString(), occurredAtPrecision: 'exact',
    missingFields: [], ambiguity: [], trackingStatus: 'unconfirmed', safetyRelevant: true, trackerEventId: null, source: 'conversation_pending',
  };
}

export function rememberLocalSafetyQuestion(safety, reply) {
  const questions = cleanText(reply).match(/[^.!?]*\?/g);
  const lastAssistantQuestion = questions?.at(-1)?.trim() || null;
  return { ...safety, lastAssistantQuestion, followUpAttempt: (safety?.followUpAttempt || 0) + (lastAssistantQuestion ? 1 : 0) };
}
