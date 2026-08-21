import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function EntryCard({ event, onEdit, onDelete }) {
  const resisted = event.eventType === 'craving_resisted';
  return <View style={styles.card}>
    <Text style={resisted ? styles.resistedBadge : styles.consumptionBadge}>{resisted ? 'Envie surmontée' : 'Consommation'}</Text>
    <Text style={styles.date}>{new Date(event.date).toLocaleString('fr-FR')}</Text>
    {event.substances.map((substance,index)=><View key={`${substance.name}-${index}`} style={styles.substance}><Text style={styles.name}>{substance.name}</Text>{!resisted && substance.quantity !== null && <Text style={styles.text}>{substance.quantity} {substance.unit}</Text>}</View>)}
    <Text style={styles.text}>Envie : {event.craving}/10</Text>{event.emotion && <Text style={styles.text}>Émotion : {event.emotion}</Text>}{event.context && <Text style={styles.text}>Contexte : {event.context}</Text>}
    <Tags title="Déclencheurs" items={event.triggers} />
    <Tags title="Ce qui a aidé" items={event.strategies} strategy />
    {event.note && <View style={styles.note}><Text style={styles.sectionTitle}>Note</Text><Text style={styles.noteText}>{event.note}</Text></View>}
    <View style={styles.actions}><Pressable style={styles.edit} onPress={onEdit}><Text style={styles.editText}>Modifier</Text></Pressable><Pressable style={styles.delete} onPress={onDelete}><Text style={styles.deleteText}>Supprimer</Text></Pressable></View>
  </View>;
}
function Tags({ title, items, strategy=false }) { if (!items?.length) return null; return <View style={styles.block}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.tags}>{items.map(item=><View key={item} style={strategy?styles.strategyTag:styles.tag}><Text style={strategy?styles.strategyText:styles.tagText}>{item}</Text></View>)}</View></View>; }
const styles=StyleSheet.create({card:{backgroundColor:'#FFF',borderRadius:14,padding:17,marginBottom:15,borderWidth:1,borderColor:'#C8E6C9'},consumptionBadge:{alignSelf:'flex-start',backgroundColor:'#FFF3E0',color:'#E65100',paddingHorizontal:10,paddingVertical:5,borderRadius:10,overflow:'hidden',fontWeight:'600'},resistedBadge:{alignSelf:'flex-start',backgroundColor:'#E8F5E9',color:'#1B5E20',paddingHorizontal:10,paddingVertical:5,borderRadius:10,overflow:'hidden',fontWeight:'600'},date:{fontSize:12,color:'#777',marginVertical:8},substance:{marginBottom:7},name:{fontSize:17,fontWeight:'bold',color:'#2E7D32'},text:{color:'#444',marginTop:3},block:{marginTop:12},sectionTitle:{fontSize:13,fontWeight:'600',color:'#2E7D32',marginBottom:6},tags:{flexDirection:'row',flexWrap:'wrap',gap:6},tag:{backgroundColor:'#E8F5E9',paddingHorizontal:9,paddingVertical:5,borderRadius:12},tagText:{color:'#2E7D32',fontSize:11},strategyTag:{backgroundColor:'#E0F2F1',paddingHorizontal:9,paddingVertical:5,borderRadius:12},strategyText:{color:'#00695C',fontSize:11},note:{marginTop:12,backgroundColor:'#F5F5F5',padding:11,borderRadius:10},noteText:{color:'#444',lineHeight:20},actions:{flexDirection:'row',gap:10,marginTop:18},edit:{flex:1,borderWidth:1,borderColor:'#2E7D32',borderRadius:10,padding:11},editText:{color:'#2E7D32',textAlign:'center',fontWeight:'600'},delete:{flex:1,borderWidth:1,borderColor:'#B71C1C',borderRadius:10,padding:11},deleteText:{color:'#B71C1C',textAlign:'center',fontWeight:'600'}});
