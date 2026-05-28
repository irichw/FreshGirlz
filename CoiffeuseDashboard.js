import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Alert, Animated, Image, PanResponder
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { Audio } from 'expo-av';
import { isWithinHours, todayDow } from './utils/hours';
import PhotoViewer from './PhotoViewer';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

const SWIPE_OPEN = 88;
const SWIPE_THRESHOLD = 44;

function SwipeableClientCard({ onDelete, children }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) translateX.setValue(Math.min(gs.dx + (isOpen.current ? SWIPE_OPEN : 0), SWIPE_OPEN));
      else if (isOpen.current) translateX.setValue(Math.max(SWIPE_OPEN + gs.dx, 0));
    },
    onPanResponderRelease: (_, gs) => {
      const open = isOpen.current ? (SWIPE_OPEN + gs.dx) > SWIPE_OPEN / 2 : gs.dx > SWIPE_THRESHOLD;
      isOpen.current = open;
      Animated.spring(translateX, { toValue: open ? SWIPE_OPEN : 0, useNativeDriver: true, tension: 120, friction: 12 }).start();
    },
  })).current;

  function close() {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 120, friction: 12 }).start();
  }

  return (
    <View style={{ marginHorizontal: 16, marginBottom: 7 }}>
      <View style={swipeStyles.deleteBg}>
        <TouchableOpacity
          style={swipeStyles.deleteAction}
          onPress={() => { close(); onDelete(); }}
          activeOpacity={0.8}>
          <Text style={swipeStyles.deleteIcon}>🗑</Text>
          <Text style={swipeStyles.deleteLabel}>Retirer</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  deleteBg: {
    position: 'absolute', top: 0, bottom: 0, left: 0, width: SWIPE_OPEN,
    backgroundColor: 'rgba(28,28,30,0.12)', borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteAction: { alignItems: 'center', gap: 3 },
  deleteIcon: { fontSize: 18 },
  deleteLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.6)' },
});

export default function CoiffeuseDashboard({ navigation }) {
  const [salonOpen, setSalonOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [queue, setQueue] = useState([]);
  const [todayAppts, setTodayAppts] = useState([]);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [barberInfo, setBarberInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newClientNotif, setNewClientNotif] = useState(null);
  const [refViewerVisible, setRefViewerVisible] = useState(false);
  const notifAnim = useRef(new Animated.Value(0)).current;
  const notifTimer = useRef(null);

  useEffect(() => {
    loadBarberData();
    loadUnread();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadBarberData();
    });
    return unsubscribe;
  }, [navigation]);

  // Chronomètre — temps réel écoulé depuis le début de la coupe en cours
  // Note : Postgres renvoie les timestamps sans 'Z', JS les interprète alors
  // en heure locale → décalage UTC. On force l'interprétation UTC en ajoutant 'Z'.
  useEffect(() => {
    const ip = queue.find(q => q.status === 'in_progress');
    if (!ip) { setElapsedSeconds(0); return; }
    const raw = ip.updated_at || '';
    const utcStr = raw && !raw.includes('Z') && !raw.includes('+') ? raw + 'Z' : raw;
    const startMs = utcStr ? new Date(utcStr).getTime() : Date.now();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [queue]);


  async function loadUnread() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', session.user.id)
      .eq('read', false);
    setUnreadCount(count || 0);
  }

  useEffect(() => {
    // Écouter les changements de file en temps réel
    const channel = supabase
      .channel('barber-queue-watch')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'queue' },
        (payload) => {
          if (payload.new?.status === 'next') {
            Alert.alert(
              '✓ Coupe terminée !',
              `${payload.new.client_name} a confirmé.\nClient suivant : prêt ?`,
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Confirmer →', onPress: () => loadQueue() }
              ]
            );
          }
          loadQueue();
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [barberInfo]);

 useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      setBarberInfo(null);
    }
  });
  return () => subscription.unsubscribe();
}, []);

  // Polling 5s pour détecter les nouvelles notifications "new_client"
  const lastNotifIdRef = useRef(null);
  const notifInitialized = useRef(false);
  useEffect(() => {
    async function checkNewNotifs() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', session.user.id)
        .eq('type', 'new_client')
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data && data.id !== lastNotifIdRef.current) {
        lastNotifIdRef.current = data.id;
        if (notifInitialized.current) {
          showNotifBanner(data);
          setUnreadCount(prev => prev + 1);
        }
      }
      notifInitialized.current = true;
    }
    checkNewNotifs();
    const interval = setInterval(checkNewNotifs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function showNotifBanner(notif) {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNewClientNotif(notif);
    notifAnim.setValue(0);
    // Jouer le son de clochette
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        interruptionModeIOS: 2,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('./assets/doorbell.mp3'),
        { shouldPlay: true }
      );
      notifTimer.current = setTimeout(() => sound.unloadAsync(), 6000);
    } catch (_) {}
    // Animation : fade in → attendre 9s → fade out
    Animated.sequence([
      Animated.timing(notifAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(9000),
      Animated.timing(notifAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setNewClientNotif(null));
  }

  // Canal Realtime Presence pour diffuser l'état pause aux clients
  const presenceRef = useRef(null);

  useEffect(() => {
    if (!barberInfo?.id) return;
    const ch = supabase.channel(`queue_control_${barberInfo.id}`, { config: { presence: { key: 'barber' } } });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ role: 'coiffeuse', paused: false });
    });
    presenceRef.current = ch;
    return () => { ch.untrack(); supabase.removeChannel(ch); };
  }, [barberInfo?.id]);

  async function handlePauseQueue() {
    if (!barberInfo?.id) return;
    const newPaused = !isPaused;
    setIsPaused(newPaused);
    if (presenceRef.current) {
      await presenceRef.current.track({ role: 'coiffeuse', paused: newPaused });
    }
  }

  async function handleLockQueue() {
    if (!barberInfo?.id) return;
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    await supabase
      .from('coiffeuses')
      .update({ queue_locked: newLocked })
      .eq('id', barberInfo.id);
  }


  async function loadBarberData() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: barber } = await supabase
      .from('coiffeuses')
      .select(`
        *,
        salons (
          id,
          name,
          address,
          city,
          rating,
          total_reviews,
          photo_url,
          is_open
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (barber) {
  setBarberInfo(barber);
  const isOpen = barber.salons?.is_open ?? false;
  setSalonOpen(isOpen);
  setIsLocked(barber.queue_locked ?? false);
  loadQueue(barber.id);
  loadTodayAppts(barber.id);

  // Synchronisation automatique is_open avec les horaires du jour
  if (barber.salons?.id) {
    const { data: hoursRow } = await supabase
      .from('opening_hours')
      .select('is_closed, open_time, close_time')
      .eq('salon_id', barber.salons.id)
      .eq('day_of_week', todayDow())
      .maybeSingle();

    const withinHours = hoursRow ? isWithinHours(hoursRow) : true;
    if (withinHours !== isOpen) {
      await supabase.from('salons').update({ is_open: withinHours }).eq('id', barber.salons.id);
      setSalonOpen(withinHours);
    }
  }
}
  } catch (error) {
    console.log('Erreur loadBarberData:', error.message);
  } finally {
    setLoading(false);
  }
}

  async function loadTodayAppts(barberId) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('appointments')
      .select('id, time, service, status, client_name, duration')
      .eq('barber_id', barberId)
      .eq('date', today)
      .in('status', ['confirmed', 'pending'])
      .order('time', { ascending: true });
    if (data) setTodayAppts(data);
  }

  async function loadQueue(barberId) {
  const id = barberId || barberInfo?.id;
  if (!id) return;
  const { data } = await supabase
    .from('queue')
    .select('*')
    .eq('barber_id', id)
    .in('status', ['active', 'in_progress', 'pending_confirmation', 'walkin'])
    .order('position', { ascending: true });
  if (data) setQueue(data);
}

  async function handleRemoveClient(client) {
    Alert.alert(
      "Retirer de la file",
      `Retirer ${client.client_name} de la file ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", style: "destructive", onPress: async () => {
          await supabase.from('queue').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', client.id);
          const behind = queue.filter(q => q.position > client.position && q.id !== client.id);
          if (behind.length) {
            await Promise.all(behind.map(e =>
              supabase.from('queue').update({ position: e.position - 1 }).eq('id', e.id)
            ));
          }
          await loadQueue();
        }},
      ]
    );
  }

  async function handleNextClient() {
  if (queue.length === 0) return;
  
  // Vérifie si une coupe est déjà en cours
  const alreadyInProgress = queue.find(q => q.status === 'in_progress');
  if (alreadyInProgress) {
    Alert.alert('Coupe en cours', 'Termine la coupe actuelle avant de passer au suivant.');
    return;
  }

  const current = queue.find(q => q.status === 'active') || queue[0];
  Alert.alert(
    'Démarrer la coupe ?',
    `${current.client_name} — ${current.service}`,
    [
      { text: 'Annuler', style: 'cancel' },
      { text: '✂ C\'est parti', onPress: async () => {
        await supabase
          .from('queue')
          .update({ status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', current.id);
        await loadQueue();
      }}
    ]
  );
}
async function toggleSalon() {
  if (salonOpen) {
    Alert.alert('Fermer la file ?', 'Les clients ne pourront plus rejoindre.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Fermer', style: 'destructive', onPress: async () => {
          await supabase
            .from('salons')
            .update({ is_open: false })
            .eq('id', barberInfo?.salons?.id);
          setSalonOpen(false);
        }}
      ]
    );
  } else {
    await supabase
      .from('salons')
      .update({ is_open: true })
      .eq('id', barberInfo?.salons?.id);
    setSalonOpen(true);
  }
}

  async function handleOpenQueue() {
    navigation.navigate('OpenQueue', {
      barber: { name: barberInfo?.name || 'Coiffeuse', id: barberInfo?.id }
    });
    setSalonOpen(true);
  }

  function statusColor(s, index) {
  if (s === 'in_progress') return '#7C3D8F';
  if (index === 0) return '#7C3D8F';
  if (s === 'walkin') return '#A8852A';
  return 'rgba(28,28,30,0.4)';
}

function statusLabel(s, index) {
  if (s === 'in_progress') return '✂ En cours';
  if (index === 0) return '⏳ Prochain';
  if (s === 'walkin') return 'Walk-in';
  return 'En attente';
}

  const currentClient = queue.find(q => q.status === 'in_progress') || queue[0] || null;

  function getEstimatedPassageTime(waitingIndex) {
    const AVG = 25;
    const currentDur = currentClient?.duration || currentClient?.estimated_wait || AVG;
    const remainingCurrentMin = Math.max(0, currentDur - elapsedSeconds / 60);
    let waitMin = remainingCurrentMin;
    for (let i = 0; i < waitingIndex; i++) {
      waitMin += waiting[i]?.duration || waiting[i]?.estimated_wait || AVG;
    }
    const d = new Date(Date.now() + waitMin * 60 * 1000);
    return `~${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
const waiting = queue.filter(q => q.id !== currentClient?.id);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

       {/* HEADER */}
<View style={styles.header}>
  <View style={{ flex: 1 }}>
    <Text style={styles.headerName}>{barberInfo?.name || 'Coiffeuse'} ✂</Text>
    <Text style={styles.headerSalon}>
      {barberInfo?.salons?.name || 'Salon'}
    </Text>
  </View>
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
    <TouchableOpacity
      style={styles.headerAv}
      onPress={() => { loadUnread(); navigation.navigate('BarberNotifications'); }}>
      <Image source={require('./assets/notiffull.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
      {unreadCount > 0 && (
        <View style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  </View>
</View>

        {/* STATUS TOGGLE */}
        <BlurView intensity={60} tint="light" style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.statusTitle}>
                {salonOpen ? 'File ouverte ✓' : 'File fermée'}
              </Text>
              {isLocked && (
                <View style={{ backgroundColor: 'rgba(168,133,42,0.15)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#A8852A' }}>🔒 Verrouillée</Text>
                </View>
              )}
            </View>
            <Text style={styles.statusSub}>
              {isLocked
                ? 'Nouveaux clients bloqués · file en cours active'
                : salonOpen
                  ? `${queue.length} client(s) en attente`
                  : 'Appuie pour ouvrir ta file'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, salonOpen && styles.toggleOn]}
            onPress={() => {
  if (salonOpen) {
    Alert.alert('Fermer la file ?', 'Les clients ne pourront plus rejoindre.',
      [{ text:'Annuler', style:'cancel' },
       { text:'Fermer', style:'destructive', onPress:() => toggleSalon() }]);
  } else {
    navigation.navigate('OpenQueue', {
      barber: { name: barberInfo?.name, id: barberInfo?.id, salonId: barberInfo?.salons?.id }
    });
  }
}}>
            <View style={[styles.toggleThumb, salonOpen && styles.toggleThumbOn]} />
          </TouchableOpacity>
        </BlurView>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          {[
            { num: queue.length, lbl:'En file', color:'#7C3D8F' },
            { num: waiting.length, lbl:'En attente', color:'#B06A00' },
            { num: queue.filter(q=>q.status==='walkin').length, lbl:'Walk-in', color:'#A8852A' },
            { num: barberInfo?.rating || '—', lbl:'Note', color:'#1C1C1E' },
          ].map((k) => (
            <BlurView key={k.lbl} intensity={55} tint="light" style={styles.kpiCard}>
              <Text style={[styles.kpiNum, {color: k.color}]}>{k.num}</Text>
              <Text style={styles.kpiLbl}>{k.lbl}</Text>
            </BlurView>
          ))}
        </View>

        {/* CLIENT EN COURS */}
        {currentClient && (
  <View>
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>✂ En cours</Text>
    </View>
    <BlurView intensity={65} tint="light" style={styles.currentCard}>
      <View style={styles.currentTop}>
        <View style={styles.currentAv}>
          <Text style={styles.currentAvText}>
            {currentClient.client_name?.split(' ').map(n=>n[0]).join('') || '?'}
          </Text>
        </View>
        <View style={styles.currentInfo}>
          <Text style={styles.currentName}>{currentClient.client_name}</Text>
          <Text style={styles.currentService}>{currentClient.service}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
            <View style={[styles.currentTag, {backgroundColor: '#7C3D8F20'}]}>
              <Text style={[styles.currentTagText, {color: '#7C3D8F'}]}>
                {currentClient.status === 'in_progress' ? '✂ En cours' : '⏳ En attente'}
              </Text>
            </View>
            {currentClient.status === 'in_progress' && elapsedSeconds > 0 && (
              <View style={[styles.currentTag, {backgroundColor: 'rgba(0,113,227,0.1)'}]}>
                <Text style={[styles.currentTagText, {color: '#0071E3'}]}>
                  {`${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} ⏱`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* RÉFÉRENCE CLIENT — carte proéminente */}
      {currentClient.reference_url ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setRefViewerVisible(true)}
          style={styles.refCard}>
          <Image
            source={{ uri: currentClient.reference_url }}
            style={styles.refCardImg}
            resizeMode="cover"
          />
          <View style={styles.refCardOverlay}>
            <View style={styles.refCardBadge}>
              <Text style={styles.refCardBadgeText}>🔖 Référence client</Text>
            </View>
            <View style={styles.refCardZoomBtn}>
              <Text style={styles.refCardZoomText}>⊕ Agrandir</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Bouton selon le statut */}
      {currentClient.status === 'pending_confirmation' ? (
  <TouchableOpacity
    style={[styles.btnDone, { backgroundColor: '#7C3D8F' }]}
    onPress={async () => {
      await supabase
        .from('queue')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', currentClient.id);
      await loadQueue();
      const nextClient = waiting[0] || null;
      navigation.navigate('AfterCutBarber', {
        currentClient,
        nextClient,
        waitingQueue: waiting,
        barberInfo,
        elapsedSeconds,
      });
    }}>
    <Text style={[styles.btnDoneText, { color: '#fff' }]}>✓ Confirmer la fin de coupe</Text>
  </TouchableOpacity>
) : currentClient.status === 'in_progress' ? (
  <TouchableOpacity
    style={[styles.btnDone, { backgroundColor: 'rgba(124,61,143,0.18)', borderWidth: 1, borderColor: 'rgba(124,61,143,0.35)' }]}
    onPress={async () => {
      Alert.alert('Coupe terminée ?', '', [
        { text: 'Annuler', style: 'cancel' },
        { text: '✓ Confirmer', onPress: async () => {
          await supabase
            .from('queue')
            .update({ status: 'done', updated_at: new Date().toISOString() })
            .eq('id', currentClient.id);
          await loadQueue();
          const nextClient = waiting[0] || null;
          navigation.navigate('AfterCutBarber', {
            currentClient,
            nextClient,
            waitingQueue: waiting,
            barberInfo,
            elapsedSeconds,
          });
        }}
      ]);
    }}>
    <Text style={[styles.btnDoneText, { color: '#7C3D8F' }]}>✓ Coupe terminée</Text>
  </TouchableOpacity>
) : (
  <TouchableOpacity style={styles.btnDone} onPress={handleNextClient}>
    <Text style={styles.btnDoneText}>✂ Démarrer la coupe</Text>
  </TouchableOpacity>
)}
    </BlurView>
  </View>
)}

        {/* ACTIONS RAPIDES */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Actions rapides</Text>
        </View>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionNext]}
            onPress={handleNextClient}>
            <Text style={styles.actionIcon}>→</Text>
            <Text style={[styles.actionTitle, {color:'#7C3D8F'}]}>Client suivant</Text>
            <Text style={[styles.actionSub, {color:'rgba(124,61,143,0.65)'}]}>Passer au suivant</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionPause]}
            onPress={handlePauseQueue}>
            <Text style={styles.actionIcon}>{isPaused ? '▶' : '⏸'}</Text>
            <Text style={[styles.actionTitle, {color:'#B06A00'}]}>{isPaused ? 'Reprendre' : 'Pause file'}</Text>
            <Text style={[styles.actionSub, {color:'rgba(176,106,0,0.65)'}]}>{isPaused ? 'Relancer la file' : 'Bloquer nouveaux'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionAdd]}
            onPress={() => navigation.navigate('AddClient', {
              barberId: barberInfo?.id,
              salonId:  barberInfo?.salons?.id,
            })}>
            <Text style={styles.actionIcon}>➕</Text>
            <Text style={[styles.actionTitle, {color:'#0071E3'}]}>Ajouter client</Text>
            <Text style={[styles.actionSub, {color:'rgba(0,113,227,0.65)'}]}>Walk-in · fin de file</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionClose, isLocked && { backgroundColor: 'rgba(168,133,42,0.12)', borderColor: 'rgba(168,133,42,0.3)' }]}
            onPress={handleLockQueue}>
            <Text style={styles.actionIcon}>{isLocked ? '🔓' : '🔒'}</Text>
            <Text style={[styles.actionTitle, { color: isLocked ? '#A8852A' : '#C0392B' }]}>
              {isLocked ? 'Déverrouiller' : 'Verrouiller file'}
            </Text>
            <Text style={[styles.actionSub, { color: isLocked ? 'rgba(168,133,42,0.65)' : 'rgba(192,57,43,0.65)' }]}>
              {isLocked ? 'Réouvrir aux nouveaux' : 'Bloquer les nouveaux'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { width: '100%', backgroundColor: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.2)' }]}
            onPress={() => {
              Alert.alert('Fermer la file ?', 'Les clients ne pourront plus rejoindre. Ceux déjà en file restent.',
                [{ text: 'Annuler', style: 'cancel' },
                 { text: 'Fermer', style: 'destructive', onPress: () => toggleSalon() }]);
            }}>
            <Text style={styles.actionIcon}>🚫</Text>
            <Text style={[styles.actionTitle, { color: '#C0392B' }]}>Fermer la file</Text>
            <Text style={[styles.actionSub, { color: 'rgba(192,57,43,0.65)' }]}>Fin de journée · aucun nouveau client</Text>
          </TouchableOpacity>
        </View>

        {/* FILE CLIENTS */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>
            Clients en attente{waiting.length > 0 ? ` · ${waiting.length}` : ''}
          </Text>
          <View style={[styles.liveBadge, isPaused && { backgroundColor: 'rgba(168,133,42,0.12)', borderColor: 'rgba(168,133,42,0.3)' }]}>
            <View style={[styles.liveDot, isPaused && { backgroundColor: '#A8852A' }]} />
            <Text style={[styles.liveText, isPaused && { color: '#A8852A' }]}>{isPaused ? 'En pause' : `Live · ${queue.length}`}</Text>
          </View>
        </View>

        {queue.length === 0 && todayAppts.length === 0 ? (
          <BlurView intensity={50} tint="light" style={styles.emptyCard}>
            <Text style={styles.emptyText}>Aucun client en file pour l'instant</Text>
          </BlurView>
        ) : (
          <>
            {waiting.map((client, index) => (
              <SwipeableClientCard
                key={client.id}
                onDelete={() => handleRemoveClient(client)}>
                <BlurView intensity={55} tint="light" style={[styles.clientCard, { marginHorizontal: 0, marginBottom: 0 }]}>
                  <View style={[styles.clientPos,
                    {backgroundColor: statusColor(client.status, index)+'18',
                     borderColor: statusColor(client.status, index)+'40'}]}>
                    <Text style={[styles.clientPosText,
                      {color: statusColor(client.status, index)}]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.clientAv}>
                    <Text style={styles.clientAvText}>
                      {client.client_name?.split(' ').map(n=>n[0]).join('') || '?'}
                    </Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{client.client_name}</Text>
                    <Text style={styles.clientService}>
                      {client.service}{client.estimated_wait ? ` · ${client.estimated_wait} min` : ''}
                    </Text>
                  </View>
                  <View style={styles.clientRight}>
                    {index === 0 && client.eta_seconds != null ? (
                      <Text style={[styles.clientTime, { color: '#0071E3' }]}>
                        En route {Math.max(0, Math.ceil((client.eta_seconds - 120) / 60))} min
                      </Text>
                    ) : null}
                    <Text style={[styles.clientTime, { color: '#0071E3', fontWeight: '700' }]}>
                      {getEstimatedPassageTime(index)}
                    </Text>
                    <View style={[styles.clientStatus,
                      {backgroundColor: statusColor(client.status, index)+'15',
                       borderColor: statusColor(client.status, index)+'30'}]}>
                      <Text style={[styles.clientStatusText,
                        {color: statusColor(client.status, index)}]}>
                        {statusLabel(client.status, index)}
                      </Text>
                    </View>
                  </View>
                </BlurView>
              </SwipeableClientCard>
            ))}

            {/* RDV DU JOUR intégrés dans la file */}
            {todayAppts.length > 0 && (
              <>
                <View style={[styles.secRow, { paddingTop: 14 }]}>
                  <Text style={[styles.secTitle, { fontSize: 14, color: 'rgba(28,28,30,0.55)' }]}>📅 RDV confirmés aujourd'hui</Text>
                </View>
                {todayAppts.map(appt => (
                  <BlurView key={appt.id} intensity={55} tint="light"
                    style={[styles.clientCard, { borderColor: 'rgba(0,113,227,0.2)', backgroundColor: 'rgba(0,113,227,0.03)' }]}>
                    <View style={[styles.clientPos, { backgroundColor: 'rgba(0,113,227,0.1)', borderColor: 'rgba(0,113,227,0.3)' }]}>
                      <Text style={{ fontSize: 12, color: '#0071E3' }}>📅</Text>
                    </View>
                    <View style={styles.clientAv}>
                      <Text style={styles.clientAvText}>
                        {appt.client_name?.split(' ').map(n=>n[0]).join('') || '?'}
                      </Text>
                    </View>
                    <View style={styles.clientInfo}>
                      <Text style={styles.clientName}>{appt.client_name}</Text>
                      <Text style={styles.clientService}>{appt.service}</Text>
                    </View>
                    <View style={styles.clientRight}>
                      <Text style={[styles.clientTime, { color: '#0071E3', fontWeight: '700' }]}>
                        {appt.time?.slice(0, 5) || '--:--'}
                      </Text>
                      <View style={[styles.clientStatus, { backgroundColor: 'rgba(0,113,227,0.1)', borderColor: 'rgba(0,113,227,0.25)' }]}>
                        <Text style={[styles.clientStatusText, { color: '#0071E3' }]}>
                          {appt.status === 'confirmed' ? '✓ RDV' : '⏳ RDV'}
                        </Text>
                      </View>
                    </View>
                  </BlurView>
                ))}
              </>
            )}
          </>
        )}

      </ScrollView>

      {/* TAB BAR */}
      <CoiffeuseTabBar active="CoiffeuseDashboard" navigation={navigation} />

      {/* BANNER NOTIFICATION NOUVEAU CLIENT (10s) */}
      {newClientNotif && (
        <Animated.View style={[styles.notifBanner, { opacity: notifAnim, transform: [{ translateY: notifAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }]}>
          <Image source={require('./assets/notiffull.png')} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>{newClientNotif.title}</Text>
            <Text style={styles.notifBody}>{newClientNotif.body}</Text>
          </View>
        </Animated.View>
      )}

      {/* PHOTO VIEWER — référence plein écran avec zoom */}
      <PhotoViewer
        visible={refViewerVisible}
        photos={currentClient?.reference_url
          ? [{ photo_url: currentClient.reference_url, service: currentClient?.service }]
          : []}
        initialIndex={0}
        onClose={() => setRefViewerVisible(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notifBanner: { position:'absolute', top:60, left:16, right:16, backgroundColor:'rgba(28,28,30,0.92)', borderRadius:16, padding:14, flexDirection:'row', alignItems:'center', gap:12, zIndex:999, shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.25, shadowRadius:12, elevation:10 },
  notifIcon: { fontSize:24 },
  notifTitle: { fontSize:13, fontWeight:'700', color:'#fff', marginBottom:2 },
  notifBody: { fontSize:12, color:'rgba(255,255,255,0.7)' },
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#F0FAEE' },
  blob1: { position:'absolute', top:-50, left:-50, width:280, height:280, borderRadius:140, backgroundColor:'rgba(124,61,143,0.2)' },
  blob2: { position:'absolute', top:300, right:-60, width:260, height:260, borderRadius:130, backgroundColor:'rgba(168,133,42,0.18)' },
  blob3: { position:'absolute', bottom:100, left:-40, width:240, height:240, borderRadius:120, backgroundColor:'rgba(201,80,122,0.12)' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', padding:16, paddingTop:12 },
  headerName: { fontSize:22, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.5 },
  headerSalon: { fontSize:13, color:'rgba(28,28,30,0.55)', marginTop:2 },
  headerAv: { width:40, height:40, borderRadius:13, backgroundColor:'rgba(168,133,42,0.15)', borderWidth:1.5, borderColor:'rgba(168,133,42,0.35)', alignItems:'center', justifyContent:'center' },
  headerAvText: { fontSize:13, fontWeight:'800', color:'#A8852A' },
  statusCard: { marginHorizontal:16, borderRadius:16, overflow:'hidden', padding:13, flexDirection:'row', alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', marginBottom:10 },
  statusLeft: { flex:1 },
  statusTitle: { fontSize:15, fontWeight:'700', color:'#1C1C1E' },
  statusSub: { fontSize:12, color:'rgba(28,28,30,0.5)', marginTop:2 },
  toggle: { width:46, height:26, borderRadius:13, backgroundColor:'rgba(28,28,30,0.15)', position:'relative', flexShrink:0 },
  toggleOn: { backgroundColor:'#7C3D8F' },
  toggleThumb: { width:22, height:22, borderRadius:11, backgroundColor:'#fff', position:'absolute', top:2, left:2, shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.2, shadowRadius:4, elevation:3 },
  toggleThumbOn: { left:22 },
  kpiRow: { paddingHorizontal:16, flexDirection:'row', gap:6, marginBottom:10 },
  kpiCard: { flex:1, borderRadius:13, overflow:'hidden', padding:10, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  kpiNum: { fontSize:20, fontWeight:'800' },
  kpiLbl: { fontSize:9, color:'rgba(28,28,30,0.5)', marginTop:2 },
  secRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingTop:10, paddingBottom:8 },
  secTitle: { fontSize:17, fontWeight:'800', color:'#1C1C1E' },
  currentCard: { marginHorizontal:16, borderRadius:20, overflow:'hidden', padding:15, borderWidth:0.5, borderColor:'rgba(124,61,143,0.3)', marginBottom:4 },
  refCard: { marginHorizontal:0, marginTop:12, marginBottom:4, borderRadius:14, overflow:'hidden', height:170, position:'relative' },
  refCardImg: { width:'100%', height:'100%' },
  refCardOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', padding:10, backgroundColor:'rgba(0,0,0,0.18)' },
  refCardBadge: { backgroundColor:'rgba(0,0,0,0.55)', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  refCardBadgeText: { fontSize:12, fontWeight:'700', color:'#fff' },
  refCardZoomBtn: { backgroundColor:'rgba(168,133,42,0.85)', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  refCardZoomText: { fontSize:12, fontWeight:'700', color:'#fff' },
  currentTop: { flexDirection:'row', gap:12, alignItems:'flex-start', marginBottom:12 },
  currentAv: { width:52, height:52, borderRadius:16, backgroundColor:'rgba(168,133,42,0.15)', borderWidth:1.5, borderColor:'rgba(168,133,42,0.35)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  currentAvText: { fontSize:17, fontWeight:'800', color:'#A8852A' },
  currentInfo: { flex:1 },
  currentName: { fontSize:17, fontWeight:'700', color:'#1C1C1E' },
  currentService: { fontSize:13, color:'rgba(28,28,30,0.55)', marginTop:2 },
  currentTag: { borderRadius:20, paddingHorizontal:8, paddingVertical:2, alignSelf:'flex-start', marginTop:5 },
  currentTagText: { fontSize:11, fontWeight:'600' },
  btnDone: { backgroundColor:'rgba(124,61,143,0.18)', borderRadius:14, padding:14, alignItems:'center', borderWidth:1, borderColor:'rgba(124,61,143,0.35)' },
  btnDoneText: { fontSize:15, fontWeight:'800', color:'#7C3D8F' },
  actionsGrid: { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 },
  actionBtn: { width:'47.5%', borderRadius:17, padding:13, borderWidth:0.5 },
  actionNext: { backgroundColor:'rgba(124,61,143,0.12)', borderColor:'rgba(124,61,143,0.3)' },
  actionPause: { backgroundColor:'rgba(176,106,0,0.1)', borderColor:'rgba(176,106,0,0.25)' },
  actionAdd: { backgroundColor:'rgba(0,113,227,0.08)', borderColor:'rgba(0,113,227,0.22)' },
  actionClose: { backgroundColor:'rgba(192,57,43,0.08)', borderColor:'rgba(192,57,43,0.2)' },
  actionIcon: { fontSize:22, marginBottom:6 },
  actionTitle: { fontSize:13, fontWeight:'700' },
  actionSub: { fontSize:11, marginTop:3, lineHeight:15 },
  liveBadge: { flexDirection:'row', alignItems:'center', gap:5 },
  liveDot: { width:7, height:7, borderRadius:4, backgroundColor:'#7C3D8F' },
  liveText: { fontSize:12, color:'#7C3D8F', fontWeight:'600' },
  emptyCard: { marginHorizontal:16, borderRadius:14, overflow:'hidden', padding:16, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', alignItems:'center' },
  emptyText: { fontSize:13, color:'rgba(28,28,30,0.4)' },
  clientCard: { marginHorizontal:16, marginBottom:7, borderRadius:16, overflow:'hidden', padding:12, flexDirection:'row', gap:9, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  clientPos: { width:28, height:28, borderRadius:9, alignItems:'center', justifyContent:'center', borderWidth:0.5, flexShrink:0 },
  clientPosText: { fontSize:12, fontWeight:'700' },
  clientAv: { width:34, height:34, borderRadius:10, backgroundColor:'rgba(168,133,42,0.12)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  clientAvText: { fontSize:12, fontWeight:'700', color:'#A8852A' },
  clientInfo: { flex:1 },
  clientName: { fontSize:14, fontWeight:'600', color:'#1C1C1E' },
  clientService: { fontSize:11, color:'rgba(28,28,30,0.55)', marginTop:1 },
  clientRight: { alignItems:'flex-end', gap:5 },
  clientTime: { fontSize:13, fontWeight:'600' },
  clientStatus: { borderRadius:20, paddingHorizontal:8, paddingVertical:3, borderWidth:0.5 },
  clientStatusText: { fontSize:10, fontWeight:'600' },
  tabBarOuter:     { position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 18 },
  tabBarInner:     { borderRadius: 22, overflow: 'hidden', flexDirection: 'row', height: 54, alignItems: 'center', paddingHorizontal: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)' },
  tabItem:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill:        { alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 16, overflow: 'hidden', alignSelf: 'stretch', marginHorizontal: 3 },
  tabPillActive:  { backgroundColor: 'rgba(28,28,30,0.1)' },
  tabPillBlur:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tabImg:         { width: 22, height: 22, resizeMode: 'contain' },
  tabIcon:        { fontSize: 17 },
  tabLabel:       { fontSize: 10, fontWeight: '500', color: 'rgba(28,28,30,0.4)' },
  tabLabelActive: { color: '#1C1C1E', fontWeight: '700' },
  tabAvatar:      { width: 24, height: 24, borderRadius: 12 },
});
