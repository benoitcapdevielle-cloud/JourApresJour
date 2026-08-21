import { Pressable, StyleSheet, Text } from 'react-native';

export default function ChoiceChip({ label, selected, onPress, variant = 'default', style, textStyle }) {
  return <Pressable onPress={onPress} style={[styles.choice, style, selected && styles[variant === 'strategy' ? 'strategySelected' : 'selected']]}><Text style={[styles.text, textStyle, selected && styles.selectedText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  choice: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#A5D6A7', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 },
  selected: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' }, strategySelected: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  text: { color: '#2E7D32', fontSize: 14 }, selectedText: { color: '#FFFFFF', fontWeight: '600' },
});
