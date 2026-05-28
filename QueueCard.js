import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Animated, Pressable, Linking, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { useNavigation } from '@react-navigation/native';
import { haversineKm, etaSecondsFromKm } from './utils/geo';
import { sendLocalNotification } from './notificationService';

export default function QueueCard({ mockEntry }) {
  const navigation = useNavigation();
  const [queueEntry, setQueueEntry] = useState(null);
  const [queueTotal, setQueueTotal] = useState(0);
  const [displayWait, setDisplayWait] = useState(0);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [liveEtaSeconds, setLiveEtaSeconds] = useState(null);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const queueEntryRef = useRef(null);
  const prevPeopleAheadRef = useRef(null);

  // Mode simulation : injecte les données mock sans toucher Supabase
  useEffect(() => {
    if (!mockEntry) return;
    setQueueEntry(mockEntry);
    queueEntryRef.current = mockEntry;
    setDisplayWait(mockEntry.estimated_wait ?? 25);
    setPeopleAhead(mockEntry._mock_people_ahead ?? 1);
    setQueueTotal(mockEntry._mock_queue_total ?? 3);
    setLoading(false);
  }, [mockEntry]);

  // Sync ref avec state
  useEffect(() => {
    if (mockEntry) return;
    queueEntryRef.current = queueEntry;
  }, [queueEntry, mockEntry]);

  // Notification "C'est ton tour" quand peopleAhead passe à 0
  useEffect(() => {
    if (
      peopleAhead === 0 &&
      prevPeopleAheadRef.current !== null &&
      prevPeopleAheadRef.current > 0 &&
      queueEntry?.status === 'active'
    ) {
      sendLocalNotification(
        "C'est (presque) ton tour ! ✂",
        `Tu es le prochain chez ${queueEntry?.barbers?.name ?? 'le Coiffeuse'}. Prépare-toi !`,
        { screen: 'Queue' },
      );
    }
    prevPeopleAheadRef.current = peopleAhead;
  }, [peopleAhead, queueEntry?.status]);

  // Auth listener
  useEffect(() => {
    if (mockEntry) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setQueueEntry(null);
    });
    return () => subscription.unsubscribe();
  }, [mockEntry]);

  // Fetch + Realtime
  useEffect(() => {
    if (mockEntry) return;
    let subscription;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data: clientData } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!clientData) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('queue')
        .select('*, coiffeuses(id, name, photo_url, salons(name, latitude, longitude))')
        .eq('client_id', clientData.id)
        .in('status', ['active', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setQueueEntry(data);
        setDisplayWait(data.estimated_wait || 0);
        if (data?.barber_id) {
          const [totalRes, aheadRes] = await Promise.all([
            supabase
              .from('queue')
              .select('*', { count: 'exact', head: true })
              .eq('barber_id', data.barber_id)
              .in('status', ['active', 'in_progress']),
            supabase
              .from('queue')
              .select('id')
              .eq('barber_id', data.barber_id)
              .in('status', ['active', 'in_progress'])
              .lt('position', data.position),
          ]);
          setQueueTotal(totalRes.count || 0);
          setPeopleAhead(aheadRes.data?.length || 0);
        }
      }
      setLoading(false);

      subscription = supabase
        .channel(`queue_live_${clientData.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'queue',
          filter: `client_id=eq.${clientData.id}`,
        }, (payload) => {
          console.log('REALTIME EVENT:', payload.eventType, payload.new?.status);

          if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'done') {
  const current = queueEntryRef.current;
  setQueueEntry(null);
  queueEntryRef.current = null;
  if (current) {
    const state = navigation.getState();
    const currentRoute = state?.routes?.[state?.index]?.name;
    if (currentRoute !== 'AfterCut' && currentRoute !== 'InProgress') {
      navigation.navigate('AfterCut', {
        barberId: payload.new.barber_id,
        queueId: payload.new.id,
        barber: current.barbers,
        service: payload.new.service,
      });
    }
  }
} else {
  setQueueEntry(prev => prev ? { ...prev, ...payload.new } : null);
}
}
if (payload.eventType === 'DELETE') {
  setQueueEntry(null);
}
})
.subscribe();
}

    init();
    return () => subscription?.unsubscribe();
  }, []);

  // Sync displayWait quand estimated_wait change (après poll ou realtime)
  useEffect(() => {
    if (mockEntry) return;
    if (queueEntry?.estimated_wait !== undefined) {
      setDisplayWait(queueEntry.estimated_wait);
    }
  }, [queueEntry?.estimated_wait, mockEntry]);

  // Countdown local : décrémente d'1 minute toutes les 60s (entre les polls)
  useEffect(() => {
    if (mockEntry) return;
    if (!queueEntry?.id || queueEntry.status !== 'active') return;
    const tick = setInterval(() => {
      setDisplayWait(prev => Math.max(0, prev - 1));
    }, 60000);
    return () => clearInterval(tick);
  }, [queueEntry?.id, queueEntry?.status]);

  // Polling toutes les minutes pour recalculer depuis Supabase
  useEffect(() => {
    if (mockEntry) return;
    if (!queueEntry?.id || queueEntry.status !== 'active') return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('queue')
        .select('duration, position')
        .eq('barber_id', queueEntry.barber_id)
        .in('status', ['active', 'in_progress'])
        .lt('position', queueEntry.position);

      if (data !== null) {
        const newWait = data.reduce((sum, e) => sum + (e.duration || 25), 0);
        setPeopleAhead(data.length);
        setDisplayWait(newWait);
        setQueueEntry(prev => prev ? { ...prev, estimated_wait: newWait } : null);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [queueEntry?.id, queueEntry?.position]);


  // ETA live toutes les 30s — uniquement pour position 1, statut active, Coiffeuse pas en coupe
  useEffect(() => {
    if (mockEntry) return;
    const isPosition1 = peopleAhead === 0 && queueEntry?.status === 'active';
    if (!isPosition1) { setLiveEtaSeconds(null); return; }

    const salon = queueEntry?.barbers?.salons;
    if (!salon?.latitude || !salon?.longitude) return;

    async function refreshEta() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const distKm = haversineKm(loc.coords.latitude, loc.coords.longitude, salon.latitude, salon.longitude);
        const eta = etaSecondsFromKm(distKm);
        setLiveEtaSeconds(eta);
        // Persiste dans Supabase pour que le Coiffeuse voie l'ETA
        await supabase.from('queue').update({ eta_seconds: eta }).eq('id', queueEntry.id);
      } catch (_) {}
    }

    refreshEta();
    const interval = setInterval(refreshEta, 30000);
    return () => clearInterval(interval);
  }, [queueEntry?.id, peopleAhead, queueEntry?.status]);

  // Subscription aux changements de la file du Coiffeuse → recalcule l'attente dès qu'un client devant avance
  useEffect(() => {
    if (mockEntry) return;
    if (!queueEntry?.barber_id || queueEntry.status !== 'active') return;
    const barberId = queueEntry.barber_id;
    const myPos = queueEntry.position;

    const channel = supabase
      .channel(`barber_q_${barberId}_${myPos}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `barber_id=eq.${barberId}` },
        async () => {
          const { data } = await supabase
            .from('queue')
            .select('id, duration, position')
            .eq('barber_id', barberId)
            .in('status', ['active', 'in_progress'])
            .lt('position', myPos);
          if (data !== null) {
            const newWait = data.reduce((sum, e) => sum + (e.duration || 25), 0);
            setPeopleAhead(data.length);
            setDisplayWait(newWait);
            setQueueEntry(prev => prev ? { ...prev, estimated_wait: newWait } : null);
          }
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queueEntry?.barber_id, queueEntry?.position, queueEntry?.status]);

  // Sheet animation
  const openSheet = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200,
    }).start();
  };

  const closeSheet = (cb) => {
    Animated.timing(slideAnim, {
      toValue: 400, duration: 220, useNativeDriver: true,
    }).start(() => { setVisible(false); cb?.(); });
  };

  // Actions
  const handleDecale = async () => {
    if (!queueEntry || queueEntry.decale_used) return;
    const myPos = queueEntry.position;
    const targetPos = myPos + 1;
    const newWait = Math.round((targetPos / Math.max(myPos, 1)) * queueEntry.estimated_wait);

    // Trouver le client actuellement à targetPos pour faire un vrai swap
    const { data: swapEntry } = await supabase
      .from('queue')
      .select('id')
      .eq('barber_id', queueEntry.barber_id)
      .eq('position', targetPos)
      .in('status', ['active'])
      .maybeSingle();

    // Déplacer l'autre client à myPos (swap) en premier pour éviter conflit de contrainte unique
    if (swapEntry) {
      await supabase
        .from('queue')
        .update({ position: myPos, updated_at: new Date().toISOString() })
        .eq('id', swapEntry.id);
    }

    const { error } = await supabase
      .from('queue')
      .update({ position: targetPos, estimated_wait: newWait, decale_used: true, updated_at: new Date().toISOString() })
      .eq('id', queueEntry.id);

    if (!error) setQueueEntry(prev => ({ ...prev, position: targetPos, estimated_wait: newWait, decale_used: true }));
    closeSheet();
  };

  const handleAnnuler = async () => {
    if (!queueEntry) return;
    closeSheet(async () => {
      await supabase.from('queue').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', queueEntry.id);
      setQueueEntry(null);
    });
  };

  const handleContact = () => {
    const phone = queueEntry?.barbers?.salons?.phone;
    closeSheet(() => { if (phone) Linking.openURL(`tel:${phone}`); });
  };

  const handleVoirCoupe = () => {
    closeSheet(() => {});
  };

  const handleCoupeTerminee = async () => {
    const entry = queueEntryRef.current;
  console.log('handleCoupeTerminee - entry:', JSON.stringify(entry));
  console.log('handleCoupeTerminee - navigation type:', typeof navigation.navigate);
  
  if (!entry) {
    console.log('ENTRY IS NULL - abort');
    return;
  }

    const { barber_id: barberId, id: queueId, barbers: barber, service } = entry;

    // Vide la ref immédiatement pour éviter double navigation depuis realtime
    queueEntryRef.current = null;
    setQueueEntry(null);

    // Navigue immédiatement
    navigation.navigate('AfterCut', { barberId, queueId, barber, service });

    // Met à jour Supabase en arrière-plan
    await supabase
      .from('queue')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', queueId);
  };

  // Guards
  if (!mockEntry && loading) return null;
  if (!mockEntry && !queueEntry) return null;
  if (mockEntry && !queueEntry) return null;

  const isInProgress = queueEntry.status === 'in_progress';
  const effectivePosition = peopleAhead + 1;
  const isPosition1 = effectivePosition === 1;
  const barber = queueEntry.barbers;
  const decaleUsed = queueEntry.decale_used;
  const isLast = queueTotal > 0 && effectivePosition >= queueTotal;

  // ETA affiché : live si position 1, sinon on affiche rien
  const displayEtaMin = (isPosition1 && liveEtaSeconds !== null)
    ? Math.max(0, Math.ceil((liveEtaSeconds - 120) / 60))
    : null;

  // Timer
  const startedAt = queueEntry.updated_at ? new Date(queueEntry.updated_at) : new Date();
  const totalDuration = queueEntry.duration || queueEntry.estimated_wait || 30;
  const elapsed = Math.floor((new Date() - startedAt) / 60000);
  const remaining = Math.max(0, totalDuration - elapsed);
  const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

  // --- CARTE VERTE : COUPE EN COURS (compacte) ---
  if (isInProgress) {
    const confirmTerminee = () => Alert.alert(
      'Coupe terminée ?',
      'Confirmer que ta coupe est bien terminée.',
      [
        { text: 'Non', style: 'cancel' },
        { text: "Oui, c'est bon !", onPress: handleCoupeTerminee },
      ]
    );

    return (
      <BlurView intensity={70} tint="light" style={styles.cardGreen}>
        <View style={styles.accentGreen} />
        <View style={styles.inner}>
          <View style={styles.top}>
            <View style={styles.liveRow}>
              <View style={styles.dotGreen} />
              <Text style={styles.liveTextGreen}>Coupe en cours</Text>
            </View>
            <View style={styles.barberBtnGreen}>
              <Text style={styles.barberBtnTextGreen}>✂ {barber?.name}</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('InProgress', { queueEntry })}
            style={styles.bodyGreen}>
            <View style={styles.cutIcon}>
              <Text style={styles.cutIconText}>✂</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cutName}>{queueEntry.service}</Text>
              <Text style={styles.cutSub}>{barber?.salons?.name}</Text>
            </View>
            <Text style={{ fontSize: 16, color: 'rgba(124,61,143,0.4)', alignSelf: 'center' }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.coupeTermineeBtn} activeOpacity={0.8} onPress={confirmTerminee}>
            <View style={[styles.optIcon, { backgroundColor: 'rgba(124,61,143,0.15)' }]}>
              <Text style={styles.optIconText}>✅</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optLabel}>Coupe terminée ?</Text>
              <Text style={styles.optSub}>Appuyer pour confirmer</Text>
            </View>
            <Text style={styles.manageArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    );
  }

  // --- CARTE DORÉE : EN FILE ---
  return (
    <>
      <BlurView intensity={70} tint="light" style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.inner}>
          <View style={styles.top}>
            <View style={styles.liveRow}>
              <View style={styles.dot} />
              <Text style={styles.liveText}>File active</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('BarberProfile', { barber })}
              style={styles.barberBtn}>
              <Text style={styles.barberBtnText}>✂ {barber?.name ?? 'Coiffeuse'} →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.unifiedBox}>
            <TouchableOpacity
              style={styles.bodyUnified}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('Queue', { barber, myEntry: queueEntry })}>
              <View style={styles.posBlock}>
                <Text style={styles.posNum}>{effectivePosition}</Text>
                <Text style={styles.posSup}>ème</Text>
              </View>
              <View style={styles.sep} />
              <View style={{ flex: 1 }}>
                {displayEtaMin !== null ? (
                  <>
                    <Text style={styles.waitLabel}>En route</Text>
                    <Text style={styles.waitTime}>{displayEtaMin}<Text style={styles.waitMin}> min</Text></Text>
                    <Text style={styles.waitService}>{queueEntry.service}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.waitLabel}>Attente estimée</Text>
                    <Text style={styles.waitTime}>~{displayWait}<Text style={styles.waitMin}> min</Text></Text>
                    <Text style={styles.waitService}>
                      {peopleAhead > 0 ? `${peopleAhead} personne${peopleAhead > 1 ? 's' : ''} devant · ` : 'Prochain · '}
                      {queueEntry.service}
                    </Text>
                  </>
                )}
              </View>
              <Text style={{ fontSize: 18, color: 'rgba(168,133,42,0.5)', alignSelf: 'center' }}>›</Text>
            </TouchableOpacity>

            <View style={styles.unifiedDivider} />

            <TouchableOpacity style={styles.manageBtnUnified} onPress={openSheet} activeOpacity={0.8}>
              <View style={styles.manageLeft}>
                <Text style={styles.manageIcon}>⚙</Text>
                <Text style={styles.manageText}>Gérer ma place</Text>
              </View>
              <Text style={styles.manageArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      <Modal transparent visible={visible} animationType="none" onRequestClose={() => closeSheet()}>
        <Pressable style={styles.overlay} onPress={() => closeSheet()}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <Pressable>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>MA PLACE EN FILE</Text>

              <TouchableOpacity
                style={[styles.opt, (decaleUsed || isLast) && styles.optDisabled]}
                onPress={handleDecale}
                disabled={decaleUsed || isLast}
                activeOpacity={(decaleUsed || isLast) ? 1 : 0.7}>
                <View style={[styles.optIcon, { backgroundColor: 'rgba(168,133,42,0.12)' }, (decaleUsed || isLast) && { opacity: 0.4 }]}>
                  <Text style={styles.optIconText}>⏭</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, (decaleUsed || isLast) && styles.optLabelMuted]}>
                    {decaleUsed ? 'Décalage déjà utilisé' : isLast ? 'Tu es déjà dernier' : "Me décaler d'un rang"}
                  </Text>
                  <Text style={styles.optSub}>
                    {decaleUsed ? 'Option disponible une seule fois' : isLast ? 'Plus personne derrière toi' : 'Passer derrière la personne suivante'}
                  </Text>
                </View>
                {!decaleUsed && !isLast && (
                  <View style={styles.badgeOnce}>
                    <Text style={styles.badgeText}>1×</Text>
                  </View>
                )}
                {(decaleUsed || isLast) && (
                  <View style={styles.badgeUsed}>
                    <Text style={styles.badgeTextUsed}>{decaleUsed ? 'Utilisé' : '—'}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.opt} onPress={handleContact} activeOpacity={0.7}>
                <View style={[styles.optIcon, { backgroundColor: 'rgba(0,113,227,0.10)' }]}>
                  <Text style={styles.optIconText}>📞</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optLabel}>Contacter le salon</Text>
                  <Text style={styles.optSub}>
                    {queueEntry?.barbers?.salons?.phone || 'Numéro non disponible'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.opt} onPress={handleAnnuler} activeOpacity={0.7}>
                <View style={[styles.optIcon, { backgroundColor: 'rgba(211,47,47,0.10)' }]}>
                  <Text style={styles.optIconText}>✕</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, { color: '#D32F2F' }]}>Annuler ma place</Text>
                  <Text style={styles.optSub}>Tu perdras ta position dans la file</Text>
                </View>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 10, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.35)' },
  accent: { height: 3, backgroundColor: '#A8852A' },
  cardGreen: { marginHorizontal: 16, marginTop: 10, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.3)' },
  accentGreen: { height: 3, backgroundColor: '#7C3D8F' },
  inner: { padding: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A8852A' },
  liveText: { fontSize: 12, fontWeight: '700', color: '#A8852A' },
  dotGreen: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#7C3D8F' },
  liveTextGreen: { fontSize: 12, fontWeight: '700', color: '#7C3D8F' },
  barberBtn: { backgroundColor: 'rgba(0,113,227,0.08)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  barberBtnText: { fontSize: 11, fontWeight: '700', color: '#0071E3' },
  barberBtnGreen: { backgroundColor: 'rgba(0,113,227,0.08)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  barberBtnTextGreen: { fontSize: 11, fontWeight: '700', color: '#0071E3' },
  unifiedBox: { borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.2)', overflow: 'hidden', marginBottom: 0 },
  bodyUnified: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168,133,42,0.08)', padding: 12 },
  unifiedDivider: { height: 0.5, backgroundColor: 'rgba(168,133,42,0.2)' },
  manageBtnUnified: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(28,28,30,0.04)', padding: 10, paddingHorizontal: 12 },
  body: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168,133,42,0.08)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.15)' },
  posBlock: { flexDirection: 'row', alignItems: 'flex-start' },
  posNum: { fontSize: 44, fontWeight: '900', color: '#A8852A', lineHeight: 48 },
  posSup: { fontSize: 14, fontWeight: '700', color: '#A8852A', marginTop: 6 },
  sep: { width: 1, backgroundColor: 'rgba(168,133,42,0.25)', alignSelf: 'stretch', marginHorizontal: 14 },
  waitLabel: { fontSize: 9, color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  waitTime: { fontSize: 24, fontWeight: '800', color: '#1C1C1E' },
  waitMin: { fontSize: 13, fontWeight: '500' },
  waitService: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 3 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 11, padding: 10, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  manageLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  manageIcon: { fontSize: 13 },
  manageText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  manageArrow: { fontSize: 16, color: 'rgba(28,28,30,0.35)' },
  bodyGreen: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,61,143,0.08)', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.15)', gap: 10 },
  cutIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(124,61,143,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cutIconText: { fontSize: 18 },
  cutName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  cutSub: { fontSize: 10, color: 'rgba(28,28,30,0.5)' },
  timerNum: { fontSize: 26, fontWeight: '800', color: '#7C3D8F', lineHeight: 28 },
  timerMin: { fontSize: 12, fontWeight: '500' },
  timerLabel: { fontSize: 9, color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressWrap: { marginBottom: 10 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 10, color: 'rgba(28,28,30,0.5)' },
  progressBar: { height: 5, backgroundColor: 'rgba(124,61,143,0.15)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7C3D8F', borderRadius: 3 },
  coupeTermineeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(124,61,143,0.08)', borderRadius: 11, padding: 10, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)' },
  endTimeValueCompact: { fontSize: 22, fontWeight: '900', color: '#7C3D8F', lineHeight: 24 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: 'rgba(248,248,248,0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(28,28,30,0.18)', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  sheetTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textAlign: 'center', letterSpacing: 1, marginBottom: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, marginHorizontal: 8, borderRadius: 12 },
  optDisabled: { opacity: 0.55 },
  optIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optIconText: { fontSize: 16 },
  optLabel: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', marginBottom: 1 },
  optLabelMuted: { color: 'rgba(28,28,30,0.4)' },
  optSub: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeOnce: { backgroundColor: 'rgba(168,133,42,0.15)' },
  badgeUsed: { backgroundColor: 'rgba(28,28,30,0.08)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#A8852A' },
  badgeTextUsed: { color: 'rgba(28,28,30,0.35)' },
  divider: { height: 0.5, backgroundColor: 'rgba(28,28,30,0.1)', marginHorizontal: 16, marginVertical: 6 },
});
