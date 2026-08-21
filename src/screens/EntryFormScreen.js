import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ChoiceChip from '../components/ChoiceChip';
import { CONTEXTS, CRAVING_LEVELS, EMOTIONS, STRATEGY_OPTIONS, SUBSTANCES, TRIGGER_OPTIONS, UNITS_BY_SUBSTANCE } from '../constants/trackingOptions';

export default function EntryFormScreen({ initialEventType, editingEvent, onBack, onSave }) {
  const [eventType,setEventType]=useState(initialEventType);
  const [selectedSubstances,setSelectedSubstances]=useState(editingEvent?.substances||[]);
  const [pendingSubstance,setPendingSubstance]=useState('');
  const [customSubstance,setCustomSubstance]=useState('');
  const [quantity,setQuantity]=useState(''); const [unit,setUnit]=useState('');
  const [craving,setCraving]=useState(editingEvent?.craving!=null?String(editingEvent.craving):'');
  const [emotion,setEmotion]=useState(editingEvent?.emotion||''); const [context,setContext]=useState(editingEvent?.context||'');
  const [triggers,setTriggers]=useState(Array.isArray(editingEvent?.triggers)?editingEvent.triggers:[]);
  const [strategies,setStrategies]=useState(Array.isArray(editingEvent?.strategies)?editingEvent.strategies:[]);
  const [note,setNote]=useState(editingEvent?.note||'');

  const changeEventType=(type)=>{ if(type===eventType)return; setEventType(type);setSelectedSubstances([]);setPendingSubstance('');setCustomSubstance('');setQuantity('');setUnit('');setStrategies([]); };
  const chooseSubstance=(item)=>{setPendingSubstance(item);setQuantity('');setUnit('');if(item!=='Autre')setCustomSubstance('');};
  const toggle=(setter,item)=>setter(current=>current.includes(item)?current.filter(value=>value!==item):[...current,item]);
  const addSubstance=()=>{
    if(!pendingSubstance)return Alert.alert('Substance','Choisis une substance.');
    const finalName=pendingSubstance==='Autre'?customSubstance.trim():pendingSubstance;
    if(!finalName)return Alert.alert('Substance','Indique le nom de la substance.');
    if(selectedSubstances.some(item=>item.name.toLowerCase()===finalName.toLowerCase()))return Alert.alert('Déjà ajoutée','Cette substance est déjà présente.');
    if(eventType==='consumption'){
      const quantityNumber=Number(quantity.replace(',','.'));
      if(quantity===''||Number.isNaN(quantityNumber)||quantityNumber<=0)return Alert.alert('Quantité','Indique une quantité supérieure à 0.');
      if(!unit)return Alert.alert('Unité','Choisis une unité.');
      setSelectedSubstances(current=>[...current,{name:finalName,quantity:quantityNumber,unit}]);
    } else setSelectedSubstances(current=>[...current,{name:finalName,quantity:null,unit:null}]);
    setPendingSubstance('');setCustomSubstance('');setQuantity('');setUnit('');
  };
  const submit=()=>{
    if(!selectedSubstances.length)return Alert.alert('Substance',eventType==='consumption'?'Ajoute au moins une substance consommée.':'Indique la substance concernée par cette envie.');
    if(craving==='')return Alert.alert('Niveau d’envie','Choisis un niveau entre 0 et 10.');
    onSave({eventType,selectedSubstances,craving,emotion,context,triggers,strategies,note});
  };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable>
    <Text style={styles.title}>{editingEvent?'Modifier':eventType==='consumption'?'Enregistrer':'J’ai une envie'}</Text>
    {editingEvent&&<><Text style={styles.label}>Type d’entrée</Text><View style={styles.modeRow}><ChoiceChip label="Consommation" selected={eventType==='consumption'} onPress={()=>changeEventType('consumption')} style={styles.mode} textStyle={styles.modeText}/><ChoiceChip label="Envie surmontée" selected={eventType==='craving_resisted'} onPress={()=>changeEventType('craving_resisted')} style={styles.mode} textStyle={styles.modeText}/></View></>}
    {!!selectedSubstances.length&&<View style={styles.selectedSection}><Text style={styles.selectedTitle}>{eventType==='consumption'?'Substance(s) enregistrée(s)':'Envie concernant'}</Text>{selectedSubstances.map(item=><View key={item.name} style={styles.selectedCard}><View style={styles.flex}><Text style={styles.selectedName}>{item.name}</Text>{eventType==='consumption'&&<Text style={styles.selectedQuantity}>{item.quantity} {item.unit}</Text>}</View><Pressable onPress={()=>setSelectedSubstances(current=>current.filter(value=>value.name!==item.name))}><Text style={styles.remove}>Retirer</Text></Pressable></View>)}</View>}
    <Text style={styles.label}>{eventType==='consumption'?'Qu’as-tu consommé ?':'Quelle substance concernait cette envie ?'}</Text>
    <View style={styles.choices}>{SUBSTANCES.map(item=><ChoiceChip key={item} label={item} selected={pendingSubstance===item} onPress={()=>chooseSubstance(item)}/>)}</View>
    {pendingSubstance==='Autre'&&<><Text style={styles.smallLabel}>Précise la substance</Text><TextInput style={styles.input} value={customSubstance} onChangeText={setCustomSubstance} placeholder="Nom de la substance"/></>}
    {!!pendingSubstance&&eventType==='consumption'&&<><Text style={styles.smallLabel}>Quantité</Text><TextInput style={styles.input} value={quantity} onChangeText={setQuantity} placeholder="Ex : 2" keyboardType="decimal-pad"/><Text style={styles.smallLabel}>Unité</Text><View style={styles.choices}>{UNITS_BY_SUBSTANCE[pendingSubstance].map(item=><ChoiceChip key={item} label={item} selected={unit===item} onPress={()=>setUnit(item)}/>)}</View></>}
    {!!pendingSubstance&&<Pressable onPress={addSubstance} style={styles.add}><Text style={styles.addText}>+ Ajouter cette substance</Text></Pressable>}
    <Text style={styles.label}>Niveau d’envie</Text><View style={styles.cravings}>{CRAVING_LEVELS.map(value=><ChoiceChip key={value} label={String(value)} selected={craving===String(value)} onPress={()=>setCraving(String(value))} style={styles.craving} textStyle={styles.cravingText}/>)}</View><Text style={styles.helper}>0 = aucune envie · 10 = envie maximale</Text>
    <Options title="Comment te sentais-tu ?" items={EMOTIONS} selected={[emotion]} onPress={setEmotion}/><Options title="Dans quel contexte ?" items={CONTEXTS} selected={[context]} onPress={setContext}/>
    <Options title="Qu’est-ce qui a pu déclencher cette situation ?" helper="Plusieurs réponses possibles." items={TRIGGER_OPTIONS} selected={triggers} onPress={item=>toggle(setTriggers,item)}/>
    {eventType==='craving_resisted'&&<Options title="Qu’est-ce qui t’a aidé ?" helper="Tu peux sélectionner plusieurs réponses." items={STRATEGY_OPTIONS} selected={strategies} onPress={item=>toggle(setStrategies,item)} strategy/>}
    <Text style={styles.label}>Que s’est-il passé juste avant ?</Text><Text style={styles.helper}>Facultatif</Text><TextInput style={styles.note} value={note} onChangeText={setNote} placeholder="Tu peux écrire librement ce qui s’est passé..." multiline maxLength={500} textAlignVertical="top"/><Text style={styles.count}>{note.length}/500</Text>
    <Pressable style={styles.save} onPress={submit}><Text style={styles.saveText}>{editingEvent?'Enregistrer les modifications':eventType==='consumption'?'Enregistrer la consommation':'Enregistrer cette envie surmontée'}</Text></Pressable><StatusBar style="auto" />
  </ScrollView>;
}

function Options({title,helper,items,selected,onPress,strategy}) { return <><Text style={styles.label}>{title}</Text>{helper&&<Text style={styles.helper}>{helper}</Text>}<View style={styles.choices}>{items.map(item=><ChoiceChip key={item} label={item} selected={selected.includes(item)} onPress={()=>onPress(item)} variant={strategy?'strategy':'default'}/>)}</View></>; }
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},label:{fontSize:17,fontWeight:'600',color:'#2E7D32',marginTop:25,marginBottom:10},smallLabel:{fontSize:14,fontWeight:'600',color:'#555',marginTop:15,marginBottom:8},helper:{fontSize:13,color:'#666',marginTop:-5,marginBottom:10},choices:{flexDirection:'row',flexWrap:'wrap',gap:9},modeRow:{flexDirection:'row',gap:10},mode:{flex:1,borderRadius:12,padding:13},modeText:{textAlign:'center',fontWeight:'600'},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#A5D6A7',borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:16},selectedSection:{marginTop:20},selectedTitle:{color:'#555',fontWeight:'600',marginBottom:8},selectedCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',padding:14,borderRadius:12,marginBottom:8,borderWidth:1,borderColor:'#C8E6C9'},flex:{flex:1},selectedName:{color:'#2E7D32',fontSize:16,fontWeight:'600'},selectedQuantity:{color:'#555',marginTop:3},remove:{color:'#B71C1C',fontSize:13,padding:8},add:{marginTop:15,borderWidth:1,borderColor:'#2E7D32',borderRadius:10,padding:13},addText:{textAlign:'center',color:'#2E7D32',fontWeight:'600'},cravings:{flexDirection:'row',flexWrap:'wrap',gap:7},craving:{width:43,height:43,borderRadius:22,paddingHorizontal:0,paddingVertical:0,alignItems:'center',justifyContent:'center'},cravingText:{fontWeight:'600'},note:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#A5D6A7',borderRadius:12,padding:14,minHeight:120,fontSize:16},count:{color:'#777',fontSize:12,textAlign:'right',marginTop:5},save:{marginTop:35,backgroundColor:'#2E7D32',padding:16,borderRadius:14},saveText:{color:'#FFF',textAlign:'center',fontSize:16,fontWeight:'600'}});
