import { MIN_EVENTS_FOR_TRENDS } from './behaviorAnalysis';

const plural = (count, singular, pluralForm) => `${count} ${count > 1 ? pluralForm : singular}`;

export function buildTalkPreview({ context, goalLabel } = {}) {
  const summary = context?.behaviorSummary || {}; const personal = context?.personalContext || {}; const items = [];
  const enoughConsumption = Number(summary.consumptionEventCount) >= MIN_EVENTS_FOR_TRENDS; const enoughResisted = Number(summary.resistedEventCount) >= MIN_EVENTS_FOR_TRENDS;
  if (goalLabel) items.push(`Ton objectif : ${goalLabel}`);
  if ((enoughConsumption || enoughResisted) && summary.topTarget?.value) items.push(`Élément suivi le plus fréquent : ${summary.topTarget.value}`);
  if (enoughConsumption && summary.topTrigger?.value) items.push(`Déclencheur fréquent : ${summary.topTrigger.value}`);
  if (enoughConsumption && summary.topEmotion?.value) items.push(`Émotion fréquente : ${summary.topEmotion.value}`);
  if (enoughConsumption && summary.topTimePeriod?.value) items.push(`Moment fréquent : ${summary.topTimePeriod.value}`);
  if (enoughResisted && summary.topResistedStrategy?.value) items.push(`Stratégie souvent utilisée : ${summary.topResistedStrategy.value}`);
  if (personal.motivations?.length) items.push(`${plural(personal.motivations.length, 'motivation personnelle enregistrée', 'motivations personnelles enregistrées')}`);
  if (personal.importantPeople?.length) items.push(`${plural(personal.importantPeople.length, 'personne importante enregistrée', 'personnes importantes enregistrées')}`);
  return items;
}

export function hasEnoughBehaviorData(context) {
  const summary = context?.behaviorSummary || {};
  return Number(summary.consumptionEventCount) >= MIN_EVENTS_FOR_TRENDS || Number(summary.resistedEventCount) >= MIN_EVENTS_FOR_TRENDS;
}
