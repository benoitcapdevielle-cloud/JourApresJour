export const CONVERSATION_TRACKING_MODES = Object.freeze({ CONFIRM: 'confirm', AUTOMATIC: 'automatic', DISABLED: 'disabled' });
export const DEFAULT_CONVERSATION_TRACKING_MODE = CONVERSATION_TRACKING_MODES.CONFIRM;
export const EXTRACTION_EVENT_TYPES = Object.freeze(['consumption', 'craving_resisted']);
const TARGET_CATEGORIES = ['substance', 'digital', 'behavior'];
const MEASUREMENT_FIELDS = ['quantity', 'durationMinutes', 'episodes', 'moneySpent'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const cleanList = (value) => Array.isArray(value) ? [...new Set(value.map(cleanText).filter(Boolean))] : [];

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
  if (value.detected === true && (!Array.isArray(value.targets) || !value.targets.length || value.targets.some((target) => !normalizeConversationTarget(target)))) errors.push('At least one valid target is required.');
  if (value.craving !== null && value.craving !== undefined && (!Number.isInteger(Number(value.craving)) || Number(value.craving) < 0 || Number(value.craving) > 10)) errors.push('craving must be an integer from 0 to 10.');
  if (value.occurredAt && Number.isNaN(Date.parse(value.occurredAt))) errors.push('occurredAt must be a valid date.');
  return { valid: errors.length === 0, errors };
}

export function normalizeEventExtraction(value) {
  if (!validateEventExtraction(value).valid) return null;
  const targets = Array.isArray(value.targets) ? value.targets.map(normalizeConversationTarget).filter(Boolean) : [];
  return {
    detected: value.detected, confidence: Number(value.confidence), eventType: value.detected ? value.eventType : null, targets,
    craving: value.craving === null || value.craving === undefined ? null : Number(value.craving), emotion: cleanText(value.emotion) || null,
    context: cleanText(value.context) || null, triggers: cleanList(value.triggers), strategies: cleanList(value.strategies),
    occurredAt: value.occurredAt ? new Date(value.occurredAt).toISOString() : null, missingFields: cleanList(value.missingFields),
  };
}

export function toTrackerEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  if (!extraction?.detected) return null;
  return { eventType: extraction.eventType, date: extraction.occurredAt, targets: extraction.targets, craving: extraction.craving, emotion: extraction.emotion, context: extraction.context, triggers: extraction.triggers, strategies: extraction.strategies, note: null };
}

export function createPendingEventSuggestion(value) {
  const extraction = normalizeEventExtraction(value);
  if (!extraction?.detected) return null;
  return { status: 'pending', requiresConfirmation: true, extraction, trackerEvent: toTrackerEventSuggestion(extraction) };
}
