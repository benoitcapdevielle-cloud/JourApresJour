export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const stepValue = (value, delta, minimum, maximum) => clamp(Number(value) + delta, minimum, maximum);
export const durationToMinutes = (hours, minutes) => clamp(Number(hours) || 0, 0, 24) * 60 + clamp(Number(minutes) || 0, 0, 59);
export const splitDuration = (totalMinutes) => ({ hours: Math.floor((Number(totalMinutes) || 0) / 60), minutes: (Number(totalMinutes) || 0) % 60 });
export const getTimeParts = (dateValue) => { const date = new Date(dateValue); const safeDate = Number.isNaN(date.getTime()) ? new Date() : date; return { hours: safeDate.getHours(), minutes: safeDate.getMinutes() }; };
export const normalizeWheelMinutes = (minutes) => clamp(Math.round((Number(minutes) || 0) / 5) * 5, 0, 55);
export const applyTimeToDate = (dateValue, hours, minutes) => { const date = new Date(dateValue); const safeDate = Number.isNaN(date.getTime()) ? new Date() : date; safeDate.setHours(clamp(Number(hours), 0, 23), clamp(Number(minutes), 0, 59)); return safeDate.toISOString(); };
export const usesIntegerStepper = (unit) => ['verre(s)', 'joint(s)', 'prise(s)', 'cigarette(s)', 'puff(s)', 'comprimé(s)', 'unité(s)'].includes(unit);
