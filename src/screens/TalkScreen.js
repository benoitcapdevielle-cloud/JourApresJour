import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { buildAIContext } from '../ai/buildAIContext';
import aiService from '../ai/aiService';
import { addAssistantMessage, addUserMessage, clearConversation, loadConversation } from '../services/conversationService';
import { clearActiveConversationEventId, clearPendingConversationEvent, loadActiveConversationEventId, loadPendingConversationEvent, saveActiveConversationEventId, savePendingConversationEvent } from '../services/pendingConversationEventService';
import { clearActiveSafetyContext, loadActiveSafetyContext, saveActiveSafetyContext } from '../services/safetyContextService';
import { GOAL_OPTIONS } from '../services/profileService';
import { buildTalkPreview, hasEnoughBehaviorData } from '../utils/talkPreview';
import { alignConversationEventToDeviceTime, getAutoSaveDecision, isApplicableEventEnrichment, isConfirmableEventSuggestion, mergePendingConversationEvent } from '../ai/eventExtraction';
import { formatTargetMeasurements } from '../utils/targetUtils';
import { buildLocalSafetyDetectedEvent, buildLocalSafetyReply, isCriticalSafety, rememberLocalSafetyQuestion, resolveEffectiveSafety } from '../utils/safetyUtils';

const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 112;
const compactActiveEvent = (event) => event ? ({ id: event.id, eventType: event.eventType, date: event.date, targets: event.targets, craving: event.craving, emotion: event.emotion, context: event.context, triggers: event.triggers, strategies: event.strategies, conversationDetails: event.conversationDetails || null, updatedAt: event.updatedAt || null }) : null;
const getRecentEventCandidates = (events) => (Array.isArray(events) ? events : []).filter((event) => event?.id && event?.date && !Number.isNaN(Date.parse(event.date)) && Date.now() - Date.parse(event.date) <= 48 * 60 * 60 * 1000).sort((left, right) => Date.parse(right.updatedAt || right.date) - Date.parse(left.updatedAt || left.date)).slice(0, 3);
const formatMessageDate = (createdAt) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(createdAt));
const cleanSimpleMarkdown = (text) => String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/^#{1,6}\s+/gm, '');
const formatSuggestionDate = (suggestion) => {
  if (!suggestion?.occurredAt) return 'Date à préciser';
  const options = suggestion.occurredAtPrecision === 'date_only' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' };
  const label = new Intl.DateTimeFormat('fr-FR', options).format(new Date(suggestion.occurredAt));
  return suggestion.occurredAtPrecision === 'approximate' ? `Vers ${label}` : label;
};
const getSuggestionDetails = (suggestion) => [
  suggestion?.emotion ? `Émotion : ${suggestion.emotion}` : null,
  suggestion?.context ? `Contexte : ${suggestion.context}` : null,
  suggestion?.triggers?.length ? `Déclencheur${suggestion.triggers.length > 1 ? 's' : ''} : ${suggestion.triggers.join(', ')}` : null,
  suggestion?.socialContext ? `Avec qui : ${suggestion.socialContext}` : null,
  suggestion?.location ? `Lieu : ${suggestion.location}` : null,
].filter(Boolean);

export default function TalkScreen({ events, trackerDebug, onTrackerDebug, profile, memories, onAddEventSuggestion, onEnrichEvent, onModifyEventSuggestion, onManageMemory, onBack }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [layoutDebug, setLayoutDebug] = useState({ windowHeight: Math.round(Dimensions.get('window').height), rootHeight: 0, listHeight: 0, keyboardVisible: false });
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [activeRecentEvent, setActiveRecentEvent] = useState(null);
  const [suggestionAction, setSuggestionAction] = useState('');
  const [activeSafetyContext, setActiveSafetyContext] = useState(null);
  const sendingRef = useRef(false);
  const listRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const context = useMemo(() => buildAIContext({ events, profile, memories }), [events, profile, memories]);
  const goalLabel = GOAL_OPTIONS.find(({ value }) => value === context.goal)?.label;
  const previewItems = useMemo(() => buildTalkPreview({ context, goalLabel }), [context, goalLabel]);
  const enoughBehaviorData = hasEnoughBehaviorData(context);
  const recentEventCandidates = useMemo(() => getRecentEventCandidates(events), [events]);
  const displayedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const scrollToLatest = (animated = true) => requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated }));
  const requestAutoScroll = (animated = true) => { isNearBottomRef.current = true; scrollToLatest(animated); };

  useEffect(() => {
    let isActive = true;
    Promise.all([loadConversation(), loadPendingConversationEvent(), loadActiveConversationEventId(), loadActiveSafetyContext()]).then(([savedMessages, savedPendingEvent, activeEventId, savedSafetyContext]) => { if (isActive) { setMessages(savedMessages); setPendingSuggestion(savedPendingEvent); setActiveRecentEvent(events.find(({ id }) => id === activeEventId) || null); setActiveSafetyContext(savedSafetyContext); } }).catch(() => { if (isActive) setNotice('La conversation locale n’a pas pu être chargée.'); }).finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', ({ endCoordinates }) => {
      const windowHeight = Dimensions.get('window').height;
      const overlap = Math.max(0, Math.round(windowHeight - endCoordinates.screenY));
      setKeyboardInset(overlap);
      setLayoutDebug((current) => ({ ...current, windowHeight: Math.round(windowHeight), keyboardVisible: true }));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardInset(0);
      setLayoutDebug((current) => ({ ...current, windowHeight: Math.round(Dimensions.get('window').height), keyboardVisible: false }));
    });
    return () => { show.remove(); hide.remove(); };
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
        setNotice('Le compagnon réfléchit…');
        requestAutoScroll();
        const preflightSafetyContext = resolveEffectiveSafety({ message: text, previous: activeSafetyContext, now: new Date() });
        if (isCriticalSafety(preflightSafetyContext)) {
          const savedPreflightSafety = await saveActiveSafetyContext(preflightSafetyContext);
          setActiveSafetyContext(savedPreflightSafety);
        }
        const result = await aiService.sendMessage({ message: text, context, messages: messages.slice(-7), pendingConversationEvent: pendingSuggestion, activeRecentEvent: compactActiveEvent(activeRecentEvent), recentEventCandidates: recentEventCandidates.map(compactActiveEvent), activeSafetyContext: activeSafetyContext || preflightSafetyContext });
        const effectiveSafetyContext = resolveEffectiveSafety({ message: text, previous: preflightSafetyContext, backend: result?.safety, now: new Date() });
        let nextSafetyContext = await saveActiveSafetyContext(effectiveSafetyContext);
        const reply = buildLocalSafetyReply(text, nextSafetyContext) || (typeof result === 'string' ? result : result?.reply);
        if (isCriticalSafety(nextSafetyContext)) nextSafetyContext = await saveActiveSafetyContext(rememberLocalSafetyQuestion(nextSafetyContext, reply));
        setActiveSafetyContext(nextSafetyContext);
        const assistantMessage = await addAssistantMessage(reply);
        const shouldFollowAssistant = isNearBottomRef.current;
        if (assistantMessage) { setMessages((current) => [...current, assistantMessage]); setNotice(''); if (shouldFollowAssistant) requestAutoScroll(); }
        const suggestion = alignConversationEventToDeviceTime(typeof result === 'object' ? result?.eventSuggestion : null, text, new Date());
        const detectedConversationEvent = alignConversationEventToDeviceTime(buildLocalSafetyDetectedEvent(text, new Date()) || (typeof result === 'object' ? result?.detectedConversationEvent || result?.eventSuggestion : null), text, new Date());
        const criticalSafety = Boolean(nextSafetyContext?.active && ['urgent', 'emergency'].includes(nextSafetyContext.level));
        const mergedSuggestion = mergePendingConversationEvent(pendingSuggestion, detectedConversationEvent);
        const enrichment = typeof result === 'object' ? result?.eventEnrichment : null;
        const autoSaveDecision = getAutoSaveDecision(mergedSuggestion, text, { continuation: Boolean(pendingSuggestion) });
        onTrackerDebug({ extractionDetected: detectedConversationEvent?.detected === true, autoSaveEligible: criticalSafety ? false : autoSaveDecision.eligible, autoSaveReasons: criticalSafety ? ['safety_priority'] : autoSaveDecision.reasons, writeAttempted: false, normalized: false, pendingId: pendingSuggestion?.conversationEventId || null, activeId: activeRecentEvent?.id || null, suggestionId: suggestion?.id || null, enrichmentId: enrichment?.eventId || null, error: null, timestamp: new Date().toISOString() });
        const enrichmentTarget = [activeRecentEvent, ...recentEventCandidates].filter(Boolean).find(({ id }) => id === enrichment?.eventId);
        const appliedEnrichment = Boolean(!criticalSafety && enrichmentTarget && isApplicableEventEnrichment(enrichment, enrichmentTarget.id));
        if (appliedEnrichment) {
          const updatedEvent = await onEnrichEvent(enrichment);
          setActiveRecentEvent(updatedEvent);
          await saveActiveConversationEventId(updatedEvent.id);
        }
        if (criticalSafety && mergedSuggestion) {
          const savedPendingEvent = await savePendingConversationEvent({ ...mergedSuggestion, trackingStatus: 'unconfirmed', safetyRelevant: true, relatedSafetyContextId: nextSafetyContext.id, trackerEventId: null });
          setPendingSuggestion(savedPendingEvent);
          if (nextSafetyContext.relatedConversationEventId !== savedPendingEvent.conversationEventId) {
            const linkedSafetyContext = await saveActiveSafetyContext({ ...nextSafetyContext, relatedConversationEventId: savedPendingEvent.conversationEventId });
            setActiveSafetyContext(linkedSafetyContext);
          }
        } else if (nextSafetyContext?.exitReason && mergedSuggestion) {
          const savedPendingEvent = await savePendingConversationEvent(mergedSuggestion);
          setPendingSuggestion(savedPendingEvent);
        } else if (!appliedEnrichment && mergedSuggestion && autoSaveDecision.eligible) {
          try {
            onTrackerDebug({ writeAttempted: true, timestamp: new Date().toISOString() });
            const addedEvent = await onAddEventSuggestion(mergedSuggestion);
            setActiveRecentEvent(addedEvent); setPendingSuggestion(null); setNotice('Ajouté au suivi.');
            if (nextSafetyContext?.active && !nextSafetyContext.relatedEventId) {
              const linkedSafetyContext = await saveActiveSafetyContext({ ...nextSafetyContext, relatedEventId: addedEvent.id });
              setActiveSafetyContext(linkedSafetyContext);
            }
            try { await clearPendingConversationEvent(); await saveActiveConversationEventId(addedEvent.id); } catch { /* Le tracker est déjà sauvegardé. */ }
          } catch {
            const savedPendingEvent = await savePendingConversationEvent(mergedSuggestion);
            setPendingSuggestion(savedPendingEvent); setNotice('L’ajout automatique au suivi n’a pas pu être effectué.');
            onTrackerDebug({ writeAttempted: true, error: 'AUTO_TRACKING_WRITE_FAILED', timestamp: new Date().toISOString() });
          }
        } else if (!appliedEnrichment && mergedSuggestion) {
          const savedPendingEvent = await savePendingConversationEvent(mergedSuggestion);
          setPendingSuggestion(savedPendingEvent);
          if (isNearBottomRef.current) requestAutoScroll();
        }
      }
    } catch { setNotice('Le compagnon n’est pas disponible pour le moment.'); }
    finally { sendingRef.current = false; setIsSending(false); }
  };

  const confirmClear = () => Alert.alert('Effacer la conversation ?', 'Seuls les messages de Parler enregistrés sur ce téléphone seront supprimés.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: async () => {
      try { await clearConversation(); await clearPendingConversationEvent(); await clearActiveConversationEventId(); await clearActiveSafetyContext(); setMessages([]); setPendingSuggestion(null); setActiveRecentEvent(null); setActiveSafetyContext(null); setNotice('La conversation a été effacée.'); }
      catch { setNotice('La conversation n’a pas pu être effacée.'); }
    } },
  ]);

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return <View style={[styles.messageRow, isUser ? styles.userRow : styles.companionRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.companionBubble]}>
        <Text style={styles.messageText}>{isUser ? item.text : cleanSimpleMarkdown(item.text)}</Text>
        <Text style={[styles.messageDate, isUser ? styles.userDate : styles.companionDate]}>{formatMessageDate(item.createdAt)}</Text>
      </View>
    </View>;
  };

  const addSuggestion = async () => {
    if (!pendingSuggestion || suggestionAction) return;
    setSuggestionAction('add'); setNotice('Ajout au suivi…');
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[Talk] confirm add', { eventType: pendingSuggestion.eventType, targets: pendingSuggestion.targets.length, date: pendingSuggestion.occurredAt });
      const addedEvent = await onAddEventSuggestion(pendingSuggestion);
      setActiveRecentEvent(addedEvent);
      onTrackerDebug({ extractionDetected: true, autoSaveEligible: false, writeAttempted: true, targets: addedEvent.targets.length, timestamp: new Date().toISOString() });
      setPendingSuggestion(null);
      try { await clearPendingConversationEvent(); await saveActiveConversationEventId(addedEvent.id); } catch { /* L'événement tracker est déjà sauvegardé ; ne pas permettre un doublon. */ }
      const confirmation = await addAssistantMessage('Ajouté à ton suivi.');
      if (confirmation) setMessages((current) => [...current, confirmation]);
      setNotice(''); requestAutoScroll();
    } catch { setNotice('L’ajout au suivi n’a pas pu être effectué.'); }
    finally { setSuggestionAction(''); }
  };

  const safetyIsCritical = Boolean(activeSafetyContext?.active && ['urgent', 'emergency'].includes(activeSafetyContext.level));
  const suggestionCard = !safetyIsCritical && isConfirmableEventSuggestion(pendingSuggestion) ? <View style={styles.suggestionCard}>
    <Text style={styles.suggestionTitle}>Ajouter au suivi ?</Text>
    {pendingSuggestion.targets.map((target, index) => <View key={`${target.category}-${target.type}-${index}`} style={styles.suggestionTarget}>
      <Text style={styles.suggestionName}>{target.type}</Text>
      {formatTargetMeasurements(target).map((line) => <Text key={line} style={styles.suggestionMeasure}>{line}</Text>)}
    </View>)}
    <Text style={styles.suggestionDate}>{formatSuggestionDate(pendingSuggestion)}</Text>
    {getSuggestionDetails(pendingSuggestion).map((detail) => <Text key={detail} style={styles.suggestionMeasure}>{detail}</Text>)}
    <View style={styles.suggestionActions}>
      <Pressable style={[styles.suggestionPrimary, suggestionAction && styles.disabled]} disabled={Boolean(suggestionAction)} onPress={addSuggestion}><Text style={styles.suggestionPrimaryText}>{suggestionAction === 'add' ? 'Ajout…' : 'Ajouter'}</Text></Pressable>
      <Pressable style={styles.suggestionSecondary} disabled={Boolean(suggestionAction)} onPress={async () => { const suggestion = pendingSuggestion; await clearPendingConversationEvent(); setPendingSuggestion(null); onModifyEventSuggestion(suggestion); }}><Text style={styles.suggestionSecondaryText}>Modifier</Text></Pressable>
      <Pressable style={styles.suggestionSecondary} disabled={Boolean(suggestionAction)} onPress={async () => { await clearPendingConversationEvent(); setPendingSuggestion(null); }}><Text style={styles.suggestionSecondaryText}>Non</Text></Pressable>
    </View>
  </View> : null;

  const cannotSend = !message.trim() || isSending;
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'} keyboardVerticalOffset={0}>
    <View style={[styles.layout, keyboardInset > 0 && { paddingBottom: keyboardInset }]} onLayout={({ nativeEvent }) => setLayoutDebug((current) => ({ ...current, rootHeight: Math.round(nativeEvent.layout.height), windowHeight: Math.round(Dimensions.get('window').height) }))}>
    <View style={styles.header}>
      <Pressable style={styles.headerAction} onPress={onBack}><Text style={styles.back}>← Retour</Text></Pressable>
      <Text style={styles.title}>Parler</Text>
      <View style={styles.headerAction}>{messages.length > 0 ? <Pressable onPress={confirmClear} hitSlop={8}><Text style={styles.clearText}>Effacer</Text></Pressable> : null}</View>
    </View>
    <Text style={styles.privacyNotice}>Messages enregistrés localement · seuls le message, 7 messages récents et un contexte compact sont transmis</Text>
    {typeof __DEV__ !== 'undefined' && __DEV__ ? <Text style={styles.debugText}>DEBUG tracker: extract {trackerDebug?.extractionDetected ? 'YES' : 'NO'} · auto {trackerDebug?.autoSaveEligible ? 'YES' : 'NO'} · reasons {(trackerDebug?.autoSaveReasons || []).join(',') || '-'} · write {trackerDebug?.writeAttempted ? 'YES' : 'NO'} · operation {trackerDebug?.operation || '-'} · count {trackerDebug?.countBefore ?? '-'}→{trackerDebug?.countAfter ?? '-'} · active {trackerDebug?.activeId?.slice(-8) || '-'} · enrich {trackerDebug?.enrichmentId?.slice(-8) || '-'} · persisted {trackerDebug?.persistedCount ?? '-'} · reloaded {trackerDebug?.reloadedCount ?? '-'} · react {trackerDebug?.reactCount ?? '-'} · storage {trackerDebug?.storageHasEvent ? 'YES' : 'NO'} · reactHas {trackerDebug?.reactHasEvent ? 'YES' : 'NO'} · history {trackerDebug?.historyHasEvent ? 'YES' : 'NO'} · displayed {trackerDebug?.displayed ? 'YES' : 'NO'} · id {trackerDebug?.id || '-'} · targets {trackerDebug?.targets ?? 0} · date {trackerDebug?.validDate ? 'OK' : 'INVALID'} · error {trackerDebug?.error || '-'}</Text> : null}
    {typeof __DEV__ !== 'undefined' && __DEV__ ? <Text style={styles.debugText}>DEBUG layout: window {layoutDebug.windowHeight} · root {layoutDebug.rootHeight} · list {layoutDebug.listHeight} · keyboard {layoutDebug.keyboardVisible ? 'YES' : 'NO'} · inset {keyboardInset}</Text> : null}
    {typeof __DEV__ !== 'undefined' && __DEV__ ? <Text style={styles.debugText}>CURRENT SAFETY {activeSafetyContext?.currentLevel || 'normal'} · ACTIVE SAFETY {activeSafetyContext?.level || 'normal'} · effective {activeSafetyContext?.effectiveLevel || 'normal'} · active {activeSafetyContext?.active ? 'YES' : 'NO'} · mustFollowUp {activeSafetyContext?.mustFollowUp ? 'YES' : 'NO'} · contextId {activeSafetyContext?.id?.slice(-8) || '-'} · relatedConversationEventId {activeSafetyContext?.relatedConversationEventId?.slice(-8) || '-'} · resolved {activeSafetyContext?.resolved ? 'YES' : 'NO'} · exitReason {activeSafetyContext?.exitReason || '-'}</Text> : null}
    {typeof __DEV__ !== 'undefined' && __DEV__ ? <Text style={styles.debugText}>TRACK blockedBySafety {safetyIsCritical ? 'YES' : 'NO'} · trackingStatus {pendingSuggestion?.trackingStatus || '-'} · trackerEventId {pendingSuggestion?.trackerEventId?.slice(-8) || 'null'}</Text> : null}
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
    <FlatList ref={listRef} inverted style={styles.messageList} contentContainerStyle={[styles.messagesContent, messages.length === 0 && !pendingSuggestion && styles.emptyContent]} data={displayedMessages} renderItem={renderMessage} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onLayout={({ nativeEvent }) => setLayoutDebug((current) => ({ ...current, listHeight: Math.round(nativeEvent.layout.height) }))} onScroll={({ nativeEvent }) => { isNearBottomRef.current = nativeEvent.contentOffset.y < 80; }} ListEmptyComponent={<Text style={styles.emptyText}>{isLoading ? 'Chargement…' : 'Écris librement ce qui se passe. Tes messages resteront ici.'}</Text>} ListHeaderComponent={suggestionCard} />
    <View style={styles.composerArea}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <View style={styles.composer}>
        <Pressable style={styles.micButton} disabled accessibilityRole="button" accessibilityLabel="Saisie vocale, bientôt disponible" accessibilityState={{ disabled: true }}>
          <Text style={styles.micIcon}>🎙</Text><Text style={styles.micLabel}>Bientôt</Text>
        </Pressable>
        <TextInput style={[styles.messageInput, { height: inputHeight }]} multiline value={message} onChangeText={(value) => { setMessage(value); setNotice(''); }} onContentSizeChange={({ nativeEvent }) => setInputHeight(Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, nativeEvent.contentSize.height)))} onFocus={() => { if (isNearBottomRef.current) requestAutoScroll(); }} placeholder="Écris ce qui se passe" textAlignVertical="top" scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT} />
        <Pressable style={[styles.sendButton, cannotSend && styles.disabled]} onPress={send} disabled={cannotSend}><Text style={styles.sendText}>{isSending ? '…' : 'Envoyer'}</Text></Pressable>
      </View>
    </View>
    <StatusBar style="auto" />
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F2F7F2'},layout:{flex:1},header:{paddingTop:52,paddingHorizontal:16,paddingBottom:10,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#DDE8DE',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerAction:{width:72},back:{color:'#2E7D32',fontSize:15,fontWeight:'600'},title:{fontSize:22,fontWeight:'700',color:'#245D28'},clearText:{color:'#777',fontSize:12,textAlign:'right',textDecorationLine:'underline'},privacyNotice:{backgroundColor:'#FFF',color:'#6C746D',fontSize:11,textAlign:'center',paddingHorizontal:16,paddingBottom:9},debugText:{backgroundColor:'#FFF8D8',color:'#755D00',fontSize:9,textAlign:'center',paddingHorizontal:8,paddingVertical:3},secondaryBar:{backgroundColor:'#F8FBF8',borderBottomWidth:1,borderBottomColor:'#DDE8DE'},contextToggle:{minHeight:42,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},contextToggleText:{color:'#3D6540',fontSize:13,fontWeight:'600',flexShrink:1},chevron:{color:'#517253',fontSize:18,marginLeft:12},contextPanel:{paddingHorizontal:18,paddingBottom:14},preview:{color:'#424842',fontSize:13,lineHeight:19,marginBottom:3},contextEmpty:{color:'#666',fontSize:13,lineHeight:19},memoryButton:{alignSelf:'flex-start',paddingVertical:8,paddingRight:12,marginTop:5},memoryText:{color:'#2E7D32',fontSize:13,fontWeight:'600',textDecorationLine:'underline'},
  messageList:{flex:1},messagesContent:{paddingHorizontal:16,paddingTop:12,paddingBottom:16},emptyContent:{flexGrow:1,justifyContent:'center'},emptyText:{color:'#727872',fontSize:14,lineHeight:21,textAlign:'center',paddingHorizontal:28},messageRow:{width:'100%',marginVertical:4},userRow:{alignItems:'flex-end'},companionRow:{alignItems:'flex-start'},bubble:{maxWidth:'84%',borderRadius:18,paddingHorizontal:14,paddingTop:10,paddingBottom:7},userBubble:{backgroundColor:'#DCEEDD',borderBottomRightRadius:5},companionBubble:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#DCE6DD',borderBottomLeftRadius:5},messageText:{color:'#202620',fontSize:16,lineHeight:22},messageDate:{fontSize:10,marginTop:4},userDate:{color:'#667567',textAlign:'right'},companionDate:{color:'#777',textAlign:'left'},
  composerArea:{backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#D8E3D9',paddingHorizontal:10,paddingTop:8,paddingBottom:Platform.OS === 'ios' ? 18 : 8},composer:{flexDirection:'row',alignItems:'flex-end',gap:8},micButton:{width:46,minHeight:44,alignItems:'center',justifyContent:'center',opacity:.45},micIcon:{color:'#2E7D32',fontSize:17,lineHeight:18},micLabel:{color:'#657266',fontSize:9,marginTop:1},messageInput:{flex:1,minHeight:MIN_INPUT_HEIGHT,maxHeight:MAX_INPUT_HEIGHT,borderWidth:1,borderColor:'#B9CFBB',borderRadius:22,paddingHorizontal:15,paddingTop:10,paddingBottom:10,color:'#202620',backgroundColor:'#FAFCFA',fontSize:16,lineHeight:21},sendButton:{minHeight:44,minWidth:68,borderRadius:22,backgroundColor:'#2E7D32',alignItems:'center',justifyContent:'center',paddingHorizontal:11},disabled:{opacity:.4},sendText:{color:'#FFF',fontSize:13,fontWeight:'700'},notice:{color:'#777',fontSize:11,textAlign:'center',marginBottom:5},
  suggestionCard:{marginTop:12,marginBottom:8,alignSelf:'flex-start',width:'92%',maxWidth:420,backgroundColor:'#FFF',borderWidth:1,borderColor:'#BFD5C1',borderRadius:14,padding:14},suggestionTitle:{color:'#245D28',fontSize:16,fontWeight:'700',marginBottom:9},suggestionTarget:{marginBottom:7},suggestionName:{color:'#263B28',fontSize:15,fontWeight:'600'},suggestionMeasure:{color:'#5F685F',fontSize:13,marginTop:2},suggestionDate:{color:'#687268',fontSize:12,marginTop:2,marginBottom:11},suggestionActions:{flexDirection:'row',gap:8,flexWrap:'wrap'},suggestionPrimary:{minHeight:40,justifyContent:'center',backgroundColor:'#2E7D32',borderRadius:20,paddingHorizontal:17},suggestionPrimaryText:{color:'#FFF',fontWeight:'700'},suggestionSecondary:{minHeight:40,justifyContent:'center',borderWidth:1,borderColor:'#AFC4B1',borderRadius:20,paddingHorizontal:15},suggestionSecondaryText:{color:'#315D34',fontWeight:'600'},
});
