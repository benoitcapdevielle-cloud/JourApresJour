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

export const isCriticalSafety = (value) => Boolean(value?.active && CRITICAL_LEVELS.includes(value.level));

export function evaluateCurrentSafety(message, now = new Date()) {
  const quantity = findHighDoseMdma(message);
  if (quantity !== null) return { level: 'emergency', reason: 'very_high_reported_mdma_quantity', quantity, evaluatedAt: now.toISOString() };
  return { level: 'normal', reason: null, quantity: null, evaluatedAt: now.toISOString() };
}

export function resolveEffectiveSafety({ message, previous = null, backend = null, now = new Date() } = {}) {
  const current = evaluateCurrentSafety(message, now);
  const exitReason = findExitReason(message);
  const previousCritical = isCriticalSafety(previous);
  const backendCritical = isCriticalSafety(backend);
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
  if (!isCriticalSafety(safety)) return null;
  if (findHighDoseMdma(message) !== null) return `${findHighDoseMdma(message)} taz, c’est une quantité qui peut représenter une urgence médicale. Appelle le 15 ou le 112 maintenant. Tu es seul ?`;
  if (/^(?:et|et\s*\?|oui|non)$/i.test(text)) return `Je reste sur ce que tu viens de me dire : ${safety.quantity || 14} taz peut représenter une urgence. Appelle le 15 ou le 112 maintenant. Tu es seul ?`;
  if (/\b(?:je vais bien|je me sens bien|ça va)\b/i.test(text)) return 'Même si tu te sens bien maintenant, le risque peut rester sérieux. Appelle le 15 ou le 112 tout de suite. Tu es seul ?';
  if (/\bje suis seul\b/i.test(text)) return 'Appelle le 15 ou le 112 maintenant et préviens quelqu’un de proche si tu peux. Peux-tu lancer l’appel tout de suite ?';
  return 'Je reste sur l’urgence dont tu viens de parler. Appelle le 15 ou le 112 maintenant et ne reste pas seul si tu peux l’éviter. Tu as appelé ?';
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
