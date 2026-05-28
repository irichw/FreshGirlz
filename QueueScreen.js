import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { joinQueue, leaveQueue, getQueue } from './QueueService';
import { CommonActions } from '@react-navigation/native';
import { supabase } from './supabase';

export default function QueueScreen({ navigation, route }) {
  const barber = route.params?.barber || { name:'Kevin J.', rating:4.9, id:null };
  const [queue, setQueue] = useState([]);
  const [myEntry, setMyEntry] = useState(route.params?.myEntry || null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  console.log('QueueScreen params:', JSON.stringify(route.params));
  

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  // Statut live/pause via Realtime Presence (le Coiffeuse y track son état)
  useEffect(() => {
    if (!barber.id) return;
    const ch = supabase.channel(`queue_control_${barber.id}`)
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        const b = Object.values(state).flat().find(p => p.role === 'coiffeuse');
        setIsPaused(b?.paused || false);
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [barber.id]);

  async function loadQueue() {
    if (!barber.id) { setLoading(false); return; }
    const result = await getQueue(barber.id);
    if (result.success) {
      setQueue(result.data);
      // Détecter si le user courant est dans cette file (si pas déjà identifié)
      if (!myEntry) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: clientData } = await supabase
            .from('clientes').select('id').eq('user_id', session.user.id).maybeSingle();
          if (clientData) {
            const found = result.data.find(q => q.client_id === clientData.id);
            if (found) setMyEntry(found);
          }
        }
      }
    }
    setLoading(false);
  }

 async function handleJoin() {
  if (joining) return;
  setJoining(true);
  console.log('handleJoin called, barber.id:', barber.id);

  const { success, error, entry } = await joinQueue({
    barberId: barber.id,
    service: 'À définir',
  });

  console.log('handleJoin result:', success, error, JSON.stringify(entry));

  if (success) {
    setMyEntry(entry);
    loadQueue();
  } else if (error === 'not_authenticated') {
    navigation.navigate('Auth');
  } else if (error === 'already_in_queue') {
    loadQueue();
  } else {
    alert('Erreur : ' + error);
  }

  setJoining(false);
}
  async function handleLeave() {
    if (!myEntry) return;
    Alert.alert('Quitter la file ?', 'Tu perdras ta place.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Quitter', style: 'destructive', onPress: async () => {
        await leaveQueue(myEntry.id);
        setMyEntry(null);
        navigation.goBack();
      }}
    ]);
  }

  const peopleAheadInQueue = myEntry
    ? queue.filter(q => q.position < myEntry.position).length
    : null;
  const myPosition = myEntry
    ? (queue.length > 0 ? (peopleAheadInQueue + 1) : myEntry.position)
    : null;
  const estimatedWait = myEntry
    ? (queue.length > 0
        ? queue.filter(q => q.position < myEntry.position).reduce((sum, e) => sum + (e.duration || 25), 0)
        : (myEntry.estimated_wait ?? 0))
    : queue.reduce((sum, e) => sum + (e.duration || 25), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.dispatch(
  CommonActions.reset({ index: 0, routes: [{ name: 'ClientTabs' }] })
)}>
  <Text style={styles.back}>← Accueil</Text>
</TouchableOpacity>
        <Text style={styles.headerBarber}>{barber.name}</Text>
        <Text style={styles.headerTitle}>File d'attente</Text>
        <View style={styles.liveRow}>
          <View style={[styles.dot, isPaused && { backgroundColor: '#A8852A' }]} />
          <Text style={[styles.liveText, isPaused && { color: '#A8852A' }]}>
            {isPaused ? 'File en pause' : loading ? 'Chargement...' : `${queue.length} client${queue.length > 1 ? 's' : ''} en attente`}
          </Text>
        </View>
      </View>

      <BlurView intensity={70} tint="light" style={styles.timerCard}>
        {myEntry ? (
          <>
            <Text style={styles.timerLabel}>TEMPS D'ATTENTE ESTIMÉ</Text>
            <Text style={styles.timerNum}>{estimatedWait}<Text style={styles.timerUnit}>min</Text></Text>
            <Text style={styles.timerPos}>Tu es <Text style={styles.timerGreen}>{myPosition}ème</Text> sur {queue.length}</Text>
            <Text style={styles.timerService}>{myEntry?.service} · {barber.name}</Text>
          </>
        ) : (
          <>
            <Text style={styles.timerLabel}>FILE D'ATTENTE</Text>
            <Text style={styles.timerNum}>{queue.length}<Text style={styles.timerUnit}> client{queue.length > 1 ? 's' : ''}</Text></Text>
            <Text style={styles.timerPos}>
              {queue.length === 0
                ? <Text style={styles.timerGreen}>Disponible</Text>
                : <>Attente estimée : <Text style={styles.timerGreen}>~{queue.reduce((s, e) => s + (e.duration || 25), 0)} min</Text></>
              }
            </Text>
          </>
        )}
      </BlurView>

      {queue.length > 0 && (
        <View style={styles.vizSection}>
          <Text style={styles.vizLabel}>POSITIONS</Text>
          <View style={styles.vizRow}>
            {queue.slice(0, 6).map((item, i) => {
              const isMe = myEntry && item.id === myEntry.id;
              const waitForPos = queue
                .filter(q => q.position < item.position)
                .reduce((sum, e) => sum + (e.duration || 25), 0);
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  style={[styles.vizSlot, isMe && styles.vizSlotMe]}
                  onPress={() => Alert.alert(
                    isMe ? 'Ma position' : `Numéro ${i + 1}`,
                    waitForPos === 0 ? 'Prochain à passer !' : `Attente estimée : ~${waitForPos} min`
                  )}>
                  <Text style={[styles.vizSlotText, isMe && styles.vizSlotTextMe]}>
                    {isMe ? 'MOI' : i + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.infoGrid}>
        <BlurView intensity={55} tint="light" style={styles.infoCard}>
          <Text style={styles.infoLabel}>Coiffeuse</Text>
          <Text style={styles.infoValue}>{barber.name}</Text>
          <Text style={styles.infoSub}>★ {barber.rating || barber.note || '4.9'}</Text>
        </BlurView>
        <BlurView intensity={55} tint="light" style={styles.infoCard}>
          <Text style={styles.infoLabel}>Ta coupe</Text>
          <Text style={styles.infoValue}>{myEntry?.service || 'À définir'}</Text>
<Text style={styles.infoSub}>~{myEntry?.estimated_wait || '?'} min</Text>
        </BlurView>
      </View>

      {!myEntry ? (
  <TouchableOpacity style={styles.btnJoin} onPress={handleJoin} disabled={joining}>
    <Text style={styles.btnJoinText}>
      {joining ? '⏳ Connexion...' : '✓ Confirmer'}
    </Text>
  </TouchableOpacity>
) : (
  <>
    <TouchableOpacity style={styles.btnDone}
      onPress={() => navigation.navigate('AfterCut', { barberId: barber.id, queueId: myEntry?.id })}>
      <Text style={styles.btnDoneText}>✂ Ma coupe est terminée</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.btnLeave} onPress={handleLeave}>
      <Text style={styles.btnLeaveText}>Quitter la file</Text>
    </TouchableOpacity>
  </>
)}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#F0FAEE' },
  blob1: { position:'absolute', top:-40, left:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(124,61,143,0.2)' },
  blob2: { position:'absolute', top:300, right:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(60,160,255,0.18)' },
  blob3: { position:'absolute', bottom:50, left:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(168,133,42,0.15)' },
  header: { padding:16, paddingTop:12 },
  back: { fontSize:14, color:'#0071E3', marginBottom:8 },
  headerBarber: { fontSize:12, color:'rgba(28,28,30,0.55)', marginBottom:2 },
  headerTitle: { fontSize:22, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.5 },
  liveRow: { flexDirection:'row', alignItems:'center', gap:5, marginTop:4 },
  dot: { width:7, height:7, borderRadius:4, backgroundColor:'#7C3D8F' },
  liveText: { fontSize:11, color:'#7C3D8F', fontWeight:'600' },
  timerCard: { marginHorizontal:16, borderRadius:20, overflow:'hidden', padding:20, borderWidth:0.5, borderColor:'rgba(124,61,143,0.3)', alignItems:'center', marginBottom:12 },
  timerLabel: { fontSize:10, fontWeight:'600', color:'#7C3D8F', letterSpacing:1, textTransform:'uppercase', marginBottom:8 },
  timerNum: { fontSize:56, fontWeight:'800', color:'#7C3D8F', lineHeight:60, letterSpacing:-2 },
  timerUnit: { fontSize:16, opacity:0.7 },
  timerPos: { fontSize:14, color:'rgba(28,28,30,0.6)', marginTop:6 },
  timerGreen: { color:'#7C3D8F', fontWeight:'700' },
  timerService: { fontSize:12, color:'#A8852A', marginTop:3 },
  vizSection: { paddingHorizontal:16, marginBottom:12 },
  vizLabel: { fontSize:10, fontWeight:'600', color:'rgba(28,28,30,0.4)', letterSpacing:0.5, textTransform:'uppercase', marginBottom:8 },
  vizRow: { flexDirection:'row', gap:5 },
  vizSlot: { flex:1, height:40, borderRadius:9, backgroundColor:'rgba(255,255,255,0.6)', alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  vizSlotMe: { backgroundColor:'#A8852A', borderColor:'#A8852A' },
  vizSlotText: { fontSize:11, fontWeight:'700', color:'rgba(28,28,30,0.5)' },
  vizSlotTextMe: { color:'#fff', fontSize:9 },
  infoGrid: { paddingHorizontal:16, flexDirection:'row', gap:7, marginBottom:12 },
  infoCard: { flex:1, borderRadius:14, overflow:'hidden', padding:11, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  infoLabel: { fontSize:9, fontWeight:'600', color:'rgba(28,28,30,0.4)', textTransform:'uppercase', letterSpacing:0.5 },
  infoValue: { fontSize:15, fontWeight:'700', color:'#1C1C1E', marginTop:4 },
  infoSub: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:2 },
  btnJoin: { marginHorizontal:16, backgroundColor:'rgba(124,61,143,0.18)', borderRadius:16, padding:16, alignItems:'center', borderWidth:1, borderColor:'rgba(124,61,143,0.4)' },
  btnJoinText: { fontSize:16, fontWeight:'800', color:'#7C3D8F' },
  btnSimulate: { marginHorizontal:16, marginBottom:8, backgroundColor:'rgba(168,133,42,0.12)', borderRadius:14, padding:13, alignItems:'center', borderWidth:0.5, borderColor:'rgba(168,133,42,0.3)' },
  btnSimulateText: { fontSize:13, fontWeight:'600', color:'#A8852A' },
  btnLeave: { marginHorizontal:16, borderRadius:14, padding:12, alignItems:'center', borderWidth:0.5, borderColor:'rgba(192,57,43,0.25)' },
  btnLeaveText: { fontSize:13, fontWeight:'600', color:'#C0392B' },
  btnDone: { marginHorizontal:16, marginBottom:8, backgroundColor:'rgba(28,28,30,0.88)', borderRadius:16, padding:16, alignItems:'center' },
btnDoneText: { fontSize:16, fontWeight:'800', color:'#fff' },
});
