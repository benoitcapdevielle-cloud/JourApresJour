import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import EntryCard from '../components/EntryCard';
import { sortEventsByMostRecent } from '../utils/eventUtils';

export default function HistoryScreen({ events, onBack, onEdit, onDelete, onDeleteAll }) {
  const recentEvents=sortEventsByMostRecent(events);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}><Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>Historique</Text>{recentEvents.length===0&&<Text style={styles.empty}>Aucune entrée enregistrée.</Text>}{recentEvents.map(event=><EntryCard key={event.id} event={event} onEdit={()=>onEdit(event)} onDelete={()=>onDelete(event)} />)}{events.length>0&&<Pressable style={styles.danger} onPress={onDeleteAll}><Text style={styles.dangerText}>Effacer toutes les données de test</Text></Pressable>}<StatusBar style="auto" /></ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},empty:{textAlign:'center',color:'#777',marginTop:30},danger:{marginTop:25,padding:14},dangerText:{color:'#B71C1C',textAlign:'center'}});
