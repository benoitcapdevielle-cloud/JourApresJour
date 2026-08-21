import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { buildAIContext } from '../ai/buildAIContext';
import { addUserMessage, clearConversation, loadConversation } from '../services/conversationService';
import { GOAL_OPTIONS } from '../services/profileService';
import { buildTalkPreview, hasEnoughBehaviorData } from '../utils/talkPreview';

const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 112;
const formatMessageDate = (createdAt) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(createdAt));

export default function TalkScreen({ events, profile, memories, onManageMemory, onBack }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(() => Keyboard.isVisible());
  const sendingRef = useRef(false);
  const listRef = useRef(null);
  const context = useMemo(() => buildAIContext({ events, profile, memories }), [events, profile, memories]);
  const goalLabel = GOAL_OPTIONS.find(({ value }) => value === context.goal)?.label;
  const previewItems = useMemo(() => buildTalkPreview({ context, goalLabel }), [context, goalLabel]);
  const enoughBehaviorData = hasEnoughBehaviorData(context);
  const scrollToLatest = (animated = true) => setTimeout(() => listRef.current?.scrollToEnd({ animated }), 80);

  useEffect(() => {
    let isActive = true;
    loadConversation().then((savedMessages) => { if (isActive) { setMessages(savedMessages); scrollToLatest(false); } }).catch(() => { if (isActive) setNotice('La conversation locale n’a pas pu être chargée.'); }).finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

  const send = async () => {
    const text = message.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true; setIsSending(true); setNotice('');
    try {
      const savedMessage = await addUserMessage(text);
      if (savedMessage) {
        setMessages((current) => [...current, savedMessage]);
        setMessage(''); setInputHeight(MIN_INPUT_HEIGHT);
        setNotice('Le compagnon n’est pas encore connecté.');
        scrollToLatest();
      }
    } catch { setNotice('Le message n’a pas pu être enregistré sur ce téléphone.'); }
    finally { sendingRef.current = false; setIsSending(false); }
  };

  const confirmClear = () => Alert.alert('Effacer la conversation ?', 'Seuls les messages de Parler enregistrés sur ce téléphone seront supprimés.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: async () => {
      try { await clearConversation(); setMessages([]); setNotice('La conversation a été effacée.'); }
      catch { setNotice('La conversation n’a pas pu être effacée.'); }
    } },
  ]);

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return <View style={[styles.messageRow, isUser ? styles.userRow : styles.companionRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.companionBubble]}>
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={[styles.messageDate, isUser ? styles.userDate : styles.companionDate]}>{formatMessageDate(item.createdAt)}</Text>
      </View>
    </View>;
  };

  const cannotSend = !message.trim() || isSending;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS === 'ios' || isKeyboardVisible} keyboardVerticalOffset={0}>
    <View style={styles.layout}>
    <View style={styles.header}>
      <Pressable style={styles.headerAction} onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable>
      <Text style={styles.title}>Parler</Text>
      <View style={styles.headerAction}>{messages.length > 0 ? <Pressable onPress={confirmClear} hitSlop={8}><Text style={styles.clearText}>Effacer</Text></Pressable> : null}</View>
    </View>
    <Text style={styles.privacyNotice}>Messages enregistrés localement · aucune donnée envoyée à une IA</Text>
    <View style={styles.secondaryBar}>
      <Pressable style={styles.contextToggle} onPress={() => setContextOpen((current) => !current)} accessibilityState={{ expanded: contextOpen }}>
        <Text style={styles.contextToggleText}>Ce que Jour après Jour comprend de moi</Text>
        <Text style={styles.chevron}>{contextOpen ? '⌃' : '⌄'}</Text>
      </Pressable>
      {contextOpen ? <View style={styles.contextPanel}>
        {previewItems.map((item) => <Text key={item} style={styles.preview}>{item}</Text>)}
        {!enoughBehaviorData ? <Text style={styles.contextEmpty}>Continue à enregistrer quelques situations pour faire apparaître des tendances.</Text> : null}
        <Pressable style={styles.memoryButton} onPress={onManageMemory}><Text style={styles.memoryText}>Gérer ce que Jour après Jour retient</Text></Pressable>
      </View> : null}
    </View>
    <FlatList ref={listRef} style={styles.messageList} contentContainerStyle={[styles.messagesContent, messages.length === 0 && styles.emptyContent]} data={messages} renderItem={renderMessage} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false} ListEmptyComponent={<Text style={styles.emptyText}>{isLoading ? 'Chargement…' : 'Écris librement ce qui se passe. Tes messages resteront ici.'}</Text>} onLayout={() => { if (messages.length > 0) scrollToLatest(false); }} />
    <View style={styles.composerArea}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.composer}>
        <Pressable style={styles.micButton} disabled accessibilityRole="button" accessibilityLabel="Saisie vocale, bientôt disponible" accessibilityState={{ disabled: true }}>
          <Text style={styles.micIcon}>🎙</Text><Text style={styles.micLabel}>Bientôt</Text>
        </Pressable>
        <TextInput style={[styles.messageInput, { height: inputHeight }]} multiline value={message} onChangeText={(value) => { setMessage(value); setNotice(''); }} onContentSizeChange={({ nativeEvent }) => setInputHeight(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, nativeEvent.contentSize.height)))} onFocus={() => scrollToLatest()} placeholder="Écris ce qui se passe" textAlignVertical="top" scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT} />
        <Pressable style={[styles.sendButton, cannotSend && styles.disabled]} onPress={send} disabled={cannotSend}><Text style={styles.sendText}>{isSending ? '…' : 'Envoyer'}</Text></Pressable>
      </View>
    </View>
    <StatusBar style="auto" />
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F2F7F2'},layout:{flex:1},header:{paddingTop:52,paddingHorizontal:16,paddingBottom:10,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#DDE8DE',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerAction:{width:72},back:{color:'#2E7D32',fontSize:15,fontWeight:'600'},title:{fontSize:22,fontWeight:'700',color:'#245D28'},clearText:{color:'#777',fontSize:12,textAlign:'right',textDecorationLine:'underline'},privacyNotice:{backgroundColor:'#FFF',color:'#6C746D',fontSize:11,textAlign:'center',paddingHorizontal:16,paddingBottom:9},secondaryBar:{backgroundColor:'#F8FBF8',borderBottomWidth:1,borderBottomColor:'#DDE8DE'},contextToggle:{minHeight:42,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},contextToggleText:{color:'#3D6540',fontSize:13,fontWeight:'600',flexShrink:1},chevron:{color:'#517253',fontSize:18,marginLeft:12},contextPanel:{paddingHorizontal:18,paddingBottom:14},preview:{color:'#424842',fontSize:13,lineHeight:19,marginBottom:3},contextEmpty:{color:'#666',fontSize:13,lineHeight:19},memoryButton:{alignSelf:'flex-start',paddingVertical:8,paddingRight:12,marginTop:5},memoryText:{color:'#2E7D32',fontSize:13,fontWeight:'600',textDecorationLine:'underline'},
  messageList:{flex:1},messagesContent:{paddingHorizontal:16,paddingTop:12,paddingBottom:16},emptyContent:{flexGrow:1,justifyContent:'center'},emptyText:{color:'#727872',fontSize:14,lineHeight:21,textAlign:'center',paddingHorizontal:28},messageRow:{width:'100%',marginVertical:4},userRow:{alignItems:'flex-end'},companionRow:{alignItems:'flex-start'},bubble:{maxWidth:'84%',borderRadius:18,paddingHorizontal:14,paddingTop:10,paddingBottom:7},userBubble:{backgroundColor:'#DCEEDD',borderBottomRightRadius:5},companionBubble:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#DCE6DD',borderBottomLeftRadius:5},messageText:{color:'#202620',fontSize:16,lineHeight:22},messageDate:{fontSize:10,marginTop:4},userDate:{color:'#667567',textAlign:'right'},companionDate:{color:'#777',textAlign:'left'},
  composerArea:{backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#D8E3D9',paddingHorizontal:10,paddingTop:8,paddingBottom:Platform.OS === 'ios' ? 18 : 8},composer:{flexDirection:'row',alignItems:'flex-end',gap:8},micButton:{width:46,minHeight:44,alignItems:'center',justifyContent:'center',opacity:.45},micIcon:{color:'#2E7D32',fontSize:17,lineHeight:18},micLabel:{color:'#657266',fontSize:9,marginTop:1},messageInput:{flex:1,minHeight:MIN_INPUT_HEIGHT,maxHeight:MAX_INPUT_HEIGHT,borderWidth:1,borderColor:'#B9CFBB',borderRadius:22,paddingHorizontal:15,paddingTop:10,paddingBottom:10,color:'#202620',backgroundColor:'#FAFCFA',fontSize:16,lineHeight:21},sendButton:{minHeight:44,minWidth:68,borderRadius:22,backgroundColor:'#2E7D32',alignItems:'center',justifyContent:'center',paddingHorizontal:11},disabled:{opacity:.4},sendText:{color:'#FFF',fontSize:13,fontWeight:'700'},notice:{color:'#777',fontSize:11,textAlign:'center',marginBottom:5},
});
