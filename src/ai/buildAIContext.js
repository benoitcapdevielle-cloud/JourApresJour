import { buildBehaviorSummary } from '../utils/behaviorAnalysis';

const safeList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 5) : [];
function buildRecentEvent(events) {
  const recent = [...events].filter((event) => event && !Number.isNaN(new Date(event.date).getTime())).sort((left, right) => new Date(right.date) - new Date(left.date))[0];
  if (!recent) return null;
  const compact = { type: recent.eventType, date: recent.date, craving: Number.isFinite(Number(recent.craving)) ? Number(recent.craving) : null, triggers: safeList(recent.triggers), strategies: safeList(recent.strategies) };
  return Object.fromEntries(Object.entries(compact).filter(([, value]) => value !== null && (!Array.isArray(value) || value.length)));
}
export function buildAIContext({ events = [], profile = {}, memories = {} } = {}) {
  const safeEvents = Array.isArray(events) ? events : [];
  const context = {
    goal: typeof profile?.goal === 'string' ? profile.goal : null,
    behaviorSummary: buildBehaviorSummary(safeEvents),
    personalContext: {
      firstName: typeof memories?.firstName === 'string' ? memories.firstName.trim() : '',
      motivations: safeList(memories?.motivations), importantPeople: safeList(memories?.importantPeople),
      riskSituations: safeList(memories?.riskSituations), helpfulStrategies: safeList(memories?.helpfulStrategies),
    },
  };
  const recentEvent = buildRecentEvent(safeEvents); if (recentEvent) context.recentEvent = recentEvent;
  return context;
}
