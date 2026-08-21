const plural = (count, singular, pluralForm) => `${count} ${count > 1 ? pluralForm : singular}`;

export function buildTalkPreview({ context, goalLabel } = {}) {
  const summary = context?.behaviorSummary || {}; const personal = context?.personalContext || {}; const items = [];
  if (goalLabel) items.push(`Ton objectif : ${goalLabel}`);
  if (summary.topTarget?.value) items.push(`Élément suivi le plus fréquent : ${summary.topTarget.value}`);
  if (summary.topTrigger?.value) items.push(`Déclencheur fréquent : ${summary.topTrigger.value}`);
  if (summary.topEmotion?.value) items.push(`Émotion fréquente : ${summary.topEmotion.value}`);
  if (summary.topTimePeriod?.value) items.push(`Moment fréquent : ${summary.topTimePeriod.value}`);
  if (summary.topResistedStrategy?.value) items.push(`Stratégie souvent utilisée : ${summary.topResistedStrategy.value}`);
  if (personal.motivations?.length) items.push(`${plural(personal.motivations.length, 'motivation personnelle enregistrée', 'motivations personnelles enregistrées')}`);
  if (personal.importantPeople?.length) items.push(`${plural(personal.importantPeople.length, 'personne importante enregistrée', 'personnes importantes enregistrées')}`);
  return items;
}
