import { Pressable, StyleSheet, Text, View } from 'react-native';
import { stepValue } from '../utils/formInputUtils';

export default function Stepper({ value, onChange, minimum = 0, maximum = 100, step = 1, suffix = '', accessibilityLabel, compact = false }) {
  const decrease = () => onChange(stepValue(value, -step, minimum, maximum)); const increase = () => onChange(stepValue(value, step, minimum, maximum));
  return <View style={[styles.container,compact&&styles.compactContainer]} accessibilityLabel={accessibilityLabel}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${accessibilityLabel || 'la valeur'}`} style={({ pressed }) => [styles.button,compact&&styles.compactButton,pressed&&styles.pressed]} onPress={decrease}><Text style={styles.buttonText}>−</Text></Pressable>
    <Text style={[styles.value,compact&&styles.compactValue]}>{value}{suffix}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${accessibilityLabel || 'la valeur'}`} style={({ pressed }) => [styles.button,compact&&styles.compactButton,pressed&&styles.pressed]} onPress={increase}><Text style={styles.buttonText}>+</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({container:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderWidth:1,borderColor:'#C8E6C9',borderRadius:14,padding:7},compactContainer:{flex:1,padding:5},button:{width:52,height:52,borderRadius:12,backgroundColor:'#E8F5E9',alignItems:'center',justifyContent:'center'},compactButton:{width:44,height:48},pressed:{backgroundColor:'#C8E6C9'},buttonText:{fontSize:28,lineHeight:31,fontWeight:'600',color:'#1B5E20'},value:{minWidth:90,textAlign:'center',fontSize:21,fontWeight:'700',color:'#2E7D32'},compactValue:{minWidth:42,fontSize:18}});
