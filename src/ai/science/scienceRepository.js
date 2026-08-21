export const SCIENTIFIC_TRUST_LEVELS = Object.freeze([
  'guideline', 'systematic_review', 'meta_analysis', 'randomized_trial', 'observational', 'expert_source',
]);

export const SCIENTIFIC_SOURCE_TYPES = Object.freeze([
  'guideline', 'journal_article', 'institutional_report', 'review', 'other',
]);

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';
const cleanList = (value) => Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];

export function normalizeScientificDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const document = {
    id: cleanText(value.id), title: cleanText(value.title), organization: cleanText(value.organization),
    authors: cleanList(value.authors), year: Number.isInteger(Number(value.year)) ? Number(value.year) : null,
    sourceType: cleanText(value.sourceType), url: cleanText(value.url), tags: cleanList(value.tags),
    text: cleanText(value.text), trustLevel: cleanText(value.trustLevel),
  };
  if (!document.id || !document.title || !document.text || !SCIENTIFIC_TRUST_LEVELS.includes(document.trustLevel)) return null;
  return document;
}

// Empty by design until a curated, attributable scientific corpus is supplied.
export function listScientificDocuments() { return []; }
export function getScientificDocumentById() { return null; }
