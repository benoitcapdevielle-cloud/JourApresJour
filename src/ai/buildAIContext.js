import { buildBehaviorSummary } from '../utils/behaviorAnalysis';

const safeList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 5) : [];
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
  return context;
}
