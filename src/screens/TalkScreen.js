import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { buildAIContext } from '../ai/buildAIContext';
import { GOAL_OPTIONS } from '../services/profileService';

export default function TalkScreen({ events, profile, memories, onManageMemory, onBack }) {
  const [message, setMessage] = useState(''); const [notice, setNotice] = useState('');
  const context = useMemo(() => buildAIContext({ events, profile, memories }), [events, profile, memories]);
  const goal = GOAL_OPTIONS.find(({ value }) => value === context.goal)?.label || 'Non défini'; const summary = context.behaviorSummary;
  const send = () => { if (message.trim()) setNotice('Le compagnon IA n’est pas encore activé. Ton message n’a pas été envoyé et n’est pas enregistré.'); };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>Parler</Text>
    <View style={styles.card}><Text style={styles.cardTitle}>Ton compagnon Jour après Jour</Text><Text style={styles.text}>Tu peux préparer un message ici. Pour l’instant, le compagnon IA n’est pas activé : rien n’est envoyé ni enregistré.</Text>
      <TextInput style={styles.messageInput} multiline value={message} onChangeText={(value) => { setMessage(value); setNotice(''); }} placeholder="Écris ce que tu souhaites partager…" textAlignVertical="top" />
      <Pressable style={[styles.sendButton, !message.trim() && styles.disabled]} onPress={send} disabled={!message.trim()}><Text style={styles.sendText}>Envoyer</Text></Pressable>{!!notice && <Text style={styles.notice}>{notice}</Text>}
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>Ce que Jour après Jour pourra utiliser avec ton accord</Text>
      <Text style={styles.preview}>Ton objectif : {goal}</Text>{summary.topTrigger && <Text style={styles.preview}>Déclencheur fréquent : {summary.topTrigger.value}</Text>}{summary.topResistedStrategy && <Text style={styles.preview}>Stratégie souvent utilisée : {summary.topResistedStrategy.value}</Text>}
      <Text style={styles.preview}>{context.personalContext.motivations.length} motivation{context.personalContext.motivations.length > 1 ? 's' : ''} personnelle{context.personalContext.motivations.length > 1 ? 's' : ''} enregistrée{context.personalContext.motivations.length > 1 ? 's' : ''}</Text>
      <Text style={styles.privacy}>Cet aperçu reste local et ne montre ni tes notes complètes ni tout ton historique.</Text><Pressable style={styles.memoryButton} onPress={onManageMemory}><Text style={styles.memoryText}>Gérer ce que Jour après Jour retient</Text></Pressable>
    </View><StatusBar style="auto" />
  </ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},card:{backgroundColor:'#FFF',borderRadius:18,padding:20,borderWidth:1,borderColor:'#C8E6C9',marginTop:16},cardTitle:{fontSize:20,fontWeight:'bold',color:'#2E7D32',marginBottom:12},text:{color:'#444',lineHeight:22,marginBottom:12},messageInput:{minHeight:120,borderWidth:1,borderColor:'#A5D6A7',borderRadius:12,padding:12,color:'#222',backgroundColor:'#FAFFFA'},sendButton:{backgroundColor:'#2E7D32',borderRadius:12,padding:14,marginTop:12},disabled:{opacity:.45},sendText:{color:'#FFF',textAlign:'center',fontWeight:'bold'},notice:{color:'#555',lineHeight:20,marginTop:12},preview:{color:'#333',lineHeight:23,marginBottom:5},privacy:{color:'#2E7D32',fontWeight:'600',lineHeight:20,marginTop:10},memoryButton:{borderWidth:1,borderColor:'#2E7D32',borderRadius:12,padding:13,marginTop:16},memoryText:{color:'#2E7D32',textAlign:'center',fontWeight:'600'}});
