import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, RefreshControl, Image, Alert, Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { isWithinHours, todayDow } from './utils/hours';

// ─── Tendances statiques (à remplacer par vraies données analytics) ─────────
const TRENDS = [
  { id: 't1', name: 'Burst Fade + Designs', pct: 38, emoji: '🔥', hot: true  },
  { id: 't2', name: 'Afro Twist',           pct: 28, emoji: '✨', hot: false },
  { id: 't3', name: 'Drop Fade',            pct: 22, emoji: '💫', hot: false },
  { id: 't4', name: 'Mid Taper',            pct: 17, emoji: '⚡', hot: false },
  { id: 't5', name: 'Dreadlocks',           pct: 15, emoji: '🌿', hot: false },
];

const APPT_STATUS = {
  confirmed: { label: '✓ Confirmé',   color: '#7C3D8F' },
  pending:   { label: '⏳ En attente', color: '#B06A00' },
  done:      { label: '✂ Terminé',    color: 'rgba(28,28,30,0.4)' },
  cancelled: { label: '✕ Annulé',     color: '#C0392B' },
  no_show:   { label: '✕ Absent',     color: '#C0392B' },
};

function getStatus(isOpen) {
  if (!isOpen) return { emoji: '🔴', label: 'Fermé',      color: '#C0392B', bg: 'rgba(192,57,43,0.12)' };
  return               { emoji: '🟢', label: 'Disponible', color: '#7C3D8F', bg: 'rgba(124,61,143,0.12)' };
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function CoiffeuseHomeScreen({ navigation }) {
  const [barberInfo,    setBarberInfo]    = useState(null);
  const [salonOpen,     setSalonOpen]     = useState(false);
  const [todayAppts,    setTodayAppts]    = useState([]);
  const [portfolio,     setPortfolio]     = useState([]);
  const [smartNotifs,   setSmartNotifs]   = useState([]);
  const [marketingTips, setMarketingTips] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [toggling,      setToggling]      = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    init();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900,  useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900,  useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  async function init() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: barber } = await supabase
        .from('coiffeuses')
        .select('*, salons(id, name, address, rating, total_reviews, is_open, photo_url)')
        .eq('user_id', user.id)
        .single();

      if (!barber) return;
      setBarberInfo(barber);

      // Synchronisation is_open avec les horaires du jour
      let computedOpen = barber.salons?.is_open ?? false;
      if (barber.salons?.id) {
        const { data: hoursRow } = await supabase
          .from('opening_hours')
          .select('is_closed, open_time, close_time')
          .eq('salon_id', barber.salons.id)
          .eq('day_of_week', todayDow())
          .maybeSingle();

        const withinHours = hoursRow ? isWithinHours(hoursRow) : true;
        if (withinHours !== computedOpen) {
          await supabase.from('salons').update({ is_open: withinHours }).eq('id', barber.salons.id);
          computedOpen = withinHours;
        }
      }
      setSalonOpen(computedOpen);

      await Promise.all([
        loadTodayAppts(barber.id),
        loadPortfolio(barber.id),
        loadUnread(user.id),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTodayAppts(bid) {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('appointments')
      .select('id, time, service, status, client_name, duration')
      .eq('barber_id', bid)
      .eq('date', today)
      .order('time', { ascending: true });
    if (data) {
      setTodayAppts(data);
      buildSmartNotifs(data);
    }
  }

  async function loadPortfolio(bid) {
    const { data } = await supabase
      .from('coupes')
      .select('id, service, name, likes, created_at, photo_url')
      .eq('barber_id', bid)
      .order('created_at', { ascending: false })
      .limit(8);
    if (data) setPortfolio(data);
  }

  async function loadUnread(userId) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('read', false);
    setUnreadCount(count || 0);
  }

  function buildSmartNotifs(appts) {
    const h = new Date().getHours();
    const confirmed = appts.filter(a => a.status === 'confirmed').length;
    const pending   = appts.filter(a => a.status === 'pending').length;
    const notifs = [];

    if (h >= 9 && h < 10) {
      notifs.push({ id: 'peak', emoji: '⚡', color: '#B06A00',
        text: "Heure de pointe dans 30 min — prépare-toi !" });
    } else if (h >= 15 && h < 17) {
      notifs.push({ id: 'peak2', emoji: '⚡', color: '#B06A00',
        text: "Pic de demandes à 16h — file encore ouverte ?" });
    }

    notifs.push({ id: 'views', emoji: '👁', color: '#0071E3',
      text: "3 clients ont consulté ton profil aujourd'hui" });

    if (confirmed < 4) {
      notifs.push({ id: 'slots', emoji: '📅', color: '#A8852A',
        text: "Créneaux libres cet après-midi — partage ta dispo" });
    }

    if (pending > 0) {
      notifs.push({ id: 'pend', emoji: '⏳', color: '#B06A00',
        text: `${pending} RDV en attente de ta confirmation` });
    }

    notifs.push({ id: 'rate', emoji: '📉', color: '#C0392B',
      text: "Ton taux de réponse baisse depuis 3 semaines" });

    setMarketingTips([
      { id: 'trend',  emoji: '🔥', color: '#C0392B', title: "Burst Fade +38% cette semaine",
        body: "Ce style explose dans ta zone. Poste ton meilleur Burst Fade pour capter ce trafic organique.",
        cta: "Voir les tendances" },
      { id: 'rate',   emoji: '⭐', color: '#A8852A', title: `Note ${4.9}★ — mets-la en avant`,
        body: "Affiche ta note dans ta bio Instagram et Google Business pour convertir les visiteurs en clients.",
        cta: "Comment faire →" },
      { id: 'loyal',  emoji: '💬', color: '#7C3D8F', title: "Relance tes clients fidèles",
        body: "Tes clients réguliers sont ta meilleure pub. Un rappel WhatsApp peut générer 2–3 RDV de plus.",
        cta: "Voir mes clients →" },
    ]);

    setSmartNotifs(notifs.slice(0, 4));
  }

  async function handleToggleOpen() {
    if (!barberInfo?.salons?.id || toggling) return;
    if (salonOpen) {
      Alert.alert(
        "Fermer le salon ?",
        "Les clients ne pourront plus rejoindre la file.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Fermer", style: "destructive", onPress: async () => {
            setToggling(true);
            setSalonOpen(false);
            await supabase.from('salons').update({ is_open: false }).eq('id', barberInfo.salons.id);
            setToggling(false);
          }},
        ]
      );
    } else {
      setToggling(true);
      setSalonOpen(true);
      await supabase.from('salons').update({ is_open: true }).eq('id', barberInfo.salons.id);
      setToggling(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  }

  function timeAgo(d) {
    const sec = Math.floor((Date.now() - new Date(d)) / 1000);
    if (sec < 60)    return "À l'instant";
    if (sec < 3600)  return `${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} h`;
    return `${Math.floor(sec / 86400)} j`;
  }

  const status       = getStatus(salonOpen);
  const confirmedCnt = todayAppts.filter(a => ['confirmed', 'done'].includes(a.status)).length;
  const pendingCnt   = todayAppts.filter(a => a.status === 'pending').length;
  const todayLabel   = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.wallpaper}><View style={s.blob1} /><View style={s.blob2} /></View>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} /><View style={s.blob2} /><View style={s.blob3} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A8852A" />}>

        {/* ════════════════════════════════════════════════
            HEADER PREMIUM
        ════════════════════════════════════════════════ */}
        <BlurView intensity={55} tint="light" style={s.headerCard}>

          {/* Ligne sup : notifs + date + déconnexion */}
          <View style={s.headerTopRow}>
            <Text style={s.headerDate}>{todayLabel}</Text>
            <TouchableOpacity
                style={s.notifBtn}
                onPress={() => navigation.navigate('BarberNotifications')}>
                <Image source={require('./assets/notiffull.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                {unreadCount > 0 && (
                  <View style={s.badge}><Text style={s.badgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
                )}
              </TouchableOpacity>
          </View>

          {/* Photo + Infos */}
          <View style={s.headerMain}>
            <TouchableOpacity
              onPress={() => navigation.navigate('BarberProfile', { barber: barberInfo })}
              activeOpacity={0.85}>
              <View style={s.shopPhoto}>
                {barberInfo?.salons?.photo_url || barberInfo?.photo_url ? (
                  <Image
                    source={{ uri: barberInfo?.salons?.photo_url || barberInfo?.photo_url }}
                    style={s.shopPhotoImg}
                  />
                ) : (
                  <Text style={s.shopPhotoFallback}>
                    {barberInfo?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '✂'}
                  </Text>
                )}
                {/* Pulse dot sur la photo */}
                <Animated.View style={[s.photoPulseDot, { transform: [{ scale: salonOpen ? pulseAnim : 1 }], backgroundColor: status.color + '55' }]} />
                <View style={[s.photoStatusDot, { backgroundColor: status.color }]} />
              </View>
            </TouchableOpacity>

            <View style={s.headerInfo}>
              <Text style={s.headerName}>{barberInfo?.name || 'Coiffeuse'}</Text>
              <Text style={s.headerSalon}>{barberInfo?.salons?.name || 'Salon'}</Text>

              {/* Note */}
              <View style={s.ratingRow}>
                {[1,2,3,4,5].map(i => (
                  <Text key={i} style={[s.ratingStar, {
                    color: i <= Math.round(barberInfo?.rating || 0) ? '#A8852A' : 'rgba(28,28,30,0.2)'
                  }]}>★</Text>
                ))}
                <Text style={s.ratingVal}>
                  {barberInfo?.rating?.toFixed(1) || '—'} · {barberInfo?.total_reviews || 0} avis
                </Text>
              </View>

              {/* Badge statut */}
              <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={s.statusEmoji}>{status.emoji}</Text>
                <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
          </View>

          {/* Toggle "Accepter les clients" */}
          <TouchableOpacity
            style={[s.acceptToggle, salonOpen && s.acceptToggleOn]}
            onPress={handleToggleOpen}
            activeOpacity={0.85}>
            <View style={s.acceptLeft}>
              <Text style={s.acceptIcon}>{salonOpen ? '✓' : '+'}</Text>
              <View>
                <Text style={[s.acceptTitle, salonOpen && s.acceptTitleOn]}>
                  {salonOpen ? "Vous acceptez des RDV" : "Accepter des rendez-vous"}
                </Text>
                <Text style={[s.acceptSub, salonOpen && { color: 'rgba(255,255,255,0.7)' }]}>
                  {salonOpen
                    ? `${confirmedCnt} RDV confirmé(s) aujourd'hui`
                    : "Appuie pour activer ta disponibilité"}
                </Text>
              </View>
            </View>
            <View style={[s.toggleTrack, salonOpen && s.toggleTrackOn]}>
              <View style={[s.toggleThumb, salonOpen && s.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

        </BlurView>

        {/* ════════════════════════════════════════════════
            KPIs RAPIDES
        ════════════════════════════════════════════════ */}
        <View style={s.kpiRow}>
          {[
            { num: confirmedCnt,                                    lbl: 'RDV auj.',  sub: 'confirmés', color: '#7C3D8F' },
            { num: pendingCnt,                                      lbl: 'En attente',sub: 'à confirmer',color: '#B06A00' },
            { num: portfolio.reduce((s, c) => s + (c.likes||0), 0),lbl: 'Likes',     sub: 'total',     color: '#e74c3c' },
          ].map(k => (
            <BlurView key={k.lbl} intensity={60} tint="light" style={s.kpiCard}>
              <Text style={[s.kpiNum, { color: k.color }]}>{k.num}</Text>
              <Text style={s.kpiLbl}>{k.lbl}</Text>
              <Text style={s.kpiSub}>{k.sub}</Text>
            </BlurView>
          ))}
        </View>

        {/* ════════════════════════════════════════════════
            NOTIFICATIONS INTELLIGENTES
        ════════════════════════════════════════════════ */}
        {smartNotifs.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}>🔔 Alertes intelligentes</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
              {smartNotifs.map(n => (
                <BlurView key={n.id} intensity={60} tint="light" style={s.notifChip}>
                  <Text style={{ fontSize: 16 }}>{n.emoji}</Text>
                  <Text style={[s.notifChipTxt, { color: n.color }]}>{n.text}</Text>
                </BlurView>
              ))}
            </ScrollView>
          </>
        )}

        {/* ════════════════════════════════════════════════
            RDV DU JOUR
        ════════════════════════════════════════════════ */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>📅 Rendez-vous du jour</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Agenda')}>
            <Text style={s.secLink}>Tout voir →</Text>
          </TouchableOpacity>
        </View>

        {pendingCnt > 0 && (
          <TouchableOpacity style={s.pendingAlert} onPress={() => navigation.navigate('Agenda')} activeOpacity={0.8}>
            <Text style={s.pendingTxt}>⏳ {pendingCnt} RDV en attente de confirmation</Text>
            <Text style={s.pendingLink}>Confirmer →</Text>
          </TouchableOpacity>
        )}

        {todayAppts.length === 0 ? (
          <BlurView intensity={50} tint="light" style={s.emptyCard}>
            <Text style={{ fontSize: 26, marginBottom: 6 }}>📅</Text>
            <Text style={s.emptyTitle}>Aucun RDV aujourd'hui</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('Agenda')}>
              <Text style={s.emptyBtnTxt}>Ouvrir l'agenda →</Text>
            </TouchableOpacity>
          </BlurView>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
            {todayAppts.map(a => {
              const st = APPT_STATUS[a.status] || { label: a.status, color: 'rgba(28,28,30,0.4)' };
              return (
                <BlurView key={a.id} intensity={65} tint="light" style={s.apptCard}>
                  <Text style={s.apptTime}>{a.time?.slice(0, 5) || '--:--'}</Text>
                  <View style={s.apptAv}>
                    <Text style={s.apptAvTxt}>{(a.client_name || 'C')[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.apptClient} numberOfLines={1}>{a.client_name || 'Client'}</Text>
                  <Text style={s.apptService} numberOfLines={1}>{a.service || 'Coupe'}</Text>
                  <View style={[s.apptPill, { backgroundColor: st.color + '18', borderColor: st.color + '55' }]}>
                    <Text style={[s.apptPillTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                </BlurView>
              );
            })}
            <TouchableOpacity style={s.addApptCard}
              onPress={() => navigation.navigate('BookAppointment', { barber: barberInfo })}>
              <Text style={s.addApptPlus}>＋</Text>
              <Text style={s.addApptTxt}>Nouveau{'\n'}RDV</Text>
            </TouchableOpacity>
          </ScrollView>
        )}



      </ScrollView>

      {/* ════════════════════════════════════════════════
          TAB BAR
      ════════════════════════════════════════════════ */}
      <CoiffeuseTabBar active="BarberHome" navigation={navigation} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1:     { position: 'absolute', top: -60,    right: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(168,133,42,0.16)' },
  blob2:     { position: 'absolute', top: 400,    left: -70,  width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(124,61,143,0.13)'  },
  blob3:     { position: 'absolute', bottom: 100, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(60,160,255,0.11)' },

  // ── Header premium ──
  headerCard:    { marginHorizontal: 16, marginTop: 12, marginBottom: 10, borderRadius: 24, overflow: 'hidden', padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  headerTopRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerDate:    { fontSize: 12, color: 'rgba(28,28,30,0.5)', textTransform: 'capitalize', flex: 1 },
  notifBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.1)', borderWidth: 1, borderColor: 'rgba(168,133,42,0.25)', alignItems: 'center', justifyContent: 'center' },
  logoutBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(192,57,43,0.1)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)', alignItems: 'center', justifyContent: 'center' },
  logoutInitials:{ fontSize: 13, fontWeight: '800', color: '#C0392B' },
  badge:         { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center' },
  badgeTxt:      { color: '#fff', fontSize: 9, fontWeight: '800' },
  headerMain:    { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  shopPhoto:     { width: 78, height: 78, borderRadius: 22, backgroundColor: 'rgba(168,133,42,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(168,133,42,0.35)', overflow: 'visible', flexShrink: 0 },
  shopPhotoImg:  { width: 78, height: 78, borderRadius: 22 },
  shopPhotoFallback: { fontSize: 28, fontWeight: '800', color: '#A8852A' },
  photoPulseDot: { position: 'absolute', bottom: -3, right: -3, width: 18, height: 18, borderRadius: 9 },
  photoStatusDot:{ position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  headerInfo:    { flex: 1, gap: 3 },
  headerName:    { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSalon:   { fontSize: 12, color: 'rgba(28,28,30,0.55)' },
  ratingRow:     { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 2 },
  ratingStar:    { fontSize: 13 },
  ratingVal:     { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginLeft: 5 },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
  statusEmoji:   { fontSize: 11 },
  statusLabel:   { fontSize: 11, fontWeight: '700' },

  // ── Toggle accepter clients ──
  acceptToggle:  { borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 1, borderColor: 'rgba(28,28,30,0.1)' },
  acceptToggleOn:{ backgroundColor: 'rgba(124,61,143,0.88)', borderColor: 'rgba(124,61,143,0.9)' },
  acceptLeft:    { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  acceptIcon:    { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', fontSize: 16, textAlign: 'center', lineHeight: 34 },
  acceptTitle:   { fontSize: 14, fontWeight: '800', color: '#1C1C1E' },
  acceptTitleOn: { color: '#fff' },
  acceptSub:     { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  toggleTrack:   { width: 46, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.2)', position: 'relative', flexShrink: 0 },
  toggleTrackOn: { backgroundColor: 'rgba(255,255,255,0.3)' },
  toggleThumb:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, left: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  toggleThumbOn: { left: 22 },

  // ── KPIs ──
  kpiRow:  { paddingHorizontal: 16, flexDirection: 'row', gap: 7, marginBottom: 10 },
  kpiCard: { flex: 1, borderRadius: 14, overflow: 'hidden', padding: 11, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  kpiNum:  { fontSize: 19, fontWeight: '800' },
  kpiLbl:  { fontSize: 10, fontWeight: '600', color: '#1C1C1E', marginTop: 3, textAlign: 'center' },
  kpiSub:  { fontSize: 9, color: 'rgba(28,28,30,0.45)', marginTop: 1, textAlign: 'center' },

  // ── Notif chips ──
  notifChip:    { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 13, paddingVertical: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', maxWidth: 260 },
  notifChipTxt: { fontSize: 12, fontWeight: '600', lineHeight: 17, flex: 1, flexShrink: 1 },

  // ── Queue banner ──
  queueBanner: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.3)', marginBottom: 4 },
  pulseDot:    { width: 9, height: 9, borderRadius: 5, backgroundColor: '#7C3D8F', flexShrink: 0 },
  queueTitle:  { fontSize: 14, fontWeight: '700', color: '#7C3D8F' },
  queueSub:    { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  // ── Section headers ──
  secRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle:{ fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  secLink: { fontSize: 12, color: '#A8852A', fontWeight: '700' },
  secSub:  { fontSize: 11, color: 'rgba(28,28,30,0.4)' },

  // ── Pending alert ──
  pendingAlert: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(176,106,0,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 0.5, borderColor: 'rgba(176,106,0,0.3)', gap: 8 },
  pendingTxt:   { flex: 1, fontSize: 12, fontWeight: '600', color: '#B06A00' },
  pendingLink:  { fontSize: 12, fontWeight: '700', color: '#B06A00' },

  // ── Empty ──
  emptyCard:  { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 22, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  emptySub:   { fontSize: 12, color: 'rgba(28,28,30,0.45)', textAlign: 'center', lineHeight: 17 },
  emptyBtn:   { marginTop: 12, backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(168,133,42,0.4)' },
  emptyBtnTxt:{ fontSize: 13, fontWeight: '700', color: '#A8852A' },

  // ── Appointment cards ──
  apptCard:   { width: 128, borderRadius: 18, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', gap: 5 },
  apptTime:   { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  apptAv:     { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168,133,42,0.25)' },
  apptAvTxt:  { fontSize: 13, fontWeight: '800', color: '#A8852A' },
  apptClient: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  apptService:{ fontSize: 11, color: 'rgba(28,28,30,0.55)' },
  apptPill:   { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', borderWidth: 0.5 },
  apptPillTxt:{ fontSize: 10, fontWeight: '600' },
  addApptCard:{ width: 86, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(168,133,42,0.04)' },
  addApptPlus:{ fontSize: 24, color: '#A8852A' },
  addApptTxt: { fontSize: 10, color: '#A8852A', fontWeight: '700', textAlign: 'center' },

  // ── Tendances ──
  trendHero:        { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', padding: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)', backgroundColor: 'rgba(192,57,43,0.04)' },
  trendHeroLeft:    { flex: 1 },
  trendHeroBadge:   { backgroundColor: 'rgba(192,57,43,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 6 },
  trendHeroBadgeTxt:{ fontSize: 10, fontWeight: '700', color: '#C0392B' },
  trendHeroName:    { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  trendHeroStat:    { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginBottom: 8 },
  trendHeroBar:     { height: 5, borderRadius: 3, backgroundColor: 'rgba(28,28,30,0.08)', overflow: 'hidden' },
  trendHeroBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#C0392B' },
  trendHeroIconBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(192,57,43,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 12 },
  trendCard:        { width: 105, borderRadius: 16, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center' },
  trendCardName:    { fontSize: 11, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 6 },
  trendCardBar:     { width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.08)', overflow: 'hidden', marginBottom: 4 },
  trendCardBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#A8852A' },
  trendCardPct:     { fontSize: 11, color: '#7C3D8F', fontWeight: '700' },

  // ── Portfolio / Book ──
  portfolioCard:      { width: 140, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  portfolioPhoto:     { height: 110, width: '100%' },
  portfolioImg:       { width: '100%', height: '100%' },
  portfolioPlaceholder:{ flex: 1, backgroundColor: 'rgba(28,28,30,0.06)', alignItems: 'center', justifyContent: 'center' },
  portfolioService:   { fontSize: 12, fontWeight: '700', color: '#1C1C1E', paddingHorizontal: 10, paddingTop: 8 },
  portfolioMeta:      { fontSize: 10, color: 'rgba(28,28,30,0.4)', paddingHorizontal: 10, marginTop: 2 },
  portfolioStats:     { flexDirection: 'row', padding: 10, paddingTop: 6, gap: 8 },
  portfolioStatItem:  { flexDirection: 'row', alignItems: 'center' },
  portfolioStatNum:   { fontSize: 11, fontWeight: '600', color: '#e74c3c' },
  addPortfolioCard:   { width: 100, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: 'rgba(168,133,42,0.04)', minHeight: 160 },
  addPortfolioPlus:   { fontSize: 26, color: '#A8852A' },
  addPortfolioTxt:    { fontSize: 10, color: '#A8852A', fontWeight: '700', textAlign: 'center' },

  // ── Marketing tips ──
  mktIntro: { marginHorizontal: 16, marginBottom: 10, fontSize: 12, color: 'rgba(28,28,30,0.45)', lineHeight: 17 },
  tipCard:  { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', padding: 14, flexDirection: 'row', gap: 13, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  tipIconBox:{ width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start' },
  tipTitle: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  tipBody:  { fontSize: 12, color: 'rgba(28,28,30,0.6)', lineHeight: 18, marginBottom: 10 },
  tipCta:   { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 7, alignSelf: 'flex-start', borderWidth: 1 },
  tipCtaTxt:{ fontSize: 12, fontWeight: '700' },

  // ── Tab bar ──
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
  tabSalonPhoto:  { width: 24, height: 24, borderRadius: 7, resizeMode: 'cover', opacity: 0.6 },
  tabSalonPhotoActive: { opacity: 1, borderWidth: 1.5, borderColor: 'rgba(28,28,30,0.3)' },
});

const TAB_DEFS = [
  { label: 'Accueil', screen: 'BarberHome',    key: 'BarberHome',    imgA: require('./assets/homefull.png'),   imgI: require('./assets/homevide.png')   },
  { label: 'Book',    screen: 'CoiffeuseBook', key: 'CoiffeuseBook', imgA: require('./assets/queuevide.png'),  imgI: require('./assets/queuefull.png')  },
  { label: 'Agenda',  screen: 'Agenda',        key: 'Agenda',        imgA: require('./assets/agendafull.png'), imgI: require('./assets/agendavide.png') },
  { label: 'Salon',   screen: 'BarberSalon',   key: 'BarberSalon',   icon: '🏪' },
];

export function CoiffeuseTabBar({ active, navigation }) {
  const [salonPhoto, setSalonPhoto] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('coiffeuses')
        .select('salons(photo_url)')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.salons?.photo_url) setSalonPhoto(data.salons.photo_url);
        });
    });
  }, []);

  return (
    <View style={s.tabBarOuter}>
      <BlurView intensity={65} tint="light" style={s.tabBarInner}>
        {TAB_DEFS.map(tab => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.label}
              style={s.tabItem}
              onPress={() => navigation.navigate(tab.screen)}
              activeOpacity={0.7}>
              <View style={[s.tabPill, isActive && s.tabPillActive]}>
                {isActive && <BlurView intensity={90} tint="light" style={s.tabPillBlur} />}
                {tab.imgA ? (
                  <Image source={isActive ? tab.imgA : tab.imgI} style={s.tabImg} />
                ) : salonPhoto ? (
                  <Image
                    source={{ uri: salonPhoto }}
                    style={[s.tabSalonPhoto, isActive && s.tabSalonPhotoActive]}
                  />
                ) : (
                  <Text style={s.tabIcon}>{tab.icon}</Text>
                )}
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

