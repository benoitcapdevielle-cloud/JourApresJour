const DAY_MS = 86400000;
const validDate = (event) => { const date = new Date(event?.date); return Number.isNaN(date.getTime()) ? null : date; };
const since = (events, days, now) => { const end = new Date(now); const start = new Date(end.getTime() - days * DAY_MS); return events.filter((event) => { const date = validDate(event); return date && date > start && date <= end; }); };
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const topValue = (values) => { const counts = new Map(); values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1)); let top = null; counts.forEach((count, value) => { if (!top || count > top.count) top = { value, count }; }); return top; };
const average = (events) => { const values = events.map(({ craving }) => Number(craving)).filter(Number.isFinite); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null; };

export function getTimePeriod(dateValue) {
  const date = new Date(dateValue); if (Number.isNaN(date.getTime())) return null;
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Matin'; if (hour >= 12 && hour < 18) return 'Midi / après-midi'; if (hour >= 18 && hour < 23) return 'Soir'; return 'Nuit';
}
export function buildAntiZeroStats(events, now = new Date()) {
  const consumptions = events.filter(({ eventType }) => eventType === 'consumption');
  const end = new Date(now); const currentStart = new Date(end); currentStart.setHours(0, 0, 0, 0); currentStart.setDate(currentStart.getDate() - 6);
  const previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
  const inRange = (event, start, rangeEnd, includeEnd = true) => { const date = validDate(event); return date && date >= start && (includeEnd ? date <= rangeEnd : date < rangeEnd); };
  const current = consumptions.filter((event) => inRange(event, currentStart, end)); const previous = consumptions.filter((event) => inRange(event, previousStart, currentStart, false));
  const days7 = new Set(current.map((event) => dayKey(validDate(event)))).size;
  const start30 = new Date(end); start30.setHours(0, 0, 0, 0); start30.setDate(start30.getDate() - 29);
  const days30 = new Set(consumptions.filter((event) => inRange(event, start30, end)).map((event) => dayKey(validDate(event)))).size;
  const resisted = since(events.filter(({ eventType }) => eventType === 'craving_resisted'), 30, now).length;
  const difference = current.length - previous.length;
  return { masteredDays7d: 7 - days7, masteredDays30d: 30 - days30, resistedCount30d: resisted, consumptionCount7d: current.length, previousConsumptionCount7d: previous.length, consumptionDifference7d: difference,
    evolutionText: difference === 0 ? 'Fréquence stable par rapport à la semaine précédente' : `${Math.abs(difference)} consommation${Math.abs(difference) > 1 ? 's' : ''} de ${difference < 0 ? 'moins' : 'plus'} que la semaine précédente` };
}
export function buildBehaviorSummary(events, now = new Date()) {
  const consumption = events.filter(({ eventType }) => eventType === 'consumption'); const resisted = events.filter(({ eventType }) => eventType === 'craving_resisted');
  const polyCount = consumption.filter(({ substances = [] }) => substances.length > 1).length;
  return { consumptionCount30d: since(consumption, 30, now).length, resistedCount30d: since(resisted, 30, now).length, consumptionEventCount: consumption.length, resistedEventCount: resisted.length,
    averageConsumptionCraving: average(consumption), averageResistedCraving: average(resisted), topSubstance: topValue(consumption.flatMap(({ substances = [] }) => substances.map(({ name }) => name))),
    topTrigger: topValue(consumption.flatMap(({ triggers = [] }) => triggers)), topEmotion: topValue(consumption.map(({ emotion }) => emotion)), topContext: topValue(consumption.map(({ context }) => context)),
    topTimePeriod: topValue(consumption.map(({ date }) => getTimePeriod(date))), polyConsumptionRate: consumption.length ? Math.round(polyCount / consumption.length * 100) : null,
    topResistedStrategy: topValue(resisted.flatMap(({ strategies = [] }) => strategies)) };
}
