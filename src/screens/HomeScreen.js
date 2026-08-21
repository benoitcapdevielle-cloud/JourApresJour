import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen({ events, flashMessage, onConsumption, onCraving, onTalk, onHistory }) {
  const consumptionCount = events.filter((event) => event.eventType === 'consumption').length;
  const resistedCount = events.filter((event) => event.eventType === 'craving_resisted').length;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
    <Text style={styles.title}>Jour après Jour</Text><Text style={styles.subtitle}>Aujourd’hui, on fait quoi ?</Text>
    {!!flashMessage && <View style={styles.messageCard}><Text style={styles.messageText}>{flashMessage}</Text></View>}
    <Pressable style={styles.mainAction} onPress={onConsumption}><Text style={styles.mainActionTitle}>Enregistrer</Text><Text style={styles.mainActionSubtitle}>J’ai consommé</Text></Pressable>
    <Pressable style={styles.mainAction} onPress={onCraving}><Text style={styles.mainActionTitle}>J’ai une envie</Text><Text style={styles.mainActionSubtitle}>Faire le point sans avoir consommé</Text></Pressable>
    <Pressable style={styles.talkAction} onPress={onTalk}><Text style={styles.talkTitle}>Parler</Text><Text style={styles.talkSubtitle}>Comprendre ce qui se passe avec le compagnon Jour après Jour</Text><View style={styles.badge}><Text style={styles.badgeText}>Bientôt</Text></View></Pressable>
    <Text style={styles.sectionTitle}>Ton parcours</Text>
    <View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statNumber}>{consumptionCount}</Text><Text style={styles.statLabel}>consommations</Text></View><View style={styles.statCard}><Text style={styles.statNumber}>{resistedCount}</Text><Text style={styles.statLabel}>envies surmontées</Text></View></View>
    <Pressable style={styles.secondaryButton} onPress={onHistory}><Text style={styles.secondaryText}>Voir l’historique</Text></Pressable><StatusBar style="auto" />
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},subtitle:{fontSize:18,color:'#555',textAlign:'center',marginBottom:30},
  messageCard:{backgroundColor:'#FFF',borderRadius:14,padding:15,marginBottom:20,borderWidth:1,borderColor:'#C8E6C9'},messageText:{color:'#2E7D32',textAlign:'center',lineHeight:21},mainAction:{backgroundColor:'#2E7D32',borderRadius:18,padding:20,marginBottom:14},mainActionTitle:{color:'#FFF',fontSize:22,fontWeight:'bold'},mainActionSubtitle:{color:'#E8F5E9',marginTop:5,fontSize:14},
  talkAction:{backgroundColor:'#FFF',borderWidth:2,borderColor:'#2E7D32',borderRadius:18,padding:20,marginBottom:30},talkTitle:{color:'#2E7D32',fontSize:22,fontWeight:'bold'},talkSubtitle:{color:'#555',marginTop:5,lineHeight:20},badge:{alignSelf:'flex-start',marginTop:12,backgroundColor:'#E8F5E9',paddingHorizontal:10,paddingVertical:5,borderRadius:12},badgeText:{color:'#2E7D32',fontSize:12,fontWeight:'600'},sectionTitle:{fontSize:22,fontWeight:'bold',color:'#2E7D32',marginBottom:15},
  statsRow:{flexDirection:'row',gap:12,marginBottom:20},statCard:{flex:1,backgroundColor:'#FFF',borderRadius:14,padding:18,alignItems:'center',borderWidth:1,borderColor:'#C8E6C9'},statNumber:{fontSize:30,fontWeight:'bold',color:'#1B5E20'},statLabel:{fontSize:12,color:'#555',textAlign:'center',marginTop:5},secondaryButton:{borderWidth:1,borderColor:'#2E7D32',borderRadius:12,padding:14},secondaryText:{color:'#2E7D32',textAlign:'center',fontWeight:'600'},
});
