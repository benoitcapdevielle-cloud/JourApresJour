export const CONVERSATION_TRACKING_MODES = Object.freeze({ CONFIRM: 'confirm', AUTOMATIC: 'automatic', DISABLED: 'disabled' });
export const DEFAULT_CONVERSATION_TRACKING_MODE = CONVERSATION_TRACKING_MODES.AUTOMATIC;
export const EXTRACTION_EVENT_TYPES = Object.freeze(['consumption', 'craving_resisted']);
export const OCCURRED_AT_PRECISIONS = Object.freeze(['exact', 'approximate', 'date_only']);
export const MIN_CONFIRMATION_CONFIDENCE = 0.75;
export const MIN_ENRICHMENT_CONFIDENCE = 0.85;
export const MIN_AUTO_TRACKING_CONFIDENCE = 0.9;
const TARGET_CATEGORIES = ['substance', 'digital', 'behavior'];
const MEASUREMENT_FIELDS = ['quantity', 'durationMinutes', 'episodes', 'moneySpent'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const cleanList = (value) => Array.isArray(value) ? [...new Set(value.map(cleanText).filter(Boolean))] : [];
const DETAIL_FIELDS = ['socialContext', 'timeOfDay', 'location', 'circumstances', 'immediateConsequence', 'explicitIntention', 'feelingAfter'];
const BLOCKING_MISSING_FIELDS = ['eventType', 'targets', 'type', 'quantity', 'unit', 'durationMinutes', 'episodes', 'moneySpent', 'occurredAt'];

const normalizeConversationTarget = (target) => {
  if (!isObject(target) || !TARGET_CATEGORIES.includes(target.category) || !cleanText(target.type)) return null;
  const source = isObject(target.measurement) ? target.measurement : {};
  const measurement = { source: 'conversation' };
  MEASUREMENT_FIELDS.forEach((field) => {
    const number = Number(source[field]);
    if (source[field] !== '' && source[field] !== null && source[field] !== undefined && Number.isFinite(number) && number >= 0) measurement[field] = number;
  });
  if (cleanText(source.unit)) measurement.unit = cleanText(source.unit);
  return { category: target.category, type: cleanText(target.type), measurement };
};

export function validateEventExtraction(value) {
  const errors = [];
  if (!isObject(value)) return { valid: false, errors: ['Extraction must be an object.'] };
  if (typeof value.detected !== 'boolean') errors.push('detected must be a boolean.');
  if (!Number.isFinite(Number(value.confidence)) || Number(value.confidence) < 0 || Number(value.confidence) > 1) errors.push('confidence must be between 0 and 1.');
  if (value.detected === true && !EXTRACTION_EVENT_TYPES.includes(value.eventType)) errors.push('Unsupported eventType.');
  if (value.detected === true && (!Array.isArray(value.targets) || value.targets.some((target) => !normalizeConversationTarget(target)))) errors.push('targets must contain only valid targets.');
  if (value.craving !== null && value.craving !== undefined && (!Number.isInteger(Number(value.craving)) || Number(value.craving) < 0 || Number(value.craving) > 10)) errors.push('craving must be an integer from 0 to 10.');
  if (value.occurredAt && Number.isNaN(Date.parse(value.occurredAt))) errors.push('occurredAt must be a valid date.');
  if (value.occurredAtPrecision !== null && value.occurredAtPrecision !== undefined && !OCCURRED_AT_PRECISIONS.includes(value.occurredAtPrecision)) errors.push('Unsupported occurredAtPrecision.');
  return { valid: errors.length === 0, errors };
}

export function normalizeEventExtraction(value) {
  if (!validateEventExtraction(value).valid) return null;
  const targets = Array.isArray(value.targets) ? value.targets.map(normalizeConversationTarget).filter(Boolean) : [];
  const normalized = {
    detected: value.detected, confidence: Number(value.confidence), eventType: value.detected ? value.eventType : null, targets,
    // Compatibilité avec un backend déjà lancé avant l'ajout du drapeau explicite :
    // les garde-fous locaux restent obligatoires (confiance, date, target, ambiguïtés).
    autoSaveEligible: value.autoSaveEligible === true || value.autoSaveEligible === undefined,
    craving: value.craving === null || value.craving === undefined ? null : Number(value.craving), emotion: cleanText(value.emotion) || null,
    context: cleanText(value.context) || null, triggers: cleanList(value.triggers), strategies: cleanList(value.strategies),
    occurredAt: value.occurredAt ? new Date(value.occurredAt).toISOString() : null,
    occurredAtPrecision: value.occurredAt ? (OCCURRED_AT_PRECISIONS.includes(value.occurredAtPrecision) ? value.occurredAtPrecision : 'approximate') : null,
    missingFields: cleanList(value.missingFields), ambiguity: cleanList(value.ambiguity),
  };
  normalized.conversationEventId = cleanText(value.conversationEventId) || null;
  normalized.trackingStatus = ['unconfirmed', 'tracked', 'dismissed'].includes(value.trackingStatus) ? value.trackingStatus : 'unconfirmed';
  normalized.safetyRelevant = value.safetyRelevant === true;
  normalized.relatedSafetyContextId = cleanText(value.relatedSafetyContextId) || null;
  normalized.trackerEventId = cleanText(value.trackerEventId) || null;
  normalized.source = value.source === 'tracker' ? 'tracker' : 'conversation_pending';
  DETAIL_FIELDS.forEach((field) => { normalized[field] = cleanText(value[field]) || null; });
  return normalized;
}

export function isAutoTrackableEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  return Boolean(extraction?.autoSaveEligible
    && extraction.confidence >= MIN_AUTO_TRACKING_CONFIDENCE
    && isConfirmableEventSuggestion(extraction));
}

export function getAutoSaveDecision(value, message = '', { continuation = false } = {}) {
  const extraction = normalizeEventExtraction(value);
  const text = cleanText(message).toLocaleLowerCase('fr-FR');
  const reasons = [];
  if (!extraction?.detected) reasons.push('not_detected');
  if (extraction && extraction.confidence < MIN_AUTO_TRACKING_CONFIDENCE) reasons.push('low_confidence');
  if (extraction && !isConfirmableEventSuggestion(extraction)) reasons.push('incomplete_or_ambiguous');
  if (!continuation && !/\b(?:je|j['’])\b/i.test(text)) reasons.push('not_first_person');
  if (/\b(?:je vais|j['’]irai|demain|plus tard|ce soir je vais|si je)\b/i.test(text)) reasons.push('future_or_conditional');
  if (/\b(?:je n['’]ai rien|je n['’]en ai pas|pas (?:bu|fumé|pris|consommé)|sans (?:boire|fumer|prendre|consommer))\b/i.test(text)) reasons.push('negation');
  if (/\b(?:peut[- ]?être|probablement|2 ou 3|trois ou quatre|je ne sais pas|j['’]sais pas)\b/i.test(text)) reasons.push('uncertain');
  const explicitImmediate = /\b(?:je viens de|j['’]ai|j['’]en ai|j['’]avais|j['’]étais|maintenant|à l['’]instant)\b/i.test(text);
  if (!continuation && !explicitImmediate && extraction?.autoSaveEligible !== true) reasons.push('occurrence_not_explicit');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function alignConversationEventToDeviceTime(value, message, now = new Date()) {
  const extraction = normalizeEventExtraction(value);
  if (!extraction?.detected || Number.isNaN(now.getTime())) return extraction;
  const text = cleanText(message).toLocaleLowerCase('fr-FR');
  const explicitTime = /\b(hier|avant-hier|demain|ce matin|cet apr[eè]s-midi|ce soir|cette nuit|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}\s*(?:h|:))\b/i.test(text);
  const immediate = /\b(je viens de|maintenant|[àa] l['’]instant|tout de suite)\b/i.test(text);
  if (!explicitTime || immediate) return { ...extraction, occurredAt: now.toISOString(), occurredAtPrecision: immediate ? 'exact' : 'approximate' };
  return extraction;
}

export function isConfirmableEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  return Boolean(extraction?.detected
    && extraction.confidence >= MIN_CONFIRMATION_CONFIDENCE
    && extraction.occurredAt
    && extraction.targets.length > 0
    && extraction.missingFields.every((field) => !BLOCKING_MISSING_FIELDS.includes(field))
    && extraction.ambiguity.length === 0);
}

export function toTrackerEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  if (!extraction?.detected) return null;
  const conversationDetails = Object.fromEntries(DETAIL_FIELDS.map((field) => [field, extraction[field]]).filter(([, detail]) => detail));
  return { eventType: extraction.eventType, date: extraction.occurredAt, targets: extraction.targets, craving: extraction.craving, emotion: extraction.emotion, context: extraction.context, triggers: extraction.triggers, strategies: extraction.strategies, conversationDetails, note: null };
}

export function createPendingEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  if (!extraction?.detected) return null;
  return { status: 'pending', requiresConfirmation: true, extraction, trackerEvent: toTrackerEventSuggestion(extraction) };
}

export function mergePendingConversationEvent(currentValue, updateValue) {
  const current = normalizeEventExtraction(currentValue);
  const update = normalizeEventExtraction(updateValue);
  if (!update?.detected) return current;
  if (!current?.detected || current.eventType !== update.eventType) return update;
  const currentTargets = new Set(current.targets.map(({ category, type }) => `${category}:${type}`));
  if (currentTargets.size && update.targets.length && update.targets.some(({ category, type }) => !currentTargets.has(`${category}:${type}`))) return update;
  const merged = { ...current, ...update };
  ['targets', 'triggers', 'strategies', 'missingFields', 'ambiguity'].forEach((field) => {
    if (!Array.isArray(update[field]) || update[field].length === 0) merged[field] = current[field];
  });
  ['craving', 'emotion', 'context', 'occurredAt', 'occurredAtPrecision', ...DETAIL_FIELDS].forEach((field) => {
    if (update[field] === null || update[field] === undefined || update[field] === '') merged[field] = current[field];
  });
  merged.confidence = Math.max(current.confidence, update.confidence);
  merged.conversationEventId = current.conversationEventId || update.conversationEventId;
  merged.trackingStatus = current.trackingStatus || update.trackingStatus || 'unconfirmed';
  merged.safetyRelevant = current.safetyRelevant || update.safetyRelevant;
  merged.relatedSafetyContextId = current.relatedSafetyContextId || update.relatedSafetyContextId;
  merged.trackerEventId = current.trackerEventId || update.trackerEventId;
  merged.source = current.source || update.source || 'conversation_pending';
  return normalizeEventExtraction(merged);
}

export function normalizeEventEnrichment(value, expectedEventId = null) {
  if (!isObject(value) || value.detected !== true || !cleanText(value.eventId)) return null;
  if (expectedEventId && cleanText(value.eventId) !== cleanText(expectedEventId)) return null;
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !isObject(value.updates)) return null;
  const updates = {};
  if (value.updates.craving !== null && value.updates.craving !== undefined) {
    const craving = Number(value.updates.craving);
    if (Number.isInteger(craving) && craving >= 0 && craving <= 10) updates.craving = craving;
  }
  ['emotion', 'context'].forEach((field) => { if (cleanText(value.updates[field])) updates[field] = cleanText(value.updates[field]); });
  if (cleanText(value.updates.date) && !Number.isNaN(Date.parse(value.updates.date))) updates.date = new Date(value.updates.date).toISOString();
  ['triggers', 'strategies'].forEach((field) => { const list = cleanList(value.updates[field]); if (list.length) updates[field] = list; });
  if (Array.isArray(value.updates.targets) && value.updates.targets.length) {
    const targets = value.updates.targets.map(normalizeConversationTarget).filter(Boolean);
    if (targets.length === value.updates.targets.length) updates.targets = targets;
  }
  if (isObject(value.updates.conversationDetails)) {
    const details = Object.fromEntries(DETAIL_FIELDS.map((field) => [field, cleanText(value.updates.conversationDetails[field])]).filter(([, detail]) => detail));
    if (Object.keys(details).length) updates.conversationDetails = details;
  }
  const ambiguity = cleanList(value.ambiguity);
  return { detected: true, eventId: cleanText(value.eventId), confidence, updates, ambiguity };
}

export function isApplicableEventEnrichment(value, expectedEventId) {
  const enrichment = normalizeEventEnrichment(value, expectedEventId);
  return Boolean(enrichment && enrichment.confidence >= MIN_ENRICHMENT_CONFIDENCE && enrichment.ambiguity.length === 0 && Object.keys(enrichment.updates).length > 0);
}
