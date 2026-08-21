export const SCHEMA_VERSION = 4;
export const TARGET_CATEGORIES = [{ value: 'substance', label: 'Substances' }, { value: 'digital', label: 'Numérique' }, { value: 'behavior', label: 'Comportements' }];
const quantity = (units) => ({ key: 'quantity', label: 'Quantité', required: true, units });
const duration = (required = true) => ({ key: 'durationMinutes', label: 'Temps passé', required });
const money = (required = true) => ({ key: 'moneySpent', label: 'Argent dépensé', required });
const episodes = (required = true) => ({ key: 'episodes', label: 'Nombre d’épisodes', required });
export const TRACKED_TARGETS = [
  { category: 'substance', type: 'Alcool', measurements: [quantity(['verre(s)', 'cl'])] },
  { category: 'substance', type: 'Cannabis', measurements: [quantity(['joint(s)', 'gramme(s)'])] },
  { category: 'substance', type: 'Cocaïne', measurements: [quantity(['prise(s)', 'gramme(s)'])] },
  { category: 'substance', type: 'Nicotine', measurements: [quantity(['cigarette(s)', 'puff(s)'])] },
  { category: 'substance', type: 'Opioïdes', measurements: [quantity(['prise(s)'])] },
  { category: 'substance', type: 'Amphétamines', measurements: [quantity(['prise(s)', 'gramme(s)'])] },
  { category: 'substance', type: 'MDMA', measurements: [quantity(['comprimé(s)', 'prise(s)'])] },
  { category: 'substance', type: 'Kétamine', measurements: [quantity(['prise(s)', 'gramme(s)'])] },
  { category: 'substance', type: 'Autre substance', custom: true, measurements: [quantity(['unité(s)', 'prise(s)', 'gramme(s)'])] },
  ...['Smartphone', 'Réseaux sociaux', 'TikTok', 'Instagram', 'YouTube / vidéos', 'Streaming', 'Internet / navigation', 'Pornographie'].map((type) => ({ category: 'digital', type, measurements: [duration()] })),
  { category: 'behavior', type: 'Jeux vidéo', measurements: [duration()] },
  { category: 'behavior', type: 'Jeux d’argent / paris', measurements: [duration(false), money(false), episodes(false)] },
  { category: 'behavior', type: 'Achats compulsifs', measurements: [money(), episodes(false)] },
  { category: 'behavior', type: 'Travail', measurements: [duration()] },
  { category: 'behavior', type: 'Comportement sexuel compulsif', measurements: [episodes(), duration(false)] },
  { category: 'behavior', type: 'Autre comportement', custom: true, measurements: [episodes(false), duration(false)] },
];
export const getTargetsByCategory = (category) => TRACKED_TARGETS.filter((target) => target.category === category);
export const findTargetConfig = (category, type) => TRACKED_TARGETS.find((target) => target.category === category && target.type === type) || TRACKED_TARGETS.find((target) => target.category === category && target.custom) || { category, type, measurements: [] };
export const SUBSTANCES = getTargetsByCategory('substance').map(({ type }) => type);
export const UNITS_BY_SUBSTANCE = Object.fromEntries(getTargetsByCategory('substance').map(({ type, measurements }) => [type, measurements[0]?.units || []]));
export const EMOTIONS = ['Stress', 'Anxiété', 'Ennui', 'Colère', 'Tristesse', 'Joie'];
export const CONTEXTS = ['Seul', 'Avec des amis', 'Soirée', 'Après le travail', 'Avant de dormir', 'Autre'];
export const TRIGGER_OPTIONS = ['Stress', 'Fatigue', 'Conflit', 'Ennui', 'Solitude', 'Pression sociale', 'Disponibilité du produit', 'Habitude', 'Manque / craving', 'Événement positif', 'Autre'];
export const STRATEGY_OPTIONS = ['Attendre', 'Sortir marcher', 'Appeler quelqu’un', 'Parler à quelqu’un', 'Changer de lieu', 'Respirer', 'Sport', 'Manger', 'Dormir', 'Me distraire', 'Autre'];
export const CRAVING_LEVELS = Array.from({ length: 11 }, (_, index) => index);
