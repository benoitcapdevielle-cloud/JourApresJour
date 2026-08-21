import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import EntryFormScreen from './src/screens/EntryFormScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import HomeScreen from './src/screens/HomeScreen';
import TalkScreen from './src/screens/TalkScreen';
import MemoryScreen from './src/screens/MemoryScreen';
import AnalysisScreen from './src/screens/AnalysisScreen';
import { SCHEMA_VERSION } from './src/constants/trackingOptions';
import { clearEvents, loadEvents, saveEvents } from './src/services/storageService';
import { loadProfile, saveGoal } from './src/services/profileService';
import { clearMemories, EMPTY_MEMORIES, loadMemories, saveMemories } from './src/services/memoryService';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [events, setEvents] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [eventType, setEventType] = useState('consumption');
  const [editingEvent, setEditingEvent] = useState(null);
  const [flashMessage, setFlashMessage] = useState('');
  const [goal, setGoal] = useState(null);
  const [memories, setMemories] = useState({ ...EMPTY_MEMORIES });

  useEffect(() => {
    Promise.all([loadEvents(), loadProfile(), loadMemories()]).then(([savedEvents, profile, savedMemories]) => { setEvents(savedEvents); setGoal(profile.goal); setMemories(savedMemories); }).catch((error) => console.error('Erreur de chargement :', error)).finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (isLoaded) saveEvents(events).catch((error) => console.error('Erreur de sauvegarde :', error));
  }, [events, isLoaded]);

  const openForm = (type, event = null) => {
    setEventType(event?.eventType || type);
    setEditingEvent(event);
    setScreen('form');
  };

  const handleSave = (values) => {
    const now = new Date().toISOString();
    const eventData = {
      schemaVersion: SCHEMA_VERSION,
      id: editingEvent?.id || Date.now().toString(),
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
    };
    if (editingEvent) {
      setEvents((current) => current.map((event) => event.id === editingEvent.id ? eventData : event));
      setFlashMessage('Entrée modifiée.');
    } else {
      setEvents((current) => [...current, eventData]);
      setFlashMessage(values.eventType === 'craving_resisted'
        ? 'Tu as traversé cette envie sans consommer. Ce qui t’a aidé aujourd’hui pourra devenir une ressource pour les prochaines fois.'
        : values.selectedTargets.every(({ category }) => category === 'substance')
          ? 'Cette consommation n’efface pas tes progrès. On continue, sans jugement.'
          : 'Cet événement n’efface pas tes progrès. On continue, sans jugement.');
    }
    setEditingEvent(null);
    setScreen('home');
  };

  const deleteEvent = (event) => Alert.alert('Supprimer cette entrée ?', 'Cette action est définitive.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: () => setEvents((current) => current.filter((item) => item.id !== event.id)) },
  ]);

  const deleteAllEvents = () => Alert.alert('Effacer toutes les données ?', 'Toutes les entrées enregistrées sur ce téléphone seront supprimées.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: async () => { await clearEvents(); setEvents([]); setFlashMessage(''); setEditingEvent(null); } },
  ]);

  if (!isLoaded) return <View style={styles.loadingContainer}><Text>Chargement...</Text></View>;
  if (screen === 'analysis') return <AnalysisScreen events={events} onBack={() => setScreen('home')} />;
  if (screen === 'talk') return <TalkScreen events={events} profile={{ goal }} memories={memories} onManageMemory={() => setScreen('memory')} onBack={() => setScreen('home')} />;
  if (screen === 'memory') return <MemoryScreen memories={memories} onSave={async (next) => { const saved = await saveMemories(next); setMemories(saved); }} onClear={async () => { const empty = await clearMemories(); setMemories(empty); }} onBack={() => setScreen('talk')} />;
  if (screen === 'history') return <HistoryScreen events={events} onBack={() => setScreen('home')} onEdit={(event) => openForm(event.eventType, event)} onDelete={deleteEvent} onDeleteAll={deleteAllEvents} />;
  if (screen === 'form') return <EntryFormScreen initialEventType={eventType} editingEvent={editingEvent} onBack={() => { setEditingEvent(null); setScreen('home'); }} onSave={handleSave} />;
  return <HomeScreen events={events} goal={goal} onGoalChange={async (nextGoal) => { setGoal(nextGoal); await saveGoal(nextGoal); }} flashMessage={flashMessage} onConsumption={() => openForm('consumption')} onCraving={() => openForm('craving_resisted')} onTalk={() => setScreen('talk')} onHistory={() => setScreen('history')} onAnalysis={() => setScreen('analysis')} />;
}

const styles = StyleSheet.create({ loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5E9' } });
