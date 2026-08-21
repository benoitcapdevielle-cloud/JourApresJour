import AsyncStorage from '@react-native-async-storage/async-storage';

export const PROFILE_STORAGE_KEY = 'jourApresJourProfileV1';
export const GOAL_OPTIONS = [
  { value: 'stop', label: 'Arrêter' }, { value: 'reduce', label: 'Réduire' },
  { value: 'understand', label: 'Comprendre ma consommation' }, { value: 'maintain', label: 'Maintenir mes progrès' },
  { value: 'undecided', label: 'Je ne sais pas encore' },
];
const VALID_GOALS = new Set(GOAL_OPTIONS.map(({ value }) => value));

export async function loadProfile() {
  const saved = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!saved) return { goal: null };
  try { const profile = JSON.parse(saved); return { ...profile, goal: VALID_GOALS.has(profile?.goal) ? profile.goal : null }; }
  catch { return { goal: null }; }
}
export async function saveGoal(goal) {
  if (!VALID_GOALS.has(goal)) throw new Error('Objectif invalide');
  const next = { ...await loadProfile(), goal };
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
