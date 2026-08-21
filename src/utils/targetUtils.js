export function formatDuration(totalMinutes) {
  const total = Number(totalMinutes); if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 60); const minutes = Math.round(total % 60);
  return [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ');
}
export function formatTargetMeasurements(target) {
  const measurement = target?.measurement || {}; const lines = [];
  if (measurement.quantity !== undefined && measurement.quantity !== null) {
    const unit = measurement.unit?.includes('(s)') ? measurement.unit.replace('(s)', Number(measurement.quantity) > 1 ? 's' : '') : measurement.unit;
    lines.push(`${measurement.quantity}${unit ? ` ${unit}` : ''}`);
  }
  const duration = formatDuration(measurement.durationMinutes); if (duration) lines.push(duration);
  if (measurement.moneySpent !== undefined && measurement.moneySpent !== null) lines.push(`${String(measurement.moneySpent).replace('.', ',')} € dépensés`);
  if (measurement.episodes !== undefined && measurement.episodes !== null) lines.push(`${measurement.episodes} épisode${measurement.episodes > 1 ? 's' : ''}`);
  return lines;
}
