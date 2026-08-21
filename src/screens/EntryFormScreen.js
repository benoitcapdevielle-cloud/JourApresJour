import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Slider from '@react-native-community/slider';
import ChoiceChip from '../components/ChoiceChip';
import Stepper from '../components/Stepper';
import TimeWheelPicker from '../components/TimeWheelPicker';
import { CONTEXTS, EMOTIONS, findTargetConfig, getTargetsByCategory, STRATEGY_OPTIONS, TARGET_CATEGORIES, TRIGGER_OPTIONS } from '../constants/trackingOptions';
import { getEventTargets } from '../utils/eventUtils';
import { applyTimeToDate, durationToMinutes, getTimeParts, normalizeWheelMinutes, usesIntegerStepper } from '../utils/formInputUtils';
import { formatTargetMeasurements } from '../utils/targetUtils';

const createEmptyMeasures = () => ({ quantity: 1, unit: '', durationHours: 0, durationMinutes: 0, episodes: 0, moneySpent: '' });
const parsePositive = (value) => { const parsed = Number(String(value).replace(',', '.')); return value !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null; };

export default function EntryFormScreen({ initialEventType, editingEvent, onBack, onSave }) {
  const initialTargets = getEventTargets(editingEvent);
  const [eventType,setEventType]=useState(initialEventType); const [selectedTargets,setSelectedTargets]=useState(initialTargets);
  const [showTargetForm,setShowTargetForm]=useState(!initialTargets.length); const [pendingCategory,setPendingCategory]=useState(''); const [pendingType,setPendingType]=useState('');
  const [customTarget,setCustomTarget]=useState(''); const [measures,setMeasures]=useState(createEmptyMeasures);
  const [craving,setCraving]=useState(editingEvent?.craving!=null?Number(editingEvent.craving):5);
  const [eventDate]=useState(()=>editingEvent?.date||new Date().toISOString()); const initialTime=getTimeParts(eventDate); const [eventHours,setEventHours]=useState(initialTime.hours); const [eventMinutes,setEventMinutes]=useState(normalizeWheelMinutes(initialTime.minutes));
  const [emotion,setEmotion]=useState(editingEvent?.emotion||''); const [context,setContext]=useState(editingEvent?.context||'');
  const [triggers,setTriggers]=useState(Array.isArray(editingEvent?.triggers)?editingEvent.triggers:[]); const [strategies,setStrategies]=useState(Array.isArray(editingEvent?.strategies)?editingEvent.strategies:[]); const [note,setNote]=useState(editingEvent?.note||'');
  const pendingConfig = pendingType ? findTargetConfig(pendingCategory, pendingType) : null;
  const resetTargetForm=()=>{setPendingCategory('');setPendingType('');setCustomTarget('');setMeasures(createEmptyMeasures());};
  const changeEventType=(type)=>{if(type===eventType)return;setEventType(type);setSelectedTargets([]);setShowTargetForm(true);resetTargetForm();setStrategies([]);};
  const chooseCategory=(category)=>{setPendingCategory(category);setPendingType('');setCustomTarget('');setMeasures(createEmptyMeasures());};
  const chooseTarget=(type)=>{setPendingType(type);setCustomTarget('');setMeasures(createEmptyMeasures());};
  const setMeasure=(key,value)=>setMeasures(current=>({...current,[key]:value}));
  const toggle=(setter,item)=>setter(current=>current.includes(item)?current.filter(value=>value!==item):[...current,item]);
  const addTarget=()=>{
    if(!pendingConfig)return Alert.alert('Élément suivi','Choisis ce que tu veux enregistrer.');
    const finalType=pendingConfig.custom?customTarget.trim():pendingConfig.type; if(!finalType)return Alert.alert('Élément suivi','Précise ce que tu veux enregistrer.');
    if(selectedTargets.some(item=>item.category===pendingCategory&&item.type.toLowerCase()===finalType.toLowerCase()))return Alert.alert('Déjà ajouté','Cet élément est déjà présent.');
    const measurement={source:'manual'};
    if(eventType==='consumption'){
      for(const field of pendingConfig.measurements){
        if(field.key==='quantity'){
          const value=parsePositive(measures.quantity); if(field.required&&!value)return Alert.alert('Quantité','Indique une quantité supérieure à 0.'); if(value)measurement.quantity=value;
          if((field.required||value)&&!measures.unit)return Alert.alert('Unité','Choisis une unité.'); if(measures.unit)measurement.unit=measures.unit;
        }
        if(field.key==='durationMinutes'){
          const value=durationToMinutes(measures.durationHours,measures.durationMinutes);
          if(field.required&&!value)return Alert.alert('Temps passé','Indique une durée supérieure à 0.'); if(value)measurement.durationMinutes=value;
        }
        if(field.key==='moneySpent'){const value=parsePositive(measures.moneySpent);if(field.required&&!value)return Alert.alert('Argent dépensé','Indique un montant supérieur à 0.');if(value)measurement.moneySpent=value;}
        if(field.key==='episodes'){const value=parsePositive(measures.episodes);if(field.required&&!value)return Alert.alert('Nombre d’épisodes','Indique un nombre supérieur à 0.');if(value)measurement.episodes=value;}
      }
    }
    setSelectedTargets(current=>[...current,{category:pendingCategory,type:finalType,measurement}]);resetTargetForm();setShowTargetForm(false);
  };
  const removeTarget=(target)=>setSelectedTargets(current=>{const remaining=current.filter(item=>item!==target);if(!remaining.length)setShowTargetForm(true);return remaining;});
  const submit=()=>{if(!selectedTargets.length)return Alert.alert('Élément suivi','Ajoute au moins un élément.');onSave({eventType,selectedTargets,craving,emotion,context,triggers,strategies,note,date:applyTimeToDate(eventDate,eventHours,eventMinutes)});};

  return <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable><Text style={styles.title}>{editingEvent?'Modifier':eventType==='consumption'?'Enregistrer':'J’ai une envie'}</Text>
    {editingEvent&&<><Text style={styles.label}>Type d’entrée</Text><View style={styles.modeRow}><ChoiceChip label="Consommation / comportement" selected={eventType==='consumption'} onPress={()=>changeEventType('consumption')} style={styles.mode} textStyle={styles.modeText}/><ChoiceChip label="Envie surmontée" selected={eventType==='craving_resisted'} onPress={()=>changeEventType('craving_resisted')} style={styles.mode} textStyle={styles.modeText}/></View></>}
    <Text style={styles.label}>À quelle heure ?</Text><TimeWheelPicker hours={eventHours} minutes={eventMinutes} onHoursChange={setEventHours} onMinutesChange={setEventMinutes}/><Text style={styles.timeValue}>{String(eventHours).padStart(2,'0')} : {String(eventMinutes).padStart(2,'0')}</Text>
    {!!selectedTargets.length&&<View style={styles.selectedSection}><Text style={styles.selectedTitle}>Élément(s) enregistré(s)</Text>{selectedTargets.map((target,index)=><View key={`${target.category}-${target.type}-${index}`} style={styles.selectedCard}><View style={styles.flex}><Text style={styles.selectedName}>{target.type}</Text>{formatTargetMeasurements(target).map(line=><Text key={line} style={styles.selectedMeasure}>{line}</Text>)}</View><Pressable onPress={()=>removeTarget(target)}><Text style={styles.remove}>Retirer</Text></Pressable></View>)}</View>}
    {showTargetForm?<><Text style={styles.label}>Qu’est-ce que tu veux enregistrer ?</Text><View style={styles.choices}>{TARGET_CATEGORIES.map(item=><ChoiceChip key={item.value} label={item.label} selected={pendingCategory===item.value} onPress={()=>chooseCategory(item.value)}/>)}</View>
      {!!pendingCategory&&<><Text style={styles.smallLabel}>Choisis un élément</Text><View style={styles.choices}>{getTargetsByCategory(pendingCategory).map(item=><ChoiceChip key={item.type} label={item.type} selected={pendingType===item.type} onPress={()=>chooseTarget(item.type)}/>)}</View></>}
      {pendingConfig?.custom&&<><Text style={styles.smallLabel}>Précise</Text><TextInput style={styles.input} value={customTarget} onChangeText={setCustomTarget} placeholder="Nom de l’élément"/></>}
      {!!pendingConfig&&eventType==='consumption'&&<MeasurementFields config={pendingConfig} values={measures} onChange={setMeasure}/>}{!!pendingConfig&&<Pressable onPress={addTarget} style={styles.add}><Text style={styles.addText}>+ Ajouter cet élément</Text></Pressable>}
    </>:<Pressable onPress={()=>setShowTargetForm(true)} style={styles.addAnother}><Text style={styles.addText}>+ Ajouter autre chose</Text></Pressable>}
    <View style={styles.cravingCard}><Text style={styles.cravingValue}>Intensité de l’envie : {craving} / 10</Text><Slider style={styles.slider} minimumValue={0} maximumValue={10} step={1} value={craving} onValueChange={setCraving} minimumTrackTintColor="#2E7D32" maximumTrackTintColor="#A5D6A7" thumbTintColor="#1B5E20" accessibilityLabel="Intensité de l’envie"/><View style={styles.sliderLabels}><Text style={styles.sliderLabel}>0 · aucune envie</Text><Text style={styles.sliderLabel}>10 · maximale</Text></View></View>
    <Options title="Comment te sentais-tu ?" items={EMOTIONS} selected={[emotion]} onPress={setEmotion}/><Options title="Dans quel contexte ?" items={CONTEXTS} selected={[context]} onPress={setContext}/><Options title="Qu’est-ce qui a pu déclencher cette situation ?" helper="Plusieurs réponses possibles." items={TRIGGER_OPTIONS} selected={triggers} onPress={item=>toggle(setTriggers,item)}/>
    {eventType==='craving_resisted'&&<Options title="Qu’est-ce qui t’a aidé ?" helper="Tu peux sélectionner plusieurs réponses." items={STRATEGY_OPTIONS} selected={strategies} onPress={item=>toggle(setStrategies,item)} strategy/>}
    <Text style={styles.label}>Que s’est-il passé juste avant ?</Text><Text style={styles.helper}>Facultatif</Text><TextInput style={styles.note} value={note} onChangeText={setNote} placeholder="Tu peux écrire librement ce qui s’est passé..." multiline maxLength={500} textAlignVertical="top"/><Text style={styles.count}>{note.length}/500</Text>
    <Pressable style={styles.save} onPress={submit}><Text style={styles.saveText}>{editingEvent?'Enregistrer les modifications':eventType==='consumption'?'Enregistrer':'Enregistrer cette envie surmontée'}</Text></Pressable><StatusBar style="auto" />
  </ScrollView>;
}

function MeasurementFields({config,values,onChange}) { return <>{config.measurements.map(field=>{
  if(field.key==='quantity')return <View key={field.key}><Text style={styles.smallLabel}>Unité</Text><View style={styles.choices}>{field.units.map(unit=><ChoiceChip key={unit} label={unit} selected={values.unit===unit} onPress={()=>onChange('unit',unit)}/>)}</View><Text style={styles.smallLabel}>{field.label}</Text>{!values.unit?<Text style={styles.measureHint}>Choisis d’abord une unité.</Text>:usesIntegerStepper(values.unit)?<Stepper value={Number(values.quantity)||1} onChange={value=>onChange('quantity',value)} minimum={1} maximum={100} accessibilityLabel="la quantité"/>:<TextInput style={styles.input} value={String(values.quantity)} onChangeText={value=>onChange('quantity',value)} placeholder="Ex : 2,5" keyboardType="decimal-pad"/>}</View>;
  if(field.key==='durationMinutes')return <View key={field.key} style={styles.measureCard}><Text style={styles.measureTitle}>Combien de temps ?{!field.required?' (facultatif)':''}</Text><Stepper value={values.durationHours} onChange={value=>onChange('durationHours',value)} minimum={0} maximum={24} suffix=" h" accessibilityLabel="la durée en heures"/><View style={styles.stepperGap}/><Stepper value={values.durationMinutes} onChange={value=>onChange('durationMinutes',value)} minimum={0} maximum={55} step={5} suffix=" min" accessibilityLabel="la durée en minutes"/><Text style={styles.measureResult}>Durée : {values.durationHours ? `${values.durationHours} h ` : ''}{values.durationMinutes ? `${values.durationMinutes} min` : '0 min'}</Text></View>;
  if(field.key==='moneySpent')return <View key={field.key}><Text style={styles.smallLabel}>{field.label}{!field.required?' (facultatif)':''}</Text><View style={styles.moneyRow}><TextInput style={styles.moneyInput} value={values.moneySpent} onChangeText={value=>onChange('moneySpent',value)} placeholder="0,00" keyboardType="decimal-pad"/><Text style={styles.euro}>€</Text></View></View>;
  return <View key={field.key}><Text style={styles.smallLabel}>{field.label}{!field.required?' (facultatif)':''}</Text><Stepper value={values.episodes} onChange={value=>onChange('episodes',value)} minimum={0} maximum={99} accessibilityLabel="le nombre d’épisodes"/></View>;
})}</>; }
function Options({title,helper,items,selected,onPress,strategy}) { return <><Text style={styles.label}>{title}</Text>{helper&&<Text style={styles.helper}>{helper}</Text>}<View style={styles.choices}>{items.map(item=><ChoiceChip key={item} label={item} selected={selected.includes(item)} onPress={()=>onPress(item)} variant={strategy?'strategy':'default'}/>)}</View></>; }
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#E8F5E9'},container:{flexGrow:1,paddingHorizontal:22,paddingTop:60,paddingBottom:70},back:{color:'#2E7D32',fontSize:16,marginBottom:20,fontWeight:'600'},title:{fontSize:32,fontWeight:'bold',color:'#2E7D32',textAlign:'center',marginBottom:10},label:{fontSize:17,fontWeight:'600',color:'#2E7D32',marginTop:28,marginBottom:12},smallLabel:{fontSize:14,fontWeight:'600',color:'#555',marginTop:17,marginBottom:9},helper:{fontSize:13,color:'#666',marginTop:-5,marginBottom:10},choices:{flexDirection:'row',flexWrap:'wrap',gap:9},modeRow:{flexDirection:'row',gap:10},mode:{flex:1,borderRadius:12,padding:13},modeText:{textAlign:'center',fontWeight:'600'},timeValue:{fontSize:22,fontWeight:'700',color:'#1B5E20',textAlign:'center',marginTop:10},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#A5D6A7',borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:16},measureCard:{marginTop:17,backgroundColor:'#F4FBF4',borderRadius:14,padding:14,borderWidth:1,borderColor:'#C8E6C9'},measureTitle:{fontSize:16,fontWeight:'700',color:'#2E7D32',marginBottom:12},stepperGap:{height:10},measureResult:{fontSize:16,fontWeight:'600',color:'#2E7D32',textAlign:'center',marginTop:12},measureHint:{color:'#666',fontSize:14,marginBottom:4},moneyRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderWidth:1,borderColor:'#A5D6A7',borderRadius:10},moneyInput:{flex:1,paddingHorizontal:14,paddingVertical:12,fontSize:16},euro:{fontSize:20,fontWeight:'700',color:'#2E7D32',paddingHorizontal:15},selectedSection:{marginTop:20},selectedTitle:{color:'#555',fontWeight:'600',marginBottom:8},selectedCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',padding:14,borderRadius:12,marginBottom:8,borderWidth:1,borderColor:'#C8E6C9'},flex:{flex:1},selectedName:{color:'#2E7D32',fontSize:16,fontWeight:'600'},selectedMeasure:{color:'#555',marginTop:3},remove:{color:'#B71C1C',fontSize:13,padding:10},add:{marginTop:17,borderWidth:1,borderColor:'#2E7D32',borderRadius:12,padding:15},addAnother:{marginTop:12,marginBottom:5,borderWidth:1,borderColor:'#2E7D32',borderRadius:12,padding:15},addText:{textAlign:'center',color:'#2E7D32',fontWeight:'600'},cravingCard:{marginTop:28,backgroundColor:'#FFF',borderRadius:16,padding:17,borderWidth:1,borderColor:'#C8E6C9'},cravingValue:{fontSize:19,fontWeight:'700',color:'#2E7D32',textAlign:'center'},slider:{width:'100%',height:52,marginTop:8},sliderLabels:{flexDirection:'row',justifyContent:'space-between'},sliderLabel:{fontSize:12,color:'#666'},note:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#A5D6A7',borderRadius:12,padding:14,minHeight:120,fontSize:16},count:{color:'#777',fontSize:12,textAlign:'right',marginTop:5},save:{marginTop:35,backgroundColor:'#2E7D32',padding:17,borderRadius:14,minHeight:54,justifyContent:'center'},saveText:{color:'#FFF',textAlign:'center',fontSize:16,fontWeight:'600'}});
