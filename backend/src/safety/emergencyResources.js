const EMERGENCY_RESOURCES = Object.freeze({
  FR: Object.freeze({
    countryCode: 'FR',
    countryName: 'France',
    medicalEmergency: '15',
    generalEmergency: '112',
    accessibleEmergency: '114',
    sourceUrl: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33954',
  }),
});

const normalizeCountryCode = (value) => typeof value === 'string' ? value.trim().toUpperCase() : '';

function getEmergencyResources(countryCode) {
  return EMERGENCY_RESOURCES[normalizeCountryCode(countryCode)] || null;
}

function buildEmergencyInstructions(resources) {
  if (!resources) return 'Aucune ressource d\'urgence locale n\'est configurée. En cas de danger immédiat, demande dans quel pays se trouve la personne et invite-la à contacter les services d\'urgence locaux. N\'invente jamais de numéro.';
  return `Ressources d'urgence vérifiées pour ${resources.countryName} : urgence médicale ${resources.medicalEmergency}, urgence générale ${resources.generalEmergency}, urgence accessible par écrit/visio ${resources.accessibleEmergency}. Utilise uniquement ces numéros si la personne se trouve bien dans ce pays. Si sa localisation est incertaine, vérifie le pays avant de donner un numéro. N'invente jamais de numéro.`;
}

module.exports = { EMERGENCY_RESOURCES, getEmergencyResources, buildEmergencyInstructions };
