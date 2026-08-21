const SAFETY_LEVELS = Object.freeze(['normal', 'concern', 'urgent', 'emergency']);
const ACTIVE_LEVELS = new Set(['urgent', 'emergency']);

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeSafetyContext = (value) => {
  if (!value || typeof value !== 'object' || !SAFETY_LEVELS.includes(value.level)) return null;
  return {
    id: cleanText(value.id) || null,
    level: value.level,
    mustFollowUp: value.mustFollowUp === true,
    followUpType: value.followUpType === 'safety_check' ? 'safety_check' : null,
    active: value.active === true,
    relatedEventId: cleanText(value.relatedEventId) || null,
    exitReason: cleanText(value.exitReason) || null,
    startedAt: cleanText(value.startedAt) || null,
    currentLevel: SAFETY_LEVELS.includes(value.currentLevel) ? value.currentLevel : value.level,
    effectiveLevel: SAFETY_LEVELS.includes(value.effectiveLevel) ? value.effectiveLevel : value.level,
    resolved: value.resolved === true,
    relatedConversationEventId: cleanText(value.relatedConversationEventId) || null,
    reason: cleanText(value.reason) || null,
    quantity: Number.isFinite(Number(value.quantity)) ? Number(value.quantity) : null,
  };
};

const detectsEmergency = (text) => {
  const highDoseMdma = text.match(/\b(\d{1,3})\s*(?:taz|ecstasy|mdma)\b/i);
  if (highDoseMdma && Number(highDoseMdma[1]) >= 10) return { detected: true, reason: 'very_high_reported_mdma_quantity', quantity: Number(highDoseMdma[1]), substance: 'taz' };
  if (/\b(?:surdose|overdose|convulsions?|perte de connaissance|je (?:n['’]arrive|n'arrive) plus [àa] respirer|douleur (?:dans la poitrine|thoracique)|je me sens partir)\b/i.test(text)) return { detected: true, reason: 'serious_physical_warning', quantity: null, substance: null };
  if (/\b(?:je vais me suicider|je vais me tuer|je veux mourir maintenant|j['’]ai un plan pour me tuer)\b/i.test(text)) return { detected: true, reason: 'immediate_self_harm_risk', quantity: null, substance: null };
  return { detected: false, reason: null, quantity: null, substance: null };
};

const detectsHandover = (text) => {
  if (/\b(?:j['’]ai appel[ée] (?:le 15|le 112|les secours)|les secours (?:arrivent|sont l[àa])|je suis avec (?:un m[ée]decin|les urgences|un professionnel de sant[ée]))\b/i.test(text)) return 'emergency_services_contacted';
  if (/\b(?:quelqu['’]un est avec moi|je suis avec quelqu['’]un|un proche est avec moi|je ne suis plus seul)\b/i.test(text)) return 'trusted_person_present';
  return null;
};

function evaluateSafety({ message, activeSafetyContext = null, relatedEventId = null, now = new Date() } = {}) {
  const text = cleanText(message);
  const active = normalizeSafetyContext(activeSafetyContext);
  const handover = detectsHandover(text);
  if (active?.active && ACTIVE_LEVELS.has(active.level) && handover) {
    return { ...active, level: 'concern', mustFollowUp: false, followUpType: null, active: false, relatedEventId: active.relatedEventId || relatedEventId || null, exitReason: handover, startedAt: active.startedAt || now.toISOString(), reason: active.reason || null };
  }
  const emergency = detectsEmergency(text);
  if (emergency.detected) return { id: active?.id || `safety-${now.getTime()}`, level: 'emergency', mustFollowUp: true, followUpType: 'safety_check', active: true, relatedEventId: relatedEventId || active?.relatedEventId || null, exitReason: null, startedAt: active?.startedAt || now.toISOString(), reason: emergency.reason, quantity: emergency.quantity, substance: emergency.substance };
  if (active?.active && ACTIVE_LEVELS.has(active.level)) return { ...active, mustFollowUp: true, followUpType: 'safety_check', exitReason: null };
  return { id: null, level: 'normal', mustFollowUp: false, followUpType: null, active: false, relatedEventId: relatedEventId || null, exitReason: null, startedAt: null, reason: null };
}

const hasFollowUp = (reply) => /\?|\b(?:appelle|dis-moi|reste avec|pr[ée]viens|demande|lance l['’]appel|suis leurs instructions)\b/i.test(cleanText(reply));

function buildMandatorySafetyReply({ safety, message, resources }) {
  const text = cleanText(message).toLocaleLowerCase('fr-FR');
  const medical = resources?.medicalEmergency;
  const general = resources?.generalEmergency;
  const callLabel = medical && general ? `le ${medical} ou le ${general}` : 'les services d’urgence locaux';
  if (safety.exitReason === 'emergency_services_contacted') return 'D’accord, l’aide est en cours. Suis leurs instructions et reste en ligne avec eux aussi longtemps qu’ils te le demandent.';
  if (safety.exitReason === 'trusted_person_present') return `Reste avec cette personne et appelle ${callLabel} maintenant si ce n’est pas déjà fait.`;
  if (/\bje (?:vais bien|me sens bien)|\bça va\b/i.test(text)) return `Même si tu te sens bien maintenant, le risque peut rester sérieux. Appelle ${callLabel} tout de suite. Tu es seul ?`;
  if (/\bje suis seul\b/i.test(text)) return `Appelle ${callLabel} maintenant et préviens quelqu’un de proche si tu peux. Peux-tu lancer l’appel tout de suite ?`;
  if (/^(?:et|et\s*\?|oui|non)$/i.test(text) && safety.quantity) return `Je reste sur ce que tu viens de me dire : ${safety.quantity} taz peut représenter une urgence. Appelle ${callLabel} maintenant. Tu es seul ?`;
  if (safety.reason === 'very_high_reported_mdma_quantity' && safety.quantity) return `${safety.quantity} taz, c’est une quantité qui peut représenter une urgence médicale. Appelle ${callLabel} maintenant. Tu es seul ?`;
  return `La priorité est d’appeler ${callLabel} maintenant et de ne pas rester seul si tu peux l’éviter. Tu as appelé ?`;
}

function enforceSafetyReply({ reply, safety, message, resources }) {
  if (safety?.exitReason) return buildMandatorySafetyReply({ safety, message, resources });
  if (!safety?.mustFollowUp) return cleanText(reply);
  const mandatory = buildMandatorySafetyReply({ safety, message, resources });
  if (!hasFollowUp(reply)) return mandatory;
  return mandatory;
}

function buildSafetyDetectedEvent(message, now = new Date()) {
  const text = cleanText(message);
  const match = text.match(/\b(\d{1,3})\s*(?:taz|ecstasy|mdma)\b/i);
  if (!match || Number(match[1]) < 1) return null;
  return {
    detected: true,
    autoSaveEligible: false,
    confidence: 0.99,
    eventType: 'consumption',
    targets: [{ category: 'substance', type: 'MDMA', measurement: { quantity: Number(match[1]), unit: 'comprimé(s)', source: 'conversation' } }],
    craving: null, emotion: null, context: null, triggers: [], strategies: [],
    occurredAt: now.toISOString(), occurredAtPrecision: 'exact',
    socialContext: null, timeOfDay: null, location: null, circumstances: null,
    immediateConsequence: null, explicitIntention: null, feelingAfter: null,
    missingFields: [], ambiguity: [],
  };
}

module.exports = { SAFETY_LEVELS, normalizeSafetyContext, evaluateSafety, hasFollowUp, buildMandatorySafetyReply, enforceSafetyReply, buildSafetyDetectedEvent };
