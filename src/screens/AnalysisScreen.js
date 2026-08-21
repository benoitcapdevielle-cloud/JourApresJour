import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { buildBehaviorSummary } from '../utils/behaviorAnalysis';
const MIN_EVENTS = 3;
function Insight({ title, text }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.text}>{text}</Text></View>; }
export default function AnalysisScreen({ events, onBack }) {
  const summary = buildBehaviorSummary(events); const enoughConsumption = summary.consumptionEventCount >= MIN_EVENTS; const enoughResisted = summary.resistedEventCount >= MIN_EVENTS;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
    <Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>Analyses</Text>
    <Text style={styles.intro}>Ces tendances sont calculées uniquement à partir de tes entrées enregistrées sur ce téléphone. Elles décrivent ce qui revient souvent, sans établir de cause.</Text>
    <View style={styles.summary}><Text style={styles.summaryNumber}>{summary.consumptionCount30d}</Text><Text style={styles.summaryLabel}>consommations sur 30 jours</Text><Text style={styles.summaryNumber}>{summary.resistedCount30d}</Text><Text style={styles.summaryLabel}>envies surmontées sur 30 jours</Text></View>
    {!enoughConsumption && !enoughResisted && <View style={styles.empty}><Text style={styles.text}>Continue à enregistrer quelques situations pour faire apparaître des tendances.</Text></View>}
    {enoughConsumption && <>{summary.averageConsumptionCraving !== null && <Insight title="Niveau d’envie" text={`Ton niveau d’envie moyen avant consommation est de ${String(summary.averageConsumptionCraving).replace('.', ',')}/10.`} />}
      {summary.topSubstance && <Insight title="Substance" text={`${summary.topSubstance.value} est la substance qui revient le plus souvent dans tes consommations enregistrées.`} />}
      {summary.topTrigger && <Insight title="Déclencheur" text={`${summary.topTrigger.value} semble apparaître fréquemment avant tes consommations enregistrées.`} />}
      {summary.topEmotion && <Insight title="Émotion" text={`${summary.topEmotion.value} est l’émotion qui revient le plus souvent avant tes consommations enregistrées.`} />}
      {summary.topContext && <Insight title="Contexte" text={`${summary.topContext.value} est souvent associé à tes consommations enregistrées.`} />}
      {summary.topTimePeriod && <Insight title="Moment" text={`Tes consommations sont le plus souvent enregistrées pendant la période : ${summary.topTimePeriod.value.toLowerCase()}.`} />}
      <Insight title="Plusieurs substances" text={`${summary.polyConsumptionRate} % de tes consommations enregistrées impliquent plusieurs substances.`} /></>}
    {enoughResisted && <>{summary.averageResistedCraving !== null && <Insight title="Envies surmontées" text={`Ton niveau d’envie moyen lors des envies surmontées est de ${String(summary.averageResistedCraving).replace('.', ',')}/10.`} />}
      {summary.topResistedStrategy && <Insight title="Stratégie" text={`${summary.topResistedStrategy.value} est la stratégie que tu as le plus souvent utilisée lors d’une envie surmontée.`} />}</>}
    <StatusBar style="auto" />
  </ScrollView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:14},intro:{color:'#555',lineHeight:21,marginBottom:20},summary:{backgroundColor:'#2E7D32',borderRadius:18,padding:20,marginBottom:18},summaryNumber:{color:'#FFF',fontSize:27,fontWeight:'bold'},summaryLabel:{color:'#E8F5E9',marginBottom:12},card:{backgroundColor:'#FFF',borderRadius:14,padding:17,marginBottom:12,borderWidth:1,borderColor:'#C8E6C9'},cardTitle:{fontSize:17,fontWeight:'bold',color:'#2E7D32',marginBottom:7},text:{color:'#444',lineHeight:21},empty:{backgroundColor:'#FFF',borderRadius:14,padding:18,borderWidth:1,borderColor:'#C8E6C9'}});
