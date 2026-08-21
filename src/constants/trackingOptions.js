export const SCHEMA_VERSION = 3;
export const SUBSTANCES = ['Alcool', 'Cannabis', 'Cocaïne', 'Nicotine', 'Opioïdes', 'Amphétamines', 'MDMA', 'Kétamine', 'Autre'];
export const UNITS_BY_SUBSTANCE = {
  Alcool: ['verre(s)', 'cl'], Cannabis: ['joint(s)', 'gramme(s)'], Cocaïne: ['prise(s)', 'gramme(s)'],
  Nicotine: ['cigarette(s)', 'puff(s)'], Opioïdes: ['prise(s)'], Amphétamines: ['prise(s)', 'gramme(s)'],
  MDMA: ['comprimé(s)', 'prise(s)'], Kétamine: ['prise(s)', 'gramme(s)'], Autre: ['unité(s)', 'prise(s)', 'gramme(s)'],
};
export const EMOTIONS = ['Stress', 'Anxiété', 'Ennui', 'Colère', 'Tristesse', 'Joie'];
export const CONTEXTS = ['Seul', 'Avec des amis', 'Soirée', 'Après le travail', 'Avant de dormir', 'Autre'];
export const TRIGGER_OPTIONS = ['Stress', 'Fatigue', 'Conflit', 'Ennui', 'Solitude', 'Pression sociale', 'Disponibilité du produit', 'Habitude', 'Manque / craving', 'Événement positif', 'Autre'];
export const STRATEGY_OPTIONS = ['Attendre', 'Sortir marcher', 'Appeler quelqu’un', 'Parler à quelqu’un', 'Changer de lieu', 'Respirer', 'Sport', 'Manger', 'Dormir', 'Me distraire', 'Autre'];
export const CRAVING_LEVELS = Array.from({ length: 11 }, (_, index) => index);
