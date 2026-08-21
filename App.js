import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import EntryFormScreen from './src/screens/EntryFormScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import HomeScreen from './src/screens/HomeScreen';
import TalkScreen from './src/screens/TalkScreen';
import MemoryScreen from './src/screens/MemoryScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import { SCHEMA_VERSION } from './src/constants/trackingOptions';
import { clearEvents, loadEvents, saveEvents, upsertTrackerEvent } from './src/services/storageService';
import { loadProfile, saveGoal } from './src/services/profileService';
import { clearMemories, EMPTY_MEMORIES, loadMemories, saveMemories } from './src/services/memoryService';
import { addAssistantMessage } from './src/services/conversationService';
import { isApplicableEventEnrichment, isConfirmableEventSuggestion, normalizeEventEnrichment, toTrackerEventSuggestion } from './src/ai/eventExtraction';
import { normalizeEvent, normalizeEvents } from './src/utils/eventUtils';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [events, setEvents] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [eventType, setEventType] = useState('consumption');
  const [editingEvent, setEditingEvent] = useState(null);
  const [flashMessage, setFlashMessage] = useState('');
  const [goal, setGoal] = useState(null);
  const [memories, setMemories] = useState({ ...EMPTY_MEMORIES });
  const [conversationDraft, setConversationDraft] = useState(false);
  const [trackerDebug, setTrackerDebug] = useState(null);
  const eventsRef = useRef([]);

  useEffect(() => {
    Promise.all([loadEvents(), loadProfile(), loadMemories()]).then(([savedEvents, profile, savedMemories]) => { eventsRef.current = savedEvents; setEvents(savedEvents); setGoal(profile.goal); setMemories(savedMemories); }).catch((error) => console.error('Erreur de chargement :', error)).finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    const expectedId = trackerDebug?.expectedId;
    if (!expectedId) return;
    const reactHasEvent = events.some(({ id }) => id === expectedId);
    if (trackerDebug.reactCount === events.length && trackerDebug.reactHasEvent === reactHasEvent) return;
    setTrackerDebug((current) => ({ ...current, reactCount: events.length, reactHasEvent }));
  }, [events, trackerDebug?.expectedId]);

  const persistEvents = async (nextEvents) => {
    const normalized = normalizeEvents(nextEvents);
    const saved = await saveEvents(normalized);
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] persisted', { count: saved.length });
    const persisted = await loadEvents();
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] reloaded', { count: persisted.length });
    const expectedIds = new Set(normalized.map(({ id }) => id));
    if (persisted.length !== normalized.length || persisted.some(({ id }) => !expectedIds.has(id))) throw new Error('EVENT_COLLECTION_PERSISTENCE_FAILED');
    eventsRef.current = persisted;
    setEvents(persisted);
    return persisted;
  };

  const commitTrackerEvent = async (event) => {
    const normalized = normalizeEvent(event);
    if (!normalized || !normalized.targets.length || Number.isNaN(Date.parse(normalized.date))) throw new Error('INVALID_TRACKER_EVENT');
    const countBefore = eventsRef.current.length;
    const operation = eventsRef.current.some(({ id }) => id === normalized.id) ? 'UPDATE' : 'CREATE';
    const finalEvents = await upsertTrackerEvent(normalized);
    eventsRef.current = finalEvents;
    setEvents(finalEvents);
    const storageHasEvent = finalEvents.some(({ id }) => id === normalized.id);
    setTrackerDebug((current) => ({ ...current, writeAttempted: true, normalized: true, operation, countBefore, countAfter: finalEvents.length, persistedCount: finalEvents.length, reloadedCount: finalEvents.length, reactCount: events.length, storageHasEvent, reactHasEvent: events.some(({ id }) => id === normalized.id), historyHasEvent: false, displayed: false, targets: normalized.targets.length, expectedId: normalized.id, id: normalized.id.slice(-8), validDate: true, rawIso: normalized.date, timestampValue: Date.parse(normalized.date), localTime: new Date(normalized.date).toLocaleString('fr-FR'), error: null, timestamp: new Date().toISOString() }));
    const saved = finalEvents.find(({ id }) => id === normalized.id);
    if (!saved) throw new Error('EVENT_NOT_AVAILABLE_AFTER_UPSERT');
    return saved;
  };

  const openForm = (type, event = null) => {
    setEventType(event?.eventType || type);
    setEditingEvent(event);
    setScreen('form');
  };

  const handleSave = async (values) => {
    const now = new Date().toISOString();
    const eventData = {
      schemaVersion: SCHEMA_VERSION,
      id: conversationDraft ? `${Date.now()}-conversation` : editingEvent?.id || Date.now().toString(),
      eventType: values.eventType,
      date: values.date || editingEvent?.date || now,
      updatedAt: now,
      targets: values.selectedTargets,
      craving: Number(values.craving),
      emotion: values.emotion || null,
      context: values.context || null,
      triggers: values.triggers,
      strategies: values.eventType === 'craving_resisted' ? values.strategies : [],
      note: values.note.trim() || null,
      ...(editingEvent?.conversationDetails ? { conversationDetails: editingEvent.conversationDetails } : {}),
    };
    if (conversationDraft) {
      await commitTrackerEvent(eventData);
      await addAssistantMessage('Ajouté à ton suivi.');
      setConversationDraft(false);
      setEditingEvent(null);
      setScreen('talk');
      return;
    } else if (editingEvent) {
      await commitTrackerEvent(eventData);
      setFlashMessage('Entrée modifiée.');
    } else {
      await commitTrackerEvent(eventData);
      setFlashMessage(values.eventType === 'craving_resisted'
        ? 'Tu as traversé cette envie sans consommer. Ce qui t’a aidé aujourd’hui pourra devenir une ressource pour les prochaines fois.'
        : values.selectedTargets.every(({ category }) => category === 'substance')
          ? 'Cette consommation n’efface pas tes progrès. On continue, sans jugement.'
          : 'Cet événement n’efface pas tes progrès. On continue, sans jugement.');
    }
    setEditingEvent(null);
    setScreen('home');
  };

  const addConversationSuggestion = async (suggestion) => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] add requested', { eventType: suggestion?.eventType || null, targets: Array.isArray(suggestion?.targets) ? suggestion.targets.length : 0 });
    if (!isConfirmableEventSuggestion(suggestion)) throw new Error('UNCONFIRMED_EVENT_SUGGESTION');
    const trackerSuggestion = toTrackerEventSuggestion(suggestion);
    if (!trackerSuggestion) throw new Error('INVALID_EVENT_SUGGESTION');
    const now = new Date().toISOString();
    const eventData = normalizeEvent({
      ...trackerSuggestion,
      schemaVersion: SCHEMA_VERSION,
      id: `${Date.now()}-conversation`,
      date: trackerSuggestion.date || now,
      updatedAt: now,
    });
    if (!eventData) throw new Error('INVALID_EVENT_SUGGESTION');
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[TRACK] normalized', { id: eventData.id, eventType: eventData.eventType, targets: eventData.targets.length, date: eventData.date });
      console.log('[TRACK] before', { count: eventsRef.current.length });
    }
    const savedEvent = await commitTrackerEvent(eventData);
    const savedEvents = eventsRef.current;
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] persisted', { count: savedEvents.length });
    const persistedEvents = await loadEvents();
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] reloaded', { count: persistedEvents.length });
    const persistedEvent = persistedEvents.find(({ id }) => id === savedEvent.id);
    if (!persistedEvent || persistedEvents.length !== savedEvents.length) throw new Error('EVENT_PERSISTENCE_FAILED');
    eventsRef.current = persistedEvents;
    setEvents(persistedEvents);
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[TRACK] after', { count: persistedEvents.length });
    return persistedEvent;
  };

  const modifyConversationSuggestion = (suggestion) => {
    if (!isConfirmableEventSuggestion(suggestion)) return;
    const trackerSuggestion = toTrackerEventSuggestion(suggestion);
    if (!trackerSuggestion) return;
    setEventType(trackerSuggestion.eventType);
    setEditingEvent(normalizeEvent({ ...trackerSuggestion, id: 'conversation-draft', date: trackerSuggestion.date || new Date().toISOString() }));
    setConversationDraft(true);
    setScreen('form');
  };

  const enrichConversationEvent = async (enrichment) => {
    const expectedId = typeof enrichment?.eventId === 'string' ? enrichment.eventId : '';
    if (!isApplicableEventEnrichment(enrichment, expectedId)) throw new Error('INVALID_EVENT_ENRICHMENT');
    const normalizedEnrichment = normalizeEventEnrichment(enrichment, expectedId);
    const existing = eventsRef.current.find(({ id }) => id === expectedId);
    if (!existing) throw new Error('EVENT_NOT_FOUND');
    const updates = normalizedEnrichment.updates;
    const updated = normalizeEvent({
      ...existing,
      ...updates,
      triggers: updates.triggers ? [...new Set([...(existing.triggers || []), ...updates.triggers])] : existing.triggers,
      strategies: updates.strategies ? [...new Set([...(existing.strategies || []), ...updates.strategies])] : existing.strategies,
      conversationDetails: updates.conversationDetails ? { ...(existing.conversationDetails || {}), ...updates.conversationDetails } : existing.conversationDetails,
      updatedAt: new Date().toISOString(),
      lastUpdatedFrom: 'conversation',
    });
    if (!updated) throw new Error('INVALID_UPDATED_EVENT');
    const saved = await commitTrackerEvent(updated);
    if (!saved) throw new Error('EVENT_UPDATE_FAILED');
    return saved;
  };

  const deleteEvent = (event) => Alert.alert('Supprimer cette entrée ?', 'Cette action est définitive.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await persistEvents(eventsRef.current.filter((item) => item.id !== event.id)); } catch { Alert.alert('Erreur', 'Cette entrée n’a pas pu être supprimée.'); } } },
  ]);

  const deleteAllEvents = () => Alert.alert('Effacer toutes les données ?', 'Toutes les entrées enregistrées sur ce téléphone seront supprimées.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: async () => { await clearEvents(); eventsRef.current = []; setEvents([]); setFlashMessage(''); setEditingEvent(null); } },
  ]);

  if (!isLoaded) return <View style={styles.loadingContainer}><Text>Chargement...</Text></View>;
  if (screen === 'analysis') return <AnalysisScreen events={events} onBack={() => setScreen('home')} />;
  if (screen === 'talk') return <TalkScreen events={events} trackerDebug={trackerDebug} onTrackerDebug={(update) => setTrackerDebug((current) => ({ ...current, ...update }))} profile={{ goal }} memories={memories} onAddEventSuggestion={addConversationSuggestion} onEnrichEvent={enrichConversationEvent} onModifyEventSuggestion={modifyConversationSuggestion} onManageMemory={() => setScreen('memory')} onBack={() => setScreen('home')} />;
  if (screen === 'memory') return <MemoryScreen memories={memories} onSave={async (next) => { const saved = await saveMemories(next); setMemories(saved); }} onClear={async () => { const empty = await clearMemories(); setMemories(empty); }} onBack={() => setScreen('talk')} />;
  if (screen === 'history') return <HistoryScreen events={events} trackerDebug={trackerDebug} onHistoryDebug={(update) => setTrackerDebug((current) => ({ ...current, ...update }))} onBack={() => setScreen('home')} onEdit={(event) => openForm(event.eventType, event)} onDelete={deleteEvent} onDeleteAll={deleteAllEvents} />;
  if (screen === 'form') return <EntryFormScreen initialEventType={eventType} editingEvent={editingEvent} onBack={() => { setEditingEvent(null); if (conversationDraft) { setConversationDraft(false); setScreen('talk'); } else setScreen('home'); }} onSave={handleSave} />;
  return <HomeScreen events={events} goal={goal} onGoalChange={async (nextGoal) => { setGoal(nextGoal); await saveGoal(nextGoal); }} flashMessage={flashMessage} onConsumption={() => openForm('consumption')} onCraving={() => openForm('craving_resisted')} onTalk={() => setScreen('talk')} onHistory={() => setScreen('history')} onAnalysis={() => setScreen('analysis')} />;
}

const styles = StyleSheet.create({ loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9' } });
