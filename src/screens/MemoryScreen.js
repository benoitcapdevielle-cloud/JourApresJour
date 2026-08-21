import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const FIELDS = [
  { key: 'motivations', label: 'Ce qui me motive', placeholder: 'Une motivation par ligne' },
  { key: 'importantPeople', label: 'Personnes importantes', placeholder: 'Une personne par ligne' },
  { key: 'riskSituations', label: 'Situations où je me sens plus vulnérable', placeholder: 'Une situation par ligne' },
  { key: 'helpfulStrategies', label: 'Ce qui m’aide', placeholder: 'Une stratégie par ligne' },
  { key: 'personalNotes', label: 'Autres choses que je veux que Jour après Jour retienne', placeholder: 'Une information par ligne' },
];
const toForm = (memories) => ({ firstName: memories.firstName || '', ...Object.fromEntries(FIELDS.map(({ key }) => [key, (memories[key] || []).join('\n')])) });
const toMemories = (form) => ({ firstName: form.firstName, ...Object.fromEntries(FIELDS.map(({ key }) => [key, form[key].split('\n')])) });
export default function MemoryScreen({ memories, onSave, onClear, onBack }) {
  const [form, setForm] = useState(() => toForm(memories)); const [saved, setSaved] = useState(false);
  useEffect(() => setForm(toForm(memories)), [memories]);
  const update = (key, value) => { setSaved(false); setForm((current) => ({ ...current, [key]: value })); };
  const clearAll = () => Alert.alert('Effacer la mémoire personnelle ?', 'Seules les informations enregistrées volontairement ici seront supprimées.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Effacer', style: 'destructive', onPress: async () => { await onClear(); setSaved(false); } }]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>Ce que je choisis de faire retenir</Text>
    <Text style={styles.intro}>Rien n’est mémorisé automatiquement : ces informations ne sont enregistrées que lorsque tu appuies sur « Enregistrer ».</Text>
    <Text style={styles.privacy}>Ces informations restent actuellement sur ton téléphone et ne sont envoyées à aucun service externe.</Text>
    <View style={styles.card}><Text style={styles.label}>Prénom</Text><TextInput style={styles.input} value={form.firstName} onChangeText={(value) => update('firstName', value)} placeholder="Prénom (facultatif)" /></View>
    {FIELDS.map(({ key, label, placeholder }) => <View style={styles.card} key={key}><View style={styles.row}><Text style={styles.label}>{label}</Text><Pressable onPress={() => update(key, '')}><Text style={styles.erase}>Effacer</Text></Pressable></View><TextInput style={[styles.input, styles.multiline]} multiline value={form[key]} onChangeText={(value) => update(key, value)} placeholder={placeholder} textAlignVertical="top" /></View>)}
    {saved && <Text style={styles.confirmation}>Mémoire personnelle enregistrée sur ce téléphone.</Text>}
    <Pressable style={styles.saveButton} onPress={async () => { await onSave(toMemories(form)); setSaved(true); }}><Text style={styles.saveText}>Enregistrer</Text></Pressable>
    <Pressable style={styles.clearButton} onPress={clearAll}><Text style={styles.clearText}>Tout effacer</Text></Pressable><StatusBar style="auto" />
  </ScrollView>;
}
const styles = StyleSheet.create({ screen:{flex:1,backgroundColor:'#E8F5E9'},container:{paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:28,fontWeight:'bold',color:'#2E7D32',marginBottom:12},intro:{color:'#555',lineHeight:21,marginBottom:10},privacy:{color:'#2E7D32',lineHeight:21,fontWeight:'600',marginBottom:20},card:{backgroundColor:'#FFF',borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:'#C8E6C9'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},label:{fontSize:16,fontWeight:'bold',color:'#2E7D32',flexShrink:1},erase:{color:'#B3261E',fontWeight:'600',padding:4},input:{borderWidth:1,borderColor:'#A5D6A7',borderRadius:10,paddingHorizontal:12,paddingVertical:11,marginTop:10,color:'#222',backgroundColor:'#FAFFFA'},multiline:{minHeight:86},confirmation:{color:'#2E7D32',textAlign:'center',fontWeight:'600',marginVertical:8},saveButton:{backgroundColor:'#2E7D32',borderRadius:12,padding:15,marginTop:8},saveText:{color:'#FFF',textAlign:'center',fontWeight:'bold',fontSize:16},clearButton:{borderWidth:1,borderColor:'#B3261E',borderRadius:12,padding:14,marginTop:12},clearText:{color:'#B3261E',textAlign:'center',fontWeight:'600'} });
