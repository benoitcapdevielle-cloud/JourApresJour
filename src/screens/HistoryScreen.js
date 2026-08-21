import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import EntryCard from '../components/EntryCard';
import { sortEventsByMostRecent } from '../utils/eventUtils';

export default function HistoryScreen({ events, trackerDebug, onHistoryDebug, onBack, onEdit, onDelete, onDeleteAll }) {
  const rawEvents = Array.isArray(events) ? events : [];
  const validEvents = rawEvents.filter((event) => event && typeof event === 'object' && !Array.isArray(event) && event.id && Array.isArray(event.targets) && event.targets.length > 0 && event.date && !Number.isNaN(Date.parse(event.date)));
  const recentEvents=sortEventsByMostRecent(validEvents);
  const expectedId = trackerDebug?.expectedId || null;
  const historyHasEvent = Boolean(expectedId && rawEvents.some(({ id }) => id === expectedId));
  const displayed = Boolean(expectedId && recentEvents.some(({ id }) => id === expectedId));
  useEffect(() => { if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[HISTORY] received', { raw: rawEvents.length, valid: validEvents.length, displayed: recentEvents.length, expectedId: trackerDebug?.id || null, received: historyHasEvent, rendered: displayed }); onHistoryDebug?.({ historyCount: rawEvents.length, historyHasEvent, displayed }); }, [rawEvents.length, validEvents.length, recentEvents.length, expectedId, historyHasEvent, displayed]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}><Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>Historique</Text>{typeof __DEV__ !== 'undefined' && __DEV__ ? <Text style={styles.debug}>DEBUG history raw: {rawEvents.length} · valid: {validEvents.length} · displayed count: {recentEvents.length} · expectedId: {trackerDebug?.id || '-'} · raw: {historyHasEvent ? 'YES' : 'NO'} · displayed: {displayed ? 'YES' : 'NO'} · ISO: {trackerDebug?.rawIso || '-'} · timestamp: {trackerDebug?.timestampValue ?? '-'} · local: {trackerDebug?.localTime || '-'}</Text> : null}{recentEvents.length===0&&<Text style={styles.empty}>Aucune entrée enregistrée.</Text>}{recentEvents.map(event=><EntryCard key={event.id} event={event} onEdit={()=>onEdit(event)} onDelete={()=>onDelete(event)} />)}{events.length>0&&<Pressable style={styles.danger} onPress={onDeleteAll}><Text style={styles.dangerText}>Effacer toutes les données de test</Text></Pressable>}<StatusBar style="auto" /></ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},debug:{fontSize:10,color:'#7A5D00',textAlign:'center',marginBottom:8},empty:{textAlign:'center',color:'#777',marginTop:30},danger:{marginTop:25,padding:14},dangerText:{color:'#B71C1C',textAlign:'center'}});
