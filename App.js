import { StatusBar } from 'expo-status-bar';

import {
  StyleSheet,
  Text,
  View,
  Alert,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';

import { useState, useEffect } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';


// ======================================================
// CONFIGURATION
// ======================================================

const SCHEMA_VERSION = 3;

const STORAGE_KEY = 'jourApresJourEventsV2';
const LEGACY_STORAGE_KEY = 'consumptionEvents';
const PRIVACY_KEY = 'jourApresJourPrivacyV1';

const DEFAULT_PRIVACY_SETTINGS = {
  aiEnabled: false,
  aiMemoryEnabled: false,
  aiConsentGivenAt: null,
};


// ======================================================
// SUBSTANCES
// ======================================================

const substances = [
  'Alcool',
  'Cannabis',
  'Cocaïne',
  'Nicotine',
  'Opioïdes',
  'Amphétamines',
  'MDMA',
  'Kétamine',
  'Autre',
];

const unitsBySubstance = {
  Alcool: ['verre(s)', 'cl'],
  Cannabis: ['joint(s)', 'gramme(s)'],
  Cocaïne: ['prise(s)', 'gramme(s)'],
  Nicotine: ['cigarette(s)', 'puff(s)'],
  Opioïdes: ['prise(s)'],
  Amphétamines: ['prise(s)', 'gramme(s)'],
  MDMA: ['comprimé(s)', 'prise(s)'],
  Kétamine: ['prise(s)', 'gramme(s)'],
  Autre: ['unité(s)', 'prise(s)', 'gramme(s)'],
};


// ======================================================
// COMPORTEMENT
// ======================================================

const emotions = [
  'Stress',
  'Anxiété',
  'Ennui',
  'Colère',
  'Tristesse',
  'Joie',
];

const contexts = [
  'Seul',
  'Avec des amis',
  'Soirée',
  'Après le travail',
  'Avant de dormir',
  'Autre',
];

const triggerOptions = [
  'Stress',
  'Fatigue',
  'Conflit',
  'Ennui',
  'Solitude',
  'Pression sociale',
  'Disponibilité du produit',
  'Habitude',
  'Manque / craving',
  'Événement positif',
  'Autre',
];

const strategyOptions = [
  'Attendre',
  'Sortir marcher',
  'Appeler quelqu’un',
  'Parler à quelqu’un',
  'Changer de lieu',
  'Respirer',
  'Sport',
  'Manger',
  'Dormir',
  'Me distraire',
  'Autre',
];


// ======================================================
// COMPATIBILITÉ ANCIENNES DONNÉES
// ======================================================

const normalizeEvent = (event, index) => {
  if (Array.isArray(event.substances)) {
    return {
      ...event,
      schemaVersion: SCHEMA_VERSION,
      eventType: event.eventType || 'consumption',
      triggers: Array.isArray(event.triggers)
        ? event.triggers
        : [],
      strategies: Array.isArray(event.strategies)
        ? event.strategies
        : [],
    };
  }

  return {
    schemaVersion: SCHEMA_VERSION,

    id:
      event.id ||
      `${Date.now()}-${index}`,

    eventType: 'consumption',

    date:
      event.date ||
      new Date().toISOString(),

    substances: event.substance
      ? [
          {
            name: event.substance,
            quantity:
              event.quantity !== undefined
                ? event.quantity
                : null,
            unit:
              event.unit || null,
          },
        ]
      : [],

    craving:
      event.craving !== undefined
        ? event.craving
        : null,

    emotion:
      event.emotion || null,

    context:
      event.context || null,

    triggers:
      Array.isArray(event.triggers)
        ? event.triggers
        : [],

    strategies: [],

    note:
      event.note || null,
  };
};


// ======================================================
// APPLICATION
// ======================================================

export default function App() {
  const [screen, setScreen] = useState('home');

  const [events, setEvents] = useState([]);

  const [isLoaded, setIsLoaded] = useState(false);

  const [eventType, setEventType] =
    useState('consumption');

  const [editingId, setEditingId] =
    useState(null);

  const [selectedSubstances, setSelectedSubstances] =
    useState([]);

  const [pendingSubstance, setPendingSubstance] =
    useState('');

  const [customSubstance, setCustomSubstance] =
    useState('');

  const [quantity, setQuantity] =
    useState('');

  const [unit, setUnit] =
    useState('');

  const [craving, setCraving] =
    useState('');

  const [emotion, setEmotion] =
    useState('');

  const [context, setContext] =
    useState('');

  const [triggers, setTriggers] =
    useState([]);

  const [strategies, setStrategies] =
    useState([]);

  const [note, setNote] =
    useState('');

  const [flashMessage, setFlashMessage] =
    useState('');


  // ====================================================
  // CHARGEMENT
  // ====================================================

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveEvents(events);
    }
  }, [events, isLoaded]);


  const loadData = async () => {
    try {
      let savedEvents =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      if (!savedEvents) {
        savedEvents =
          await AsyncStorage.getItem(
            LEGACY_STORAGE_KEY
          );
      }

      if (savedEvents) {
        const parsed =
          JSON.parse(savedEvents);

        const normalized =
          parsed.map(
            (event, index) =>
              normalizeEvent(
                event,
                index
              )
          );

        setEvents(normalized);
      }

      const privacy =
        await AsyncStorage.getItem(
          PRIVACY_KEY
        );

      if (!privacy) {
        await AsyncStorage.setItem(
          PRIVACY_KEY,
          JSON.stringify(
            DEFAULT_PRIVACY_SETTINGS
          )
        );
      }
    } catch (error) {
      console.error(
        'Erreur de chargement :',
        error
      );
    } finally {
      setIsLoaded(true);
    }
  };


  const saveEvents = async (
    eventsToSave
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          eventsToSave
        )
      );
    } catch (error) {
      console.error(
        'Erreur de sauvegarde :',
        error
      );
    }
  };


  // ====================================================
  // FORMULAIRE
  // ====================================================

  const resetForm = () => {
    setEditingId(null);

    setSelectedSubstances([]);
    setPendingSubstance('');
    setCustomSubstance('');
    setQuantity('');
    setUnit('');

    setCraving('');
    setEmotion('');
    setContext('');

    setTriggers([]);
    setStrategies([]);

    setNote('');
  };


  const openConsumptionForm = () => {
    resetForm();

    setEventType(
      'consumption'
    );

    setScreen('form');
  };


  const openCravingForm = () => {
    resetForm();

    setEventType(
      'craving_resisted'
    );

    setScreen('form');
  };


  const changeEventType = (
    newType
  ) => {
    if (newType === eventType) {
      return;
    }

    setEventType(newType);

    setSelectedSubstances([]);
    setPendingSubstance('');
    setCustomSubstance('');
    setQuantity('');
    setUnit('');
    setStrategies([]);
  };


  // ====================================================
  // SUBSTANCES
  // ====================================================

  const choosePendingSubstance = (
    item
  ) => {
    setPendingSubstance(item);

    setQuantity('');
    setUnit('');

    if (item !== 'Autre') {
      setCustomSubstance('');
    }
  };


  const addSubstance = () => {
    if (
      pendingSubstance === ''
    ) {
      Alert.alert(
        'Substance',
        'Choisis une substance.'
      );

      return;
    }

    let finalName =
      pendingSubstance;

    if (
      pendingSubstance === 'Autre'
    ) {
      finalName =
        customSubstance.trim();

      if (finalName === '') {
        Alert.alert(
          'Substance',
          'Indique le nom de la substance.'
        );

        return;
      }
    }

    const alreadyExists =
      selectedSubstances.some(
        (item) =>
          item.name.toLowerCase() ===
          finalName.toLowerCase()
      );

    if (alreadyExists) {
      Alert.alert(
        'Déjà ajoutée',
        'Cette substance est déjà présente.'
      );

      return;
    }

    if (
      eventType ===
      'consumption'
    ) {
      const normalizedQuantity =
        quantity.replace(',', '.');

      const quantityNumber =
        Number(
          normalizedQuantity
        );

      if (
        quantity === '' ||
        Number.isNaN(
          quantityNumber
        ) ||
        quantityNumber <= 0
      ) {
        Alert.alert(
          'Quantité',
          'Indique une quantité supérieure à 0.'
        );

        return;
      }

      if (unit === '') {
        Alert.alert(
          'Unité',
          'Choisis une unité.'
        );

        return;
      }

      setSelectedSubstances(
        (current) => [
          ...current,
          {
            name: finalName,
            quantity:
              quantityNumber,
            unit,
          },
        ]
      );
    } else {
      setSelectedSubstances(
        (current) => [
          ...current,
          {
            name: finalName,
            quantity: null,
            unit: null,
          },
        ]
      );
    }

    setPendingSubstance('');
    setCustomSubstance('');
    setQuantity('');
    setUnit('');
  };


  const removeSubstance = (
    name
  ) => {
    setSelectedSubstances(
      (current) =>
        current.filter(
          (item) =>
            item.name !== name
        )
    );
  };


  // ====================================================
  // SÉLECTIONS MULTIPLES
  // ====================================================

  const toggleTrigger = (
    item
  ) => {
    setTriggers((current) => {
      if (
        current.includes(item)
      ) {
        return current.filter(
          (value) =>
            value !== item
        );
      }

      return [
        ...current,
        item,
      ];
    });
  };


  const toggleStrategy = (
    item
  ) => {
    setStrategies(
      (current) => {
        if (
          current.includes(item)
        ) {
          return current.filter(
            (value) =>
              value !== item
          );
        }

        return [
          ...current,
          item,
        ];
      }
    );
  };


  // ====================================================
  // SAUVEGARDE
  // ====================================================

  const saveEvent = () => {
    if (
      selectedSubstances.length ===
      0
    ) {
      Alert.alert(
        'Substance',
        eventType ===
        'consumption'
          ? 'Ajoute au moins une substance consommée.'
          : 'Indique la substance concernée par cette envie.'
      );

      return;
    }

    if (craving === '') {
      Alert.alert(
        'Niveau d’envie',
        'Choisis un niveau entre 0 et 10.'
      );

      return;
    }

    const eventData = {
      schemaVersion:
        SCHEMA_VERSION,

      id:
        editingId ||
        Date.now().toString(),

      eventType,

      date:
        editingId
          ? events.find(
              (event) =>
                event.id ===
                editingId
            )?.date ||
            new Date().toISOString()
          : new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

      substances:
        selectedSubstances,

      craving:
        Number(craving),

      emotion:
        emotion || null,

      context:
        context || null,

      triggers,

      strategies:
        eventType ===
        'craving_resisted'
          ? strategies
          : [],

      note:
        note.trim() === ''
          ? null
          : note.trim(),
    };

    if (editingId) {
      setEvents(
        (current) =>
          current.map(
            (event) =>
              event.id ===
              editingId
                ? eventData
                : event
          )
      );

      setFlashMessage(
        'Entrée modifiée.'
      );
    } else {
      setEvents(
        (current) => [
          ...current,
          eventData,
        ]
      );

      if (
        eventType ===
        'craving_resisted'
      ) {
        setFlashMessage(
          "Tu as traversé cette envie sans consommer. Ce qui t’a aidé aujourd’hui pourra devenir une ressource pour les prochaines fois."
        );
      } else {
        setFlashMessage(
          "Cette consommation n’efface pas tes progrès. On continue, sans jugement."
        );
      }
    }

    resetForm();

    setScreen('home');
  };


  // ====================================================
  // MODIFIER
  // ====================================================

  const editEvent = (
    event
  ) => {
    setEditingId(
      event.id
    );

    setEventType(
      event.eventType
    );

    setSelectedSubstances(
      event.substances || []
    );

    setPendingSubstance('');
    setCustomSubstance('');
    setQuantity('');
    setUnit('');

    setCraving(
      event.craving !== null &&
      event.craving !== undefined
        ? event.craving.toString()
        : ''
    );

    setEmotion(
      event.emotion || ''
    );

    setContext(
      event.context || ''
    );

    setTriggers(
      Array.isArray(
        event.triggers
      )
        ? event.triggers
        : []
    );

    setStrategies(
      Array.isArray(
        event.strategies
      )
        ? event.strategies
        : []
    );

    setNote(
      event.note || ''
    );

    setScreen('form');
  };


  // ====================================================
  // SUPPRIMER
  // ====================================================

  const deleteEvent = (
    event
  ) => {
    Alert.alert(
      'Supprimer cette entrée ?',

      'Cette action est définitive.',

      [
        {
          text: 'Annuler',
          style: 'cancel',
        },

        {
          text: 'Supprimer',

          style: 'destructive',

          onPress: () => {
            setEvents(
              (current) =>
                current.filter(
                  (item) =>
                    item.id !==
                    event.id
                )
            );
          },
        },
      ]
    );
  };


  // ====================================================
  // DONNÉES TEST
  // ====================================================

  const deleteTestData = () => {
    Alert.alert(
      'Effacer toutes les données ?',

      'Toutes les entrées enregistrées sur ce téléphone seront supprimées.',

      [
        {
          text: 'Annuler',
          style: 'cancel',
        },

        {
          text: 'Effacer',

          style: 'destructive',

          onPress: async () => {
            await AsyncStorage.removeItem(
              STORAGE_KEY
            );

            await AsyncStorage.removeItem(
              LEGACY_STORAGE_KEY
            );

            setEvents([]);

            setFlashMessage('');

            resetForm();
          },
        },
      ]
    );
  };


  // ====================================================
  // STATS ACCUEIL
  // ====================================================

  const consumptionCount =
    events.filter(
      (event) =>
        event.eventType ===
        'consumption'
    ).length;


  const resistedCount =
    events.filter(
      (event) =>
        event.eventType ===
        'craving_resisted'
    ).length;


  const recentEvents =
    [...events].sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    );


  // ====================================================
  // CHARGEMENT
  // ====================================================

  if (!isLoaded) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <Text>
          Chargement...
        </Text>
      </View>
    );
  }


  // ====================================================
  // ACCUEIL
  // ====================================================

  if (screen === 'home') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
      >
        <Text style={styles.title}>
          Jour après Jour
        </Text>

        <Text
          style={
            styles.homeSubtitle
          }
        >
          Aujourd’hui, on fait quoi ?
        </Text>


        {flashMessage !== '' && (
          <View
            style={
              styles.messageCard
            }
          >
            <Text
              style={
                styles.messageText
              }
            >
              {flashMessage}
            </Text>
          </View>
        )}


        <Pressable
          style={
            styles.mainAction
          }
          onPress={
            openConsumptionForm
          }
        >
          <Text
            style={
              styles.mainActionTitle
            }
          >
            Enregistrer
          </Text>

          <Text
            style={
              styles.mainActionSubtitle
            }
          >
            J’ai consommé
          </Text>
        </Pressable>


        <Pressable
          style={
            styles.mainAction
          }
          onPress={
            openCravingForm
          }
        >
          <Text
            style={
              styles.mainActionTitle
            }
          >
            J’ai une envie
          </Text>

          <Text
            style={
              styles.mainActionSubtitle
            }
          >
            Faire le point sans avoir consommé
          </Text>
        </Pressable>


        <Pressable
          style={
            styles.talkAction
          }
          onPress={() =>
            setScreen('talk')
          }
        >
          <Text
            style={
              styles.talkActionTitle
            }
          >
            Parler
          </Text>

          <Text
            style={
              styles.talkActionSubtitle
            }
          >
            Comprendre ce qui se passe avec le compagnon Jour après Jour
          </Text>

          <View
            style={
              styles.comingSoonBadge
            }
          >
            <Text
              style={
                styles.comingSoonText
              }
            >
              Bientôt
            </Text>
          </View>
        </Pressable>


        <Text
          style={
            styles.sectionTitle
          }
        >
          Ton parcours
        </Text>


        <View
          style={
            styles.statsRow
          }
        >
          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {consumptionCount}
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              consommations
            </Text>
          </View>


          <View
            style={
              styles.statCard
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {resistedCount}
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              envies surmontées
            </Text>
          </View>
        </View>


        <Pressable
          style={
            styles.secondaryButton
          }
          onPress={() =>
            setScreen('history')
          }
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Voir l’historique
          </Text>
        </Pressable>


        <StatusBar style="auto" />
      </ScrollView>
    );
  }


  // ====================================================
  // PARLER
  // ====================================================

  if (screen === 'talk') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
      >
        <Pressable
          onPress={() =>
            setScreen('home')
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ← Retour
          </Text>
        </Pressable>


        <Text style={styles.title}>
          Parler
        </Text>


        <View
          style={
            styles.talkPlaceholder
          }
        >
          <Text
            style={
              styles.talkPlaceholderTitle
            }
          >
            Ton compagnon Jour après Jour
          </Text>

          <Text
            style={
              styles.talkPlaceholderText
            }
          >
            Ici, tu pourras parler librement de ce que tu ressens, de tes envies, de tes consommations et de ce qui se répète dans ton parcours.
          </Text>

          <Text
            style={
              styles.talkPlaceholderText
            }
          >
            Avec ton accord, l’IA pourra utiliser certaines informations de ton historique pour t’aider à mieux comprendre tes propres schémas.
          </Text>

          <Text
            style={
              styles.talkPrivacy
            }
          >
            Pour l’instant, aucune donnée n’est envoyée à une IA.
          </Text>
        </View>

        <StatusBar style="auto" />
      </ScrollView>
    );
  }


  // ====================================================
  // HISTORIQUE
  // ====================================================

  if (screen === 'history') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
      >
        <Pressable
          onPress={() =>
            setScreen('home')
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ← Retour
          </Text>
        </Pressable>


        <Text style={styles.title}>
          Historique
        </Text>


        {recentEvents.length ===
          0 && (
          <Text
            style={
              styles.emptyText
            }
          >
            Aucune entrée enregistrée.
          </Text>
        )}


        {recentEvents.map(
          (event) => (
            <View
              key={event.id}
              style={
                styles.historyCard
              }
            >
              <Text
                style={
                  event.eventType ===
                  'craving_resisted'
                    ? styles.resistedBadge
                    : styles.consumptionBadge
                }
              >
                {event.eventType ===
                'craving_resisted'
                  ? 'Envie surmontée'
                  : 'Consommation'}
              </Text>


              <Text
                style={
                  styles.historyDate
                }
              >
                {new Date(
                  event.date
                ).toLocaleString(
                  'fr-FR'
                )}
              </Text>


              {event.substances.map(
                (
                  substance,
                  index
                ) => (
                  <View
                    key={`${substance.name}-${index}`}
                    style={
                      styles.historySubstance
                    }
                  >
                    <Text
                      style={
                        styles.historySubstanceName
                      }
                    >
                      {substance.name}
                    </Text>

                    {event.eventType ===
                      'consumption' &&
                      substance.quantity !==
                        null && (
                        <Text
                          style={
                            styles.historyText
                          }
                        >
                          {substance.quantity}{' '}
                          {substance.unit}
                        </Text>
                      )}
                  </View>
                )
              )}


              <Text
                style={
                  styles.historyText
                }
              >
                Envie : {event.craving}/10
              </Text>


              {event.emotion && (
                <Text
                  style={
                    styles.historyText
                  }
                >
                  Émotion : {event.emotion}
                </Text>
              )}


              {event.context && (
                <Text
                  style={
                    styles.historyText
                  }
                >
                  Contexte : {event.context}
                </Text>
              )}


              {event.triggers?.length >
                0 && (
                <View
                  style={
                    styles.historyBlock
                  }
                >
                  <Text
                    style={
                      styles.historySectionTitle
                    }
                  >
                    Déclencheurs
                  </Text>

                  <View
                    style={
                      styles.tagContainer
                    }
                  >
                    {event.triggers.map(
                      (item) => (
                        <View
                          key={item}
                          style={
                            styles.tag
                          }
                        >
                          <Text
                            style={
                              styles.tagText
                            }
                          >
                            {item}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}


              {event.strategies?.length >
                0 && (
                <View
                  style={
                    styles.historyBlock
                  }
                >
                  <Text
                    style={
                      styles.historySectionTitle
                    }
                  >
                    Ce qui a aidé
                  </Text>

                  <View
                    style={
                      styles.tagContainer
                    }
                  >
                    {event.strategies.map(
                      (item) => (
                        <View
                          key={item}
                          style={
                            styles.strategyTag
                          }
                        >
                          <Text
                            style={
                              styles.strategyTagText
                            }
                          >
                            {item}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}


              {event.note && (
                <View
                  style={
                    styles.noteHistory
                  }
                >
                  <Text
                    style={
                      styles.historySectionTitle
                    }
                  >
                    Note
                  </Text>

                  <Text
                    style={
                      styles.noteHistoryText
                    }
                  >
                    {event.note}
                  </Text>
                </View>
              )}


              <View
                style={
                  styles.historyActions
                }
              >
                <Pressable
                  style={
                    styles.editButton
                  }
                  onPress={() =>
                    editEvent(event)
                  }
                >
                  <Text
                    style={
                      styles.editButtonText
                    }
                  >
                    Modifier
                  </Text>
                </Pressable>


                <Pressable
                  style={
                    styles.deleteButton
                  }
                  onPress={() =>
                    deleteEvent(event)
                  }
                >
                  <Text
                    style={
                      styles.deleteButtonText
                    }
                  >
                    Supprimer
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        )}


        {events.length > 0 && (
          <Pressable
            style={
              styles.dangerButton
            }
            onPress={
              deleteTestData
            }
          >
            <Text
              style={
                styles.dangerButtonText
              }
            >
              Effacer toutes les données de test
            </Text>
          </Pressable>
        )}


        <StatusBar style="auto" />
      </ScrollView>
    );
  }


  // ====================================================
  // FORMULAIRE
  // ====================================================

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => {
          resetForm();
          setScreen('home');
        }}
      >
        <Text
          style={
            styles.backText
          }
        >
          ← Retour
        </Text>
      </Pressable>


      <Text style={styles.title}>
        {editingId
          ? 'Modifier'
          : eventType ===
            'consumption'
          ? 'Enregistrer'
          : 'J’ai une envie'}
      </Text>


      {editingId && (
        <>
          <Text style={styles.label}>
            Type d’entrée
          </Text>

          <View
            style={
              styles.modeContainer
            }
          >
            <Pressable
              onPress={() =>
                changeEventType(
                  'consumption'
                )
              }
              style={[
                styles.modeButton,

                eventType ===
                  'consumption' &&
                  styles.modeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.modeText,

                  eventType ===
                    'consumption' &&
                    styles.modeTextSelected,
                ]}
              >
                Consommation
              </Text>
            </Pressable>


            <Pressable
              onPress={() =>
                changeEventType(
                  'craving_resisted'
                )
              }
              style={[
                styles.modeButton,

                eventType ===
                  'craving_resisted' &&
                  styles.modeButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.modeText,

                  eventType ===
                    'craving_resisted' &&
                    styles.modeTextSelected,
                ]}
              >
                Envie surmontée
              </Text>
            </Pressable>
          </View>
        </>
      )}


      {selectedSubstances.length >
        0 && (
        <View
          style={
            styles.selectedSection
          }
        >
          <Text
            style={
              styles.selectedTitle
            }
          >
            {eventType ===
            'consumption'
              ? 'Substance(s) enregistrée(s)'
              : 'Envie concernant'}
          </Text>

          {selectedSubstances.map(
            (item) => (
              <View
                key={item.name}
                style={
                  styles.selectedCard
                }
              >
                <View
                  style={{ flex: 1 }}
                >
                  <Text
                    style={
                      styles.selectedName
                    }
                  >
                    {item.name}
                  </Text>

                  {eventType ===
                    'consumption' && (
                    <Text
                      style={
                        styles.selectedQuantity
                      }
                    >
                      {item.quantity}{' '}
                      {item.unit}
                    </Text>
                  )}
                </View>

                <Pressable
                  onPress={() =>
                    removeSubstance(
                      item.name
                    )
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    Retirer
                  </Text>
                </Pressable>
              </View>
            )
          )}
        </View>
      )}


      <Text style={styles.label}>
        {eventType ===
        'consumption'
          ? 'Qu’as-tu consommé ?'
          : 'Quelle substance concernait cette envie ?'}
      </Text>


      <View
        style={
          styles.choiceContainer
        }
      >
        {substances.map(
          (item) => (
            <Pressable
              key={item}
              onPress={() =>
                choosePendingSubstance(
                  item
                )
              }
              style={[
                styles.choice,

                pendingSubstance ===
                  item &&
                  styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,

                  pendingSubstance ===
                    item &&
                    styles.choiceTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )
        )}
      </View>


      {pendingSubstance ===
        'Autre' && (
        <>
          <Text
            style={
              styles.smallLabel
            }
          >
            Précise la substance
          </Text>

          <TextInput
            style={styles.input}
            value={
              customSubstance
            }
            onChangeText={
              setCustomSubstance
            }
            placeholder="Nom de la substance"
          />
        </>
      )}


      {pendingSubstance !== '' &&
        eventType ===
          'consumption' && (
        <>
          <Text
            style={
              styles.smallLabel
            }
          >
            Quantité
          </Text>

          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={
              setQuantity
            }
            placeholder="Ex : 2"
            keyboardType="decimal-pad"
          />

          <Text
            style={
              styles.smallLabel
            }
          >
            Unité
          </Text>

          <View
            style={
              styles.choiceContainer
            }
          >
            {unitsBySubstance[
              pendingSubstance
            ].map(
              (item) => (
                <Pressable
                  key={item}
                  onPress={() =>
                    setUnit(item)
                  }
                  style={[
                    styles.choice,

                    unit === item &&
                      styles.choiceSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,

                      unit === item &&
                        styles.choiceTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </>
      )}


      {pendingSubstance !== '' && (
        <Pressable
          onPress={
            addSubstance
          }
          style={
            styles.addSubstanceButton
          }
        >
          <Text
            style={
              styles.addSubstanceText
            }
          >
            + Ajouter cette substance
          </Text>
        </Pressable>
      )}


      <Text style={styles.label}>
        Niveau d’envie
      </Text>


      <View
        style={
          styles.cravingContainer
        }
      >
        {[
          0, 1, 2, 3, 4, 5,
          6, 7, 8, 9, 10,
        ].map(
          (value) => (
            <Pressable
              key={value}
              onPress={() =>
                setCraving(
                  value.toString()
                )
              }
              style={[
                styles.cravingButton,

                craving ===
                  value.toString() &&
                  styles.cravingButtonSelected,
              ]}
            >
              <Text
                style={[
                  styles.cravingText,

                  craving ===
                    value.toString() &&
                    styles.cravingTextSelected,
                ]}
              >
                {value}
              </Text>
            </Pressable>
          )
        )}
      </View>


      <Text
        style={
          styles.helperText
        }
      >
        0 = aucune envie · 10 = envie maximale
      </Text>


      <Text style={styles.label}>
        Comment te sentais-tu ?
      </Text>


      <View
        style={
          styles.choiceContainer
        }
      >
        {emotions.map(
          (item) => (
            <Pressable
              key={item}
              onPress={() =>
                setEmotion(item)
              }
              style={[
                styles.choice,

                emotion === item &&
                  styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,

                  emotion === item &&
                    styles.choiceTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )
        )}
      </View>


      <Text style={styles.label}>
        Dans quel contexte ?
      </Text>


      <View
        style={
          styles.choiceContainer
        }
      >
        {contexts.map(
          (item) => (
            <Pressable
              key={item}
              onPress={() =>
                setContext(item)
              }
              style={[
                styles.choice,

                context === item &&
                  styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,

                  context === item &&
                    styles.choiceTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )
        )}
      </View>


      <Text style={styles.label}>
        Qu’est-ce qui a pu déclencher cette situation ?
      </Text>

      <Text
        style={
          styles.helperText
        }
      >
        Plusieurs réponses possibles.
      </Text>


      <View
        style={
          styles.choiceContainer
        }
      >
        {triggerOptions.map(
          (item) => (
            <Pressable
              key={item}
              onPress={() =>
                toggleTrigger(item)
              }
              style={[
                styles.choice,

                triggers.includes(
                  item
                ) &&
                  styles.choiceSelected,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,

                  triggers.includes(
                    item
                  ) &&
                    styles.choiceTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )
        )}
      </View>


      {eventType ===
        'craving_resisted' && (
        <>
          <Text style={styles.label}>
            Qu’est-ce qui t’a aidé ?
          </Text>

          <Text
            style={
              styles.helperText
            }
          >
            Tu peux sélectionner plusieurs réponses.
          </Text>

          <View
            style={
              styles.choiceContainer
            }
          >
            {strategyOptions.map(
              (item) => (
                <Pressable
                  key={item}
                  onPress={() =>
                    toggleStrategy(
                      item
                    )
                  }
                  style={[
                    styles.choice,

                    strategies.includes(
                      item
                    ) &&
                      styles.strategySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,

                      strategies.includes(
                        item
                      ) &&
                        styles.choiceTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </>
      )}


      <Text style={styles.label}>
        Que s’est-il passé juste avant ?
      </Text>

      <Text
        style={
          styles.helperText
        }
      >
        Facultatif
      </Text>


      <TextInput
        style={
          styles.noteInput
        }
        value={note}
        onChangeText={setNote}
        placeholder="Tu peux écrire librement ce qui s’est passé..."
        multiline
        maxLength={500}
        textAlignVertical="top"
      />


      <Text
        style={
          styles.characterCount
        }
      >
        {note.length}/500
      </Text>


      <Pressable
        style={
          styles.saveButton
        }
        onPress={
          saveEvent
        }
      >
        <Text
          style={
            styles.saveButtonText
          }
        >
          {editingId
            ? 'Enregistrer les modifications'
            : eventType ===
              'consumption'
            ? 'Enregistrer la consommation'
            : 'Enregistrer cette envie surmontée'}
        </Text>
      </Pressable>


      <StatusBar style="auto" />
    </ScrollView>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        '#E8F5E9',
    },

    container: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 60,
      paddingBottom: 70,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#E8F5E9',
    },

    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#2E7D32',
      textAlign: 'center',
      marginBottom: 10,
    },

    homeSubtitle: {
      fontSize: 18,
      color: '#555',
      textAlign: 'center',
      marginBottom: 30,
    },

    backText: {
      color: '#2E7D32',
      fontSize: 16,
      marginBottom: 20,
      fontWeight: '600',
    },

    mainAction: {
      backgroundColor:
        '#2E7D32',
      borderRadius: 18,
      padding: 20,
      marginBottom: 14,
    },

    mainActionTitle: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: 'bold',
    },

    mainActionSubtitle: {
      color: '#E8F5E9',
      marginTop: 5,
      fontSize: 14,
    },

    talkAction: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 2,
      borderColor:
        '#2E7D32',
      borderRadius: 18,
      padding: 20,
      marginBottom: 30,
    },

    talkActionTitle: {
      color: '#2E7D32',
      fontSize: 22,
      fontWeight: 'bold',
    },

    talkActionSubtitle: {
      color: '#555',
      marginTop: 5,
      lineHeight: 20,
    },

    comingSoonBadge: {
      alignSelf:
        'flex-start',
      marginTop: 12,
      backgroundColor:
        '#E8F5E9',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },

    comingSoonText: {
      color: '#2E7D32',
      fontSize: 12,
      fontWeight: '600',
    },

    messageCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      padding: 15,
      marginBottom: 20,
      borderWidth: 1,
      borderColor:
        '#C8E6C9',
    },

    messageText: {
      color: '#2E7D32',
      textAlign: 'center',
      lineHeight: 21,
    },

    sectionTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: '#2E7D32',
      marginBottom: 15,
    },

    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },

    statCard: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        '#C8E6C9',
    },

    statNumber: {
      fontSize: 30,
      fontWeight: 'bold',
      color: '#1B5E20',
    },

    statLabel: {
      fontSize: 12,
      color: '#555',
      textAlign: 'center',
      marginTop: 5,
    },

    secondaryButton: {
      borderWidth: 1,
      borderColor:
        '#2E7D32',
      borderRadius: 12,
      padding: 14,
    },

    secondaryButtonText: {
      color: '#2E7D32',
      textAlign: 'center',
      fontWeight: '600',
    },

    label: {
      fontSize: 17,
      fontWeight: '600',
      color: '#2E7D32',
      marginTop: 25,
      marginBottom: 10,
    },

    smallLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#555',
      marginTop: 15,
      marginBottom: 8,
    },

    helperText: {
      fontSize: 13,
      color: '#666',
      marginTop: -5,
      marginBottom: 10,
    },

    modeContainer: {
      flexDirection: 'row',
      gap: 10,
    },

    modeButton: {
      flex: 1,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#A5D6A7',
      borderRadius: 12,
      padding: 13,
    },

    modeButtonSelected: {
      backgroundColor:
        '#2E7D32',
      borderColor:
        '#2E7D32',
    },

    modeText: {
      textAlign: 'center',
      color: '#2E7D32',
      fontWeight: '600',
    },

    modeTextSelected: {
      color: '#FFFFFF',
    },

    choiceContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },

    choice: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#A5D6A7',
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 10,
    },

    choiceSelected: {
      backgroundColor:
        '#2E7D32',
      borderColor:
        '#2E7D32',
    },

    strategySelected: {
      backgroundColor:
        '#1B5E20',
      borderColor:
        '#1B5E20',
    },

    choiceText: {
      color: '#2E7D32',
      fontSize: 14,
    },

    choiceTextSelected: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    input: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#A5D6A7',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
    },

    selectedSection: {
      marginTop: 20,
    },

    selectedTitle: {
      color: '#555',
      fontWeight: '600',
      marginBottom: 8,
    },

    selectedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        '#C8E6C9',
    },

    selectedName: {
      color: '#2E7D32',
      fontSize: 16,
      fontWeight: '600',
    },

    selectedQuantity: {
      color: '#555',
      marginTop: 3,
    },

    removeText: {
      color: '#B71C1C',
      fontSize: 13,
      padding: 8,
    },

    addSubstanceButton: {
      marginTop: 15,
      borderWidth: 1,
      borderColor:
        '#2E7D32',
      borderRadius: 10,
      padding: 13,
    },

    addSubstanceText: {
      textAlign: 'center',
      color: '#2E7D32',
      fontWeight: '600',
    },

    cravingContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },

    cravingButton: {
      width: 43,
      height: 43,
      borderRadius: 22,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#A5D6A7',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    cravingButtonSelected: {
      backgroundColor:
        '#2E7D32',
      borderColor:
        '#2E7D32',
    },

    cravingText: {
      color: '#2E7D32',
      fontWeight: '600',
    },

    cravingTextSelected: {
      color: '#FFFFFF',
    },

    noteInput: {
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#A5D6A7',
      borderRadius: 12,
      padding: 14,
      minHeight: 120,
      fontSize: 16,
    },

    characterCount: {
      color: '#777',
      fontSize: 12,
      textAlign: 'right',
      marginTop: 5,
    },

    saveButton: {
      marginTop: 35,
      backgroundColor:
        '#2E7D32',
      padding: 16,
      borderRadius: 14,
    },

    saveButtonText: {
      color: '#FFFFFF',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },

    historyCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      padding: 17,
      marginBottom: 15,
      borderWidth: 1,
      borderColor:
        '#C8E6C9',
    },

    consumptionBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        '#FFF3E0',
      color: '#E65100',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      overflow: 'hidden',
      fontWeight: '600',
    },

    resistedBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        '#E8F5E9',
      color: '#1B5E20',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      overflow: 'hidden',
      fontWeight: '600',
    },

    historyDate: {
      fontSize: 12,
      color: '#777',
      marginVertical: 8,
    },

    historySubstance: {
      marginBottom: 7,
    },

    historySubstanceName: {
      fontSize: 17,
      fontWeight: 'bold',
      color: '#2E7D32',
    },

    historyText: {
      color: '#444',
      marginTop: 3,
    },

    historyBlock: {
      marginTop: 12,
    },

    historySectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#2E7D32',
      marginBottom: 6,
    },

    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    tag: {
      backgroundColor:
        '#E8F5E9',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 12,
    },

    tagText: {
      color: '#2E7D32',
      fontSize: 11,
    },

    strategyTag: {
      backgroundColor:
        '#E0F2F1',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 12,
    },

    strategyTagText: {
      color: '#00695C',
      fontSize: 11,
    },

    noteHistory: {
      marginTop: 12,
      backgroundColor:
        '#F5F5F5',
      padding: 11,
      borderRadius: 10,
    },

    noteHistoryText: {
      color: '#444',
      lineHeight: 20,
    },

    historyActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },

    editButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        '#2E7D32',
      borderRadius: 10,
      padding: 11,
    },

    editButtonText: {
      color: '#2E7D32',
      textAlign: 'center',
      fontWeight: '600',
    },

    deleteButton: {
      flex: 1,
      borderWidth: 1,
      borderColor:
        '#B71C1C',
      borderRadius: 10,
      padding: 11,
    },

    deleteButtonText: {
      color: '#B71C1C',
      textAlign: 'center',
      fontWeight: '600',
    },

    dangerButton: {
      marginTop: 25,
      padding: 14,
    },

    dangerButtonText: {
      color: '#B71C1C',
      textAlign: 'center',
    },

    emptyText: {
      textAlign: 'center',
      color: '#777',
      marginTop: 30,
    },

    talkPlaceholder: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      padding: 22,
      borderWidth: 1,
      borderColor:
        '#C8E6C9',
      marginTop: 20,
    },

    talkPlaceholderTitle: {
      fontSize: 21,
      fontWeight: 'bold',
      color: '#2E7D32',
      marginBottom: 15,
    },

    talkPlaceholderText: {
      color: '#444',
      lineHeight: 23,
      marginBottom: 14,
    },

    talkPrivacy: {
      color: '#2E7D32',
      fontWeight: '600',
      marginTop: 5,
    },
  });