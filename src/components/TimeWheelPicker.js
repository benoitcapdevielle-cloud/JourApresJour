import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const ITEM_HEIGHT = 52;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);

function Wheel({ values, value, onChange, label }) {
  const listRef = useRef(null); const selectedIndex = Math.max(0, values.indexOf(value));
  const selectFromOffset = (offset) => { const index = Math.max(0, Math.min(values.length - 1, Math.round(offset / ITEM_HEIGHT))); onChange(values[index]); };
  const selectIndex = (index) => { onChange(values[index]); listRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true }); };
  useEffect(() => { listRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false }); }, [selectedIndex]);
  return <View style={styles.wheel} accessibilityLabel={label}>
    <View pointerEvents="none" style={styles.selection} />
    <ScrollView ref={listRef} contentOffset={{ x:0, y:selectedIndex*ITEM_HEIGHT }} contentContainerStyle={styles.wheelContent} showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT} snapToAlignment="start" decelerationRate="fast" nestedScrollEnabled scrollEventThrottle={16}
      onMomentumScrollEnd={(event) => selectFromOffset(event.nativeEvent.contentOffset.y)}
      onScrollEndDrag={(event) => { if (!event.nativeEvent.velocity?.y) selectFromOffset(event.nativeEvent.contentOffset.y); }}>
      {values.map((item,index) => <Pressable key={item} style={styles.item} onPress={() => selectIndex(index)}><Text style={[styles.itemText,item===value&&styles.selectedText]}>{String(item).padStart(2,'0')}</Text></Pressable>)}
    </ScrollView>
  </View>;
}

export default function TimeWheelPicker({ hours, minutes, onHoursChange, onMinutesChange }) {
  return <View style={styles.container}>
    <Wheel values={HOURS} value={hours} onChange={onHoursChange} label="Heures" />
    <Text style={styles.separator}>:</Text>
    <Wheel values={MINUTES} value={minutes} onChange={onMinutesChange} label="Minutes" />
  </View>;
}
const styles=StyleSheet.create({container:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14,backgroundColor:'#FFF',borderWidth:1,borderColor:'#C8E6C9',borderRadius:16,paddingHorizontal:14},wheel:{width:92,height:ITEM_HEIGHT*3,overflow:'hidden'},wheelContent:{paddingVertical:ITEM_HEIGHT},selection:{position:'absolute',left:4,right:4,top:ITEM_HEIGHT,bottom:ITEM_HEIGHT,borderTopWidth:1,borderBottomWidth:1,borderColor:'#81C784',backgroundColor:'#E8F5E966',borderRadius:8},item:{height:ITEM_HEIGHT,alignItems:'center',justifyContent:'center'},itemText:{fontSize:20,color:'#9E9E9E',fontWeight:'500'},selectedText:{fontSize:27,color:'#1B5E20',fontWeight:'800'},separator:{fontSize:30,color:'#2E7D32',fontWeight:'800'}});
