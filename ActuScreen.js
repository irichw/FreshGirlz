import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, RefreshControl, Modal,
  Animated, PanResponder, Dimensions, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { getFreshLevel } from './freshScore';

const { width: SW } = Dimensions.get('window');
const CARD_W = SW - 32;

const TABS = [
  { key: 'pour_toi',    label: 'Pour toi' },
  { key: 'tendances',   label: 'Tendances' },
  { key: 'avant_apres', label: 'Avant/Après' },
  { key: 'challenge',   label: '⚡ Challenge' },
  { key: 'tutos',       label: '🎓 Tutos' },
];

// V2 — réactiver 'tendances', 'challenge', 'tutos'
const V1_TABS = TABS.filter(t => ['pour_toi', 'avant_apres'].includes(t.key));

const TUTO_CATS = ['Tout', 'Entretien', 'Soin', 'Style', 'Conseil'];

const TRENDING_STYLES = [
  { id: 't1', name: 'Burst Fade', pct: 34, emoji: '🔥' },
  { id: 't2', name: 'Afro Twist', pct: 28, emoji: '✨' },
  { id: 't3', name: 'Taper Curl', pct: 19, emoji: '💫' },
  { id: 't4', name: 'Drop Fade',  pct: 15, emoji: '⚡' },
];

const SEASONAL = [
  { id: 's1', name: 'Low Fade',  emoji: '🍂' },
  { id: 's2', name: 'Waves',     emoji: '🌊' },
  { id: 's3', name: 'Side Part', emoji: '✂️' },
];

// ── Données simulées (seront remplacées par de vrais posts) ──

const MOCK_FRIENDS = [
  { id: 'f1', name: 'Karim B.',   avatar_url: null, fresh_score: 82 },
  { id: 'f2', name: 'Youssef M.', avatar_url: null, fresh_score: 76 },
  { id: 'f3', name: 'Mehdi D.',   avatar_url: null, fresh_score: 69 },
];

const MOCK_FEED = [
  {
    id: 'mf1', type: 'new_cut',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    clients: { id: 'cl1', name: 'Karim B.',   avatar_url: null, fresh_score: 82 },
    barbers: { id: 'b1',  name: 'BarberKing', photo_url: null, salons: { name: 'King Barber Shop' } },
    coupes:  { id: 'mc1', photo_url: null, service: 'Burst Fade', likes: 142 },
    coupe_id: 'mc1',
  },
  {
    id: 'mf2', type: 'score_up',
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    clients: { id: 'cl2', name: 'Youssef M.', avatar_url: null, fresh_score: 76 },
    metadata: { new_score: 76 },
  },
  {
    id: 'mf3', type: 'new_cut',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    clients: { id: 'cl3', name: 'Mehdi D.',   avatar_url: null, fresh_score: 69 },
    barbers: { id: 'b2',  name: 'ClipKing',   photo_url: null, salons: { name: 'ClipKing Studio' } },
    coupes:  { id: 'mc2', photo_url: null, service: 'Taper Curl', likes: 89 },
    coupe_id: 'mc2',
  },
  {
    id: 'mf4', type: 'trend',
    created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    metadata: { coupe_name: 'Burst Fade', percent: 34, count: 128 },
  },
  {
    id: 'mf5', type: 'new_follow',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    clients: { id: 'cl4', name: 'Adama K.', avatar_url: null },
    barbers: { id: 'b3',  name: 'FadeMaster', photo_url: null },
  },
];

const MOCK_AA = [
  { id: 'aa1', type: 'glowup',    client: { name: 'Karim B.',   id: 'cl1' }, barber: { name: 'BarberKing', rating: 4.9, id: 'b1' }, caption: 'Glowup total 🔥',              likes: 312, before_url: null, after_url: null },
  { id: 'aa2', type: 'reparation',client: { name: 'Youssef M.', id: 'cl2' }, barber: { name: 'ClipKing',   rating: 4.8, id: 'b2' }, caption: 'Réparation cheveux abîmés 💆', likes: 198, before_url: null, after_url: null },
  { id: 'aa3', type: 'new_cut',   client: { name: 'Mehdi D.',   id: 'cl3' }, barber: { name: 'FadeMaster', rating: 4.7, id: 'b3' }, caption: 'Burst Fade ✂️',               likes: 445, before_url: null, after_url: null },
];

const INIT_CHALLENGE = {
  id: 'c1',
  title: 'Meilleure coupe de la semaine',
  ends_at: new Date(Date.now() + 2 * 86400000 + 14 * 3600000),
  entries: [
    { id: 'e1', client: { name: 'Karim B.',   id: 'cl1' }, barber_name: 'FadeMaster', barber_id: 'b3', photo_url: null, votes: 621 },
    { id: 'e2', client: { name: 'Youssef M.', id: 'cl2' }, barber_name: 'BaldKing',   barber_id: 'b4', photo_url: null, votes: 383 },
  ],
};

const PAST_CHALLENGES = [
  { id: 'pc1', week: 'S.19', client: { name: 'Karim B.',   id: 'cl1' }, barber_name: 'BarberKing', photo_url: null, votes: 1204, rating: 4.9, barber_id: 'b1' },
  { id: 'pc2', week: 'S.18', client: { name: 'Youssef M.', id: 'cl2' }, barber_name: 'ClipKing',   photo_url: null, votes: 987,  rating: 4.8, barber_id: 'b2' },
];

// ─────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────
export default function ActuScreen({ navigation }) {
  const [activeTab,    setActiveTab]    = useState('pour_toi');
  const [events,       setEvents]       = useState([]);
  const [tutos,        setTutos]        = useState([]);
  const [topCoupes,    setTopCoupes]    = useState([]);
  const [topBarbers,   setTopBarbers]   = useState([]);
  const [friends,      setFriends]      = useState([]);
  const [myClientId,   setMyClientId]   = useState(null);
  const [myFollowed,   setMyFollowed]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [modalUri,     setModalUri]     = useState(null);
  const [votedEntry,   setVotedEntry]   = useState(null);
  const [challenge,    setChallenge]    = useState(INIT_CHALLENGE);
  const [tutoCategory, setTutoCategory] = useState('Tout');

  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalPanY    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadFollowed(session.user.id);
        loadFriends(session.user.id);
      }
    });
    loadFeed();
    loadTutos();
    loadTopCoupes();
    loadTopcoiffeuses();
  }, []);

  async function loadFollowed(userId) {
    const { data: client } = await supabase.from('clientes').select('id').eq('user_id', userId).maybeSingle();
    if (!client) return;
    setMyClientId(client.id);
    const { data } = await supabase.from('followed_barbers').select('barber_id').eq('client_id', client.id);
    if (data) setMyFollowed(data.map(f => f.barber_id));
  }

  async function loadFriends(userId) {
    const { data } = await supabase.from('clientes').select('id,name,avatar_url,fresh_score').neq('user_id', userId).limit(5);
    if (data) setFriends(data);
  }

  async function loadFeed() {
    const { data } = await supabase
      .from('feed_events')
      .select('*, clientes(id,name,avatar_url,fresh_score), coiffeuses(id,name,photo_url,salons(name)), coupes(id,photo_url,service,name,likes)')
      .order('created_at', { ascending: false }).limit(20);
    if (data) setEvents(data);
    setLoading(false);
  }

  async function loadTutos() {
    const { data } = await supabase.from('tutos').select('*, coiffeuses(name,photo_url)').eq('is_approved', true).order('views', { ascending: false }).limit(20);
    if (data) setTutos(data);
  }

  async function loadTopCoupes() {
    const { data } = await supabase.from('coupes').select('*, coiffeuses(id,name,photo_url)').order('likes', { ascending: false }).limit(5);
    if (data) setTopCoupes(data);
  }

  async function loadTopcoiffeuses() {
    const { data } = await supabase.from('coiffeuses').select('id,name,photo_url,rating').order('rating', { ascending: false }).limit(5);
    if (data) setTopcoiffeuses(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadFeed(), loadTutos(), loadTopCoupes(), loadTopcoiffeuses()]);
    setRefreshing(false);
  }

  async function toggleLike(coupe) {
    if (!coupe) return;
    await supabase.from('coupes').update({ likes: (coupe.likes || 0) + 1 }).eq('id', coupe.id);
    setEvents(prev => prev.map(e =>
      e.coupe_id === coupe.id ? { ...e, coupes: { ...e.coupes, likes: (e.coupes?.likes || 0) + 1 } } : e
    ));
  }

  // Navigue vers profil perso si c'est moi, sinon profil public
  function openClientProfile(client) {
    if (!client) return;
    if (client.id === myClientId) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('PublicProfile', { clientId: client.id, name: client.name });
    }
  }

  async function handleParticiper() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorise l\'accès à ta galerie pour participer au challenge.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      const newEntry = {
        id: `my_${Date.now()}`,
        client: { name: 'Moi', id: myClientId || 'me' },
        barber_name: 'Mon Coiffeuse',
        barber_id: null,
        photo_url: result.assets[0].uri,
        votes: 0,
      };
      setChallenge(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
    }
  }

  function openPhoto(uri) {
    if (!uri) return;
    setModalUri(uri);
    modalOpacity.setValue(0);
    modalPanY.setValue(0);
    Animated.spring(modalOpacity, { toValue: 1, useNativeDriver: true }).start();
  }

  function closePhoto() {
    Animated.timing(modalOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setModalUri(null);
      modalPanY.setValue(0);
    });
  }

  function timeAgo(d) {
    const sec = Math.floor((Date.now() - new Date(d)) / 1000);
    if (sec < 60) return 'À l\'instant';
    if (sec < 3600) return `${Math.floor(sec / 60)}min`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}j`;
  }

  function timeLeft(date) {
    const diff = date - Date.now();
    if (diff <= 0) return 'Terminé';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return `${d}j ${h}h restants`;
  }

  // Utilise les données réelles si disponibles, sinon les données simulées
  const displayEvents  = events.length  > 0 ? events  : MOCK_FEED;
  const displayFriends = friends.length > 0 ? friends : MOCK_FRIENDS;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} />
        <View style={s.blob2} />
        <View style={s.blob3} />
        <View style={s.blob4} />
      </View>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📰 Actu</Text>
          <Text style={s.headerSub}>Communauté FreshGirlz</Text>
        </View>
        <View style={s.headerIcons}>
          <TouchableOpacity style={s.iconBtn}><Image source={require('./assets/notiffull.png')} style={{ width: 18, height: 18, resizeMode: 'contain' }} /></TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}><Text style={s.iconBtnTxt}>🔍</Text></TouchableOpacity>
        </View>
      </View>

      {/* TAB BAR */}
      <View style={s.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
          style={{ height: 44 }}>
          {V1_TABS.map(tab => (
            <TouchableOpacity key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* CONTENT */}
      <ScrollView
        key={activeTab}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {activeTab === 'pour_toi' && (
          <PourToiTab events={displayEvents} friends={displayFriends} loading={loading}
            timeAgo={timeAgo} toggleLike={toggleLike} navigation={navigation}
            openPhoto={openPhoto} openClientProfile={openClientProfile} />
        )}
        {activeTab === 'tendances' && (
          <TendancesTab topCoupes={topCoupes} topBarbers={topBarbers}
            navigation={navigation} openPhoto={openPhoto} />
        )}
        {activeTab === 'avant_apres' && (
          <AvantApresTab navigation={navigation} openPhoto={openPhoto}
            openClientProfile={openClientProfile} />
        )}
        {activeTab === 'challenge' && (
          <ChallengeTab challenge={challenge} setChallenge={setChallenge}
            pastChallenges={PAST_CHALLENGES} votedEntry={votedEntry} setVotedEntry={setVotedEntry}
            navigation={navigation} openPhoto={openPhoto} timeLeft={timeLeft}
            onParticiper={handleParticiper} openClientProfile={openClientProfile} />
        )}
        {activeTab === 'tutos' && (
          <TutosTab tutos={tutos} category={tutoCategory} setCategory={setTutoCategory}
            navigation={navigation} openPhoto={openPhoto} />
        )}
      </ScrollView>

      <PhotoModal uri={modalUri} opacity={modalOpacity} panY={modalPanY} onClose={closePhoto} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
//  ONGLET : POUR TOI
// ─────────────────────────────────────────────────────────────
function PourToiTab({ events, friends, loading, timeAgo, toggleLike, navigation, openPhoto, openClientProfile }) {
  return (
    <View>
      {/* Widget FreshScore amis — désactivé V1, réactiver en V2 */}
      {false && friends.length > 0 && (
        <View style={s.widget}>
          <Text style={s.widgetTitle}>🏠 FreshScore de tes amis</Text>
          {friends.map(f => {
            const lv = getFreshLevel(f.fresh_score || 0);
            return (
              <TouchableOpacity key={f.id} style={s.friendRow} onPress={() => openClientProfile(f)} activeOpacity={0.7}>
                <View style={s.friendAvatar}>
                  {f.avatar_url
                    ? <Image source={{ uri: f.avatar_url }} style={s.friendAvatarImg} />
                    : <Text style={s.friendAvatarTxt}>{f.name?.[0]}</Text>}
                </View>
                <Text style={s.friendName}>{f.name}</Text>
                <Text style={[s.friendScore, { color: lv.color }]}>{lv.emoji} {f.fresh_score || 0}</Text>
                <Text style={s.friendDelta}>+2 ce mois</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={s.widgetLink}>
            <Text style={s.widgetLinkTxt}>Voir tous →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Feed */}
      {loading
        ? <Text style={s.loadingTxt}>Chargement…</Text>
        : events.map(ev => {
            switch (ev.type) {
              case 'new_cut':    return <CutPost    key={ev.id} event={ev} timeAgo={timeAgo} toggleLike={toggleLike} navigation={navigation} openPhoto={openPhoto} openClientProfile={openClientProfile} />;
              case 'score_up':   return null; // désactivé V1 — réactiver en V2
              case 'trend':      return <TrendPost  key={ev.id} event={ev} timeAgo={timeAgo} navigation={navigation} />;
              case 'new_follow': return <FollowPost key={ev.id} event={ev} timeAgo={timeAgo} openClientProfile={openClientProfile} />;
              default: return null;
            }
          })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ONGLET : TENDANCES
// ─────────────────────────────────────────────────────────────
function TendancesTab({ topCoupes, topBarbers, navigation, openPhoto }) {
  return (
    <View>
      <Text style={s.secTitle}>🔥 Styles qui explosent</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
        {TRENDING_STYLES.map(st => (
          <View key={st.id} style={s.trendCard}>
            <View style={s.trendCardImg}><Text style={{ fontSize: 26 }}>{st.emoji}</Text></View>
            <Text style={s.trendCardName}>{st.name}</Text>
            <Text style={s.trendCardPct}>+{st.pct}% ▲</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={[s.secTitle, { marginTop: 8 }]}>❤ Coupes les plus likées</Text>
      {topCoupes.length === 0
        ? <EmptyState emoji="✂️" title="Aucune coupe" sub="Les coupes les plus likées s'afficheront ici" small />
        : topCoupes.map((c, i) => (
            <TouchableOpacity key={c.id} style={s.topCoupeRow} onPress={() => openPhoto(c.photo_url)} activeOpacity={0.85}>
              <Text style={s.topRank}>#{i + 1}</Text>
              <View style={s.topThumb}>
                {c.photo_url
                  ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <Text style={{ fontSize: 18 }}>✂️</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.topCoupeName}>{c.name || c.service || 'Coupe'}</Text>
                <Text style={s.topCoupeMeta}>{c.barbers?.name}</Text>
              </View>
              <Text style={s.topLikes}>♥ {c.likes || 0}</Text>
            </TouchableOpacity>
          ))}

      <Text style={[s.secTitle, { marginTop: 8 }]}>📱 TikTok Coiffure</Text>
      <View style={[s.post, { marginBottom: 10 }]}>
        <View style={[s.mockMedia, { height: 180 }]}>
          <Text style={{ fontSize: 36 }}>📱</Text>
          <Text style={s.mockLabel}>#BurstFade · 2.4M vues</Text>
          <View style={s.playBadge}><Text style={{ color: '#fff', fontSize: 14 }}>▶</Text></View>
        </View>
      </View>

      <Text style={[s.secTitle, { marginTop: 4 }]}>🍂 Inspirations de saison</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
        {SEASONAL.map(item => (
          <View key={item.id} style={s.seasonCard}>
            <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
            <Text style={s.seasonName}>{item.name}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={[s.secTitle, { marginTop: 4 }]}>⭐ Barbers les mieux notés</Text>
      {topBarbers.length === 0
        ? <EmptyState emoji="💈" title="Aucun barber" sub="" small />
        : topBarbers.map(b => (
            <TouchableOpacity key={b.id} style={s.barberRow} activeOpacity={0.85}
              onPress={() => navigation.navigate('BarberProfile', { barber: b })}>
              <View style={s.barberAvatar}>
                {b.photo_url
                  ? <Image source={{ uri: b.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  : <Text style={{ fontSize: 18 }}>💈</Text>}
              </View>
              <Text style={[s.barberName, { flex: 1 }]}>{b.name}</Text>
              <Text style={s.barberRating}>★ {b.rating?.toFixed(1) || '—'}</Text>
              <Text style={s.arrow}>→</Text>
            </TouchableOpacity>
          ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ONGLET : AVANT / APRÈS
// ─────────────────────────────────────────────────────────────
function AvantApresTab({ navigation, openPhoto, openClientProfile }) {
  return (
    <View>
      {MOCK_AA.map(item => (
        <View key={item.id} style={[s.post, { marginBottom: 16 }]}>
          {/* ── En-tête : NOM DU CLIENT (cliquable → profil) ── */}
          <TouchableOpacity style={s.postHeader} activeOpacity={0.7}
            onPress={() => openClientProfile(item.client)}>
            <View style={s.postAvatar}>
              <Text style={s.postAvatarTxt}>{item.client.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.postName}>{item.client.name}</Text>
              <Text style={s.postMeta}>{item.caption}</Text>
            </View>
            <Text style={s.postMore}>•••</Text>
          </TouchableOpacity>

          <BeforeAfterSlider beforeUri={item.before_url} afterUri={item.after_url} />

          <View style={s.postActions}>
            <LikeButton initialCount={item.likes} />
            <TouchableOpacity style={s.actionBtn}><Text style={s.actionIcon}>🔖</Text></TouchableOpacity>
            <TouchableOpacity style={s.actionBtn}><Text style={s.actionIcon}>➤</Text><Text style={s.actionCount}>Partager</Text></TouchableOpacity>
          </View>

          {/* ── Crédit Coiffeuse en bas ── */}
          <TouchableOpacity style={s.creditRow} activeOpacity={0.8}
            onPress={() => navigation.navigate('BarberProfile', { barber: item.barber })}>
            <Text style={{ fontSize: 14 }}>💈</Text>
            <Text style={[s.postMeta, { flex: 1 }]}>✂️ {item.barber.name}  ★{item.barber.rating}</Text>
            <Text style={s.creditLink}>Voir profil →</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ONGLET : CHALLENGE COMMUNAUTÉ
// ─────────────────────────────────────────────────────────────
function ChallengeTab({ challenge, setChallenge, pastChallenges, votedEntry, setVotedEntry, navigation, openPhoto, timeLeft, onParticiper, openClientProfile }) {
  const total = challenge.entries.reduce((sum, e) => sum + e.votes, 0);

  function vote(id) {
    if (votedEntry) return;
    setVotedEntry(id);
    setChallenge(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === id ? { ...e, votes: e.votes + 1 } : e),
    }));
  }

  return (
    <View>
      {/* Bandeau challenge */}
      <View style={s.challengeBox}>
        <Text style={s.challengeTitle}>⚡ Challenge de la semaine</Text>
        <Text style={s.challengeSub}>🏆 {challenge.title}</Text>
        <Text style={s.challengeTimer}>⏳ {timeLeft(challenge.ends_at)}</Text>
      </View>

      {/* Bouton Participer */}
      <TouchableOpacity style={s.participerBtn} onPress={onParticiper} activeOpacity={0.85}>
        <Text style={s.participerBtnTxt}>✂️ Participer au challenge</Text>
      </TouchableOpacity>

      {/* Grille votes */}
      <View style={s.challengeGrid}>
        {challenge.entries.map(entry => {
          const pct   = total > 0 ? Math.round((entry.votes / total) * 100) : 0;
          const voted = votedEntry === entry.id;
          return (
            <View key={entry.id} style={s.challengeEntry}>
              {/* Photo */}
              <TouchableOpacity activeOpacity={0.9} onPress={() => openPhoto(entry.photo_url)}>
                <View style={[s.mockMedia, { height: 150, borderRadius: 12, marginBottom: 8 }]}>
                  {entry.photo_url
                    ? <Image source={{ uri: entry.photo_url }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                    : <Text style={{ fontSize: 28 }}>✂️</Text>}
                </View>
              </TouchableOpacity>

              {/* Nom CLIENT cliquable */}
              <TouchableOpacity onPress={() => openClientProfile(entry.client)}>
                <Text style={s.challengeClientName}>{entry.client?.name}</Text>
              </TouchableOpacity>

              {/* Barre de vote */}
              <View style={s.voteBar}><View style={[s.voteBarFill, { width: `${pct}%` }]} /></View>
              <Text style={s.votePct}>{pct}%</Text>

              <TouchableOpacity
                style={[s.voteBtn, voted && s.voteBtnVoted, votedEntry && !voted && { opacity: 0.4 }]}
                onPress={() => vote(entry.id)} disabled={!!votedEntry}>
                <Text style={[s.voteBtnTxt, voted && { color: '#fff' }]}>{voted ? '✓ Voté' : 'VOTER'}</Text>
              </TouchableOpacity>

              {/* Coiffeuse (si disponible) */}
              {entry.barber_name && (
                <TouchableOpacity onPress={() => entry.barber_id && navigation.navigate('BarberProfile', { barber: { id: entry.barber_id, name: entry.barber_name } })}>
                  <Text style={[s.postMeta, { textAlign: 'center', marginTop: 3 }]}>✂️ {entry.barber_name}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Gagnants passés */}
      <Text style={[s.secTitle, { marginTop: 16 }]}>🎖 Gagnants précédents</Text>
      {pastChallenges.map((pc, i) => (
        <View key={pc.id} style={[s.post, { marginBottom: 12 }]}>
          <TouchableOpacity style={s.postHeader} activeOpacity={0.7}
            onPress={() => openClientProfile(pc.client)}>
            <Text style={{ fontSize: 22 }}>{i === 0 ? '🥇' : '🥈'}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.postName}>{pc.client?.name}</Text>
              <Text style={s.postMeta}>Semaine {pc.week} · {pc.votes.toLocaleString()} votes</Text>
            </View>
          </TouchableOpacity>
          <View style={[s.mockMedia, { height: 180 }]}>
            {pc.photo_url
              ? <Image source={{ uri: pc.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <Text style={{ fontSize: 36 }}>🏆</Text>}
          </View>
          <TouchableOpacity style={s.creditRow}
            onPress={() => navigation.navigate('BarberProfile', { barber: { id: pc.barber_id, name: pc.barber_name } })}>
            <Text style={[s.postMeta, { flex: 1 }]}>✂️ {pc.barber_name}  ★{pc.rating}</Text>
            <Text style={s.creditLink}>Voir profil →</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ONGLET : TUTOS & CONSEILS
// ─────────────────────────────────────────────────────────────
function TutosTab({ tutos, category, setCategory, navigation, openPhoto }) {
  const filtered = tutos.filter(t => category === 'Tout' || t.category === category);
  const featured = filtered[0];
  const rest     = filtered.slice(1);

  return (
    <View>
      <TouchableOpacity style={s.searchBar} activeOpacity={0.7}>
        <Text style={{ fontSize: 14 }}>🔍</Text>
        <Text style={s.searchPlaceholder}>Rechercher un tuto…</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 6 }}>
        {['4C','4B','4A','3C','3B','Lissé'].map(h => (
          <TouchableOpacity key={h} style={s.chip}><Text style={s.chipTxt}>{h}</Text></TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 8 }}>
        {TUTO_CATS.map(c => (
          <TouchableOpacity key={c} style={[s.tab, category === c && s.tabActive]} onPress={() => setCategory(c)}>
            <Text style={[s.tabText, category === c && s.tabTextActive]} numberOfLines={1}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {featured && (
        <>
          <Text style={s.secTitle}>🎬 À la une</Text>
          <TouchableOpacity activeOpacity={0.9} style={s.featCard}>
            <View style={[s.mockMedia, { height: 180 }]}>
              {featured.photo_url
                ? <Image source={{ uri: featured.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                : <Text style={{ fontSize: 36 }}>🎬</Text>}
              {featured.type === 'video' && <View style={s.playBtn}><View style={s.playIcon} /></View>}
              {featured.duration && <View style={s.durBadge}><Text style={s.durTxt}>{featured.duration}</Text></View>}
            </View>
            <View style={{ padding: 12 }}>
              <Text style={s.featTitle}>{featured.title}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.postMeta}>{featured.barbers?.name || 'FreshGirlz'}</Text>
                <Text style={s.postMeta}>{(featured.views || 0).toLocaleString()} vues</Text>
              </View>
            </View>
          </TouchableOpacity>
        </>
      )}

      {rest.slice(0, 4).length > 0 && (
        <>
          <Text style={[s.secTitle, { marginTop: 8 }]}>✂️ Techniques de coupe</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
            {rest.slice(0, 4).map(t => (
              <TouchableOpacity key={t.id} style={s.recCard} activeOpacity={0.85}>
                <View style={[s.recPhoto, { backgroundColor: '#0A1A2A' }]}>
                  {t.photo_url
                    ? <Image source={{ uri: t.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <Text style={{ fontSize: 20 }}>💡</Text>}
                  {t.type === 'video' && <View style={s.recPlay}><View style={s.playIcon} /></View>}
                </View>
                <View style={{ padding: 8 }}>
                  <Text style={s.recTitle} numberOfLines={2}>{t.title}</Text>
                  <Text style={s.recMeta}>{t.duration || `${t.views || 0} vues`}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {rest.slice(4).length > 0 && (
        <>
          <Text style={[s.secTitle, { marginTop: 8 }]}>💡 Tips de pros</Text>
          {rest.slice(4).map(t => (
            <TouchableOpacity key={t.id} activeOpacity={0.9}>
              <BlurView intensity={55} tint="light" style={s.listCard}>
                <View style={s.listThumb}>
                  {t.photo_url
                    ? <Image source={{ uri: t.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1A2A', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 20, opacity: 0.4 }}>{t.type === 'article' ? '📖' : '▶'}</Text>
                      </View>}
                  {t.duration && <View style={s.listDur}><Text style={s.listDurTxt}>{t.duration}</Text></View>}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={s.listTitle} numberOfLines={2}>{t.title}</Text>
                  <Text style={s.listMeta}>{t.barbers?.name || 'FreshGirlz'}</Text>
                </View>
                <Text style={{ fontSize: 16, color: 'rgba(28,28,30,0.25)', paddingLeft: 8 }}>→</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </>
      )}

      {filtered.length === 0 && (
        <EmptyState emoji="💡" title="Aucun tuto" sub="Aucun contenu dans cette catégorie" small />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  POSTS (Pour toi)
// ─────────────────────────────────────────────────────────────
function CutPost({ event, timeAgo, toggleLike, navigation, openPhoto, openClientProfile }) {
  const { clients: client, barbers: barber, coupes: coupe } = event;
  return (
    <View style={s.post}>
      <TouchableOpacity style={s.postHeader} activeOpacity={0.7} onPress={() => openClientProfile(client)}>
        <View style={s.postAvatar}>
          {client?.avatar_url
            ? <Image source={{ uri: client.avatar_url }} style={s.postAvatarImg} />
            : <Text style={s.postAvatarTxt}>{client?.name?.[0]}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.postTitle}>
            <Text style={s.postName}>{client?.name} </Text>
            <Text style={s.postAction}>vient de se faire coiffer</Text>
          </Text>
          <Text style={s.postMeta}>chez {barber?.name} · {timeAgo(event.created_at)}</Text>
        </View>
        <Text style={s.postMore}>•••</Text>
      </TouchableOpacity>

      {coupe?.photo_url && (
        <TouchableOpacity activeOpacity={0.95} onPress={() => openPhoto(coupe.photo_url)}>
          <View style={s.postPhoto}>
            <Image source={{ uri: coupe.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={s.photoOverlay} />
            <View style={s.photoBottom}>
              <View style={s.coupeBadge}><Text style={s.coupeBadgeTxt}>{coupe.service || coupe.name || 'Coupe'}</Text></View>
              {barber && (
                <TouchableOpacity style={s.reserveBtn}
                  onPress={() => navigation.navigate('BarberProfile', { barber })}>
                  <Text style={s.reserveBtnTxt}>✂ Réserver</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Placeholder si pas de photo */}
      {!coupe?.photo_url && (
        <View style={[s.mockMedia, { height: 160, margin: 0 }]}>
          <Text style={{ fontSize: 32 }}>✂️</Text>
          <Text style={s.mockLabel}>{coupe?.service || 'Nouvelle coupe'}</Text>
        </View>
      )}

      <View style={s.postActions}>
        <LikeButton initialCount={coupe?.likes || 0} onLike={() => toggleLike(coupe)} />
        <TouchableOpacity style={s.actionBtn}><Text style={s.actionIcon}>🔖</Text></TouchableOpacity>
        <TouchableOpacity style={s.actionBtn}><Text style={s.actionIcon}>➤</Text><Text style={s.actionCount}>Partager</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function ScorePost({ event, timeAgo, openClientProfile }) {
  const lv = getFreshLevel(event.metadata?.new_score || 0);
  return (
    <BlurView intensity={55} tint="light" style={s.miniPost}>
      <View style={[s.miniIcon, { backgroundColor: 'rgba(124,61,143,0.12)' }]}><Text style={{ fontSize: 20 }}>🔥</Text></View>
      <TouchableOpacity style={{ flex: 1 }} onPress={() => openClientProfile(event.clients)} activeOpacity={0.7}>
        <Text style={s.postTitle}>
          <Text style={s.postName}>{event.clients?.name} </Text>
          <Text style={s.postAction}>vient de passer </Text>
          <Text style={{ color: lv.color, fontWeight: '700' }}>{lv.label} {lv.emoji}</Text>
        </Text>
        <Text style={s.postMeta}>FreshScore {event.metadata?.new_score}% · {timeAgo(event.created_at)}</Text>
      </TouchableOpacity>
    </BlurView>
  );
}

function TrendPost({ event, timeAgo, navigation }) {
  const { metadata } = event;
  return (
    <BlurView intensity={55} tint="light" style={[s.miniPost, { borderColor: 'rgba(168,133,42,0.2)', backgroundColor: 'rgba(168,133,42,0.05)' }]}>
      <View style={[s.miniIcon, { backgroundColor: 'rgba(168,133,42,0.15)' }]}><Text style={{ fontSize: 20 }}>📈</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.postTitle}>
          <Text style={s.postName}>{metadata?.coupe_name} </Text>
          <Text style={s.postAction}>explose cette semaine</Text>
        </Text>
        <Text style={s.postMeta}>+{metadata?.percent}% · {metadata?.count} coupes · {timeAgo(event.created_at)}</Text>
      </View>
      <TouchableOpacity style={s.trendBtn}><Text style={s.trendBtnTxt}>Voir →</Text></TouchableOpacity>
    </BlurView>
  );
}

function FollowPost({ event, timeAgo, openClientProfile }) {
  return (
    <BlurView intensity={55} tint="light" style={s.miniPost}>
      <View style={[s.miniIcon, { backgroundColor: 'rgba(0,113,227,0.1)' }]}><Text style={{ fontSize: 20 }}>👥</Text></View>
      <TouchableOpacity style={{ flex: 1 }} onPress={() => openClientProfile(event.clients)} activeOpacity={0.7}>
        <Text style={s.postTitle}>
          <Text style={s.postName}>{event.clients?.name} </Text>
          <Text style={s.postAction}>suit maintenant </Text>
          <Text style={s.postName}>{event.barbers?.name}</Text>
        </Text>
        <Text style={s.postMeta}>{timeAgo(event.created_at)}</Text>
      </TouchableOpacity>
    </BlurView>
  );
}

// ─────────────────────────────────────────────────────────────
//  BEFORE / AFTER SLIDER
// ─────────────────────────────────────────────────────────────
function BeforeAfterSlider({ beforeUri, afterUri }) {
  const H      = 240;
  const sliderX = useRef(new Animated.Value(CARD_W / 2)).current;
  const lastX   = useRef(CARD_W / 2);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => { lastX.current = sliderX._value; },
      onPanResponderMove: (_, { dx }) => {
        sliderX.setValue(Math.max(4, Math.min(CARD_W - 4, lastX.current + dx)));
      },
    })
  ).current;

  const negX = sliderX.interpolate({ inputRange: [0, CARD_W], outputRange: [0, -CARD_W] });

  return (
    <View style={{ width: CARD_W, height: H, overflow: 'hidden' }} {...pan.panHandlers}>
      {beforeUri
        ? <Image source={{ uri: beforeUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        : <View style={[StyleSheet.absoluteFill, s.mockMedia]}><Text style={{ fontSize: 32 }}>📸</Text><Text style={s.mockLabel}>AVANT</Text></View>}

      <Animated.View style={{ position: 'absolute', left: sliderX, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>
        {afterUri
          ? <Animated.Image source={{ uri: afterUri }} style={{ width: CARD_W, height: H, left: negX }} resizeMode="cover" />
          : <Animated.View style={{ width: CARD_W, height: H, left: negX, backgroundColor: '#0A2A1A', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32 }}>✨</Text>
              <Text style={s.mockLabel}>APRÈS</Text>
            </Animated.View>}
      </Animated.View>

      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: Animated.subtract(sliderX, 1), width: 2, backgroundColor: 'rgba(255,255,255,0.9)' }}>
        <View style={s.sliderHandle}><Text style={{ fontSize: 10, color: '#1C1C1E' }}>◀▶</Text></View>
      </Animated.View>

      <View style={s.sliderLblL}><Text style={s.sliderLblTxt}>AVANT</Text></View>
      <View style={s.sliderLblR}><Text style={s.sliderLblTxt}>APRÈS</Text></View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  LIKE BUTTON
// ─────────────────────────────────────────────────────────────
function LikeButton({ initialCount = 0, onLike }) {
  const [liked, setLiked] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  function press() {
    if (liked) return;
    setLiked(true);
    onLike?.();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true }),
    ]).start();
  }

  return (
    <TouchableOpacity style={s.actionBtn} onPress={press} activeOpacity={0.8}>
      <Animated.Text style={[s.actionIcon, liked && { color: '#e74c3c' }, { transform: [{ scale }] }]}>♥</Animated.Text>
      <Text style={s.actionCount}>{initialCount + (liked ? 1 : 0)}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
//  PHOTO MODAL
// ─────────────────────────────────────────────────────────────
function PhotoModal({ uri, opacity, panY, onClose }) {
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dy: panY }], { useNativeDriver: false }),
      onPanResponderRelease: (_, { dy }) => {
        if (dy > 80) { onClose(); }
        else { Animated.spring(panY, { toValue: 0, useNativeDriver: false }).start(); }
      },
    })
  ).current;

  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[s.modalBg, { opacity, transform: [{ translateY: panY }] }]}
        {...pan.panHandlers}>
        <TouchableOpacity style={s.modalClose} onPress={onClose}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>
        <Image source={{ uri }} style={s.modalImg} resizeMode="contain" />
        <Text style={s.modalHint}>Glisse vers le bas pour fermer</Text>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────────────────────
function EmptyState({ emoji, title, sub, small }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: small ? 24 : 60, paddingHorizontal: 32, paddingBottom: 16 }}>
      <Text style={{ fontSize: small ? 28 : 40, marginBottom: 10 }}>{emoji}</Text>
      <Text style={{ fontSize: small ? 15 : 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 5 }}>{title}</Text>
      {sub ? <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.45)', textAlign: 'center' }}>{sub}</Text> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#EAFFF4' },
  blob1:     { position: 'absolute', top: -50, left: -50,  width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(80,160,255,0.22)' },
  blob2:     { position: 'absolute', top: 100, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(60,200,120,0.18)' },
  blob3:     { position: 'absolute', bottom: 200, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(200,100,255,0.12)' },
  blob4:     { position: 'absolute', bottom: -50, right: -30, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,180,60,0.18)' },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  headerSub:   { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn:     { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  iconBtnTxt:  { fontSize: 16 },

  // ── Tab bar ──
  tabBarWrap: { height: 44, marginBottom: 2 },
  tabsRow:    { paddingHorizontal: 16, gap: 6, alignItems: 'center', paddingVertical: 5 },
  tab:        { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', flexShrink: 0 },
  tabActive:  { backgroundColor: 'rgba(28,28,30,0.88)' },
  tabText:    { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.55)', lineHeight: 16 },
  tabTextActive: { color: '#fff' },

  // ── Widget amis ──
  widget:       { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', padding: 12 },
  widgetTitle:  { fontSize: 13, fontWeight: '800', color: '#1C1C1E', marginBottom: 10 },
  friendRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  friendAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  friendAvatarImg: { width: 32, height: 32 },
  friendAvatarTxt: { fontSize: 12, fontWeight: '800', color: '#A8852A' },
  friendName:   { flex: 1, fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  friendScore:  { fontSize: 13, fontWeight: '700' },
  friendDelta:  { fontSize: 11, color: '#7C3D8F', fontWeight: '600' },
  widgetLink:   { alignSelf: 'flex-end', marginTop: 4 },
  widgetLinkTxt:{ fontSize: 12, color: '#A8852A', fontWeight: '700' },

  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },

  // ── Post ──
  post:        { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  postHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingBottom: 8 },
  postAvatar:  { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  postAvatarImg: { width: 38, height: 38 },
  postAvatarTxt: { fontSize: 14, fontWeight: '800', color: '#A8852A' },
  postTitle:   { fontSize: 13, color: '#1C1C1E', lineHeight: 18 },
  postName:    { fontWeight: '700', fontSize: 13, color: '#1C1C1E' },
  postAction:  { fontWeight: '400', color: 'rgba(28,28,30,0.6)', fontSize: 13 },
  postMeta:    { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginTop: 2 },
  postMore:    { fontSize: 14, color: 'rgba(28,28,30,0.3)' },
  postPhoto:   { height: 200, position: 'relative' },
  photoOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  photoBottom: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coupeBadge:  { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.4)' },
  coupeBadgeTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
  reserveBtn:  { backgroundColor: 'rgba(168,133,42,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.5)' },
  reserveBtnTxt: { fontSize: 10, color: '#A8852A', fontWeight: '700' },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12, paddingTop: 10 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon:  { fontSize: 18 },
  actionCount: { fontSize: 12, color: 'rgba(28,28,30,0.6)' },
  creditRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  creditLink:  { fontSize: 12, color: '#A8852A', fontWeight: '700' },

  miniPost: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  miniIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trendBtn: { backgroundColor: 'rgba(168,133,42,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)' },
  trendBtnTxt: { fontSize: 11, color: '#A8852A', fontWeight: '700' },

  // ── Tendances ──
  trendCard:    { width: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', padding: 10 },
  trendCardImg: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  trendCardName:{ fontSize: 11, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  trendCardPct: { fontSize: 10, color: '#7C3D8F', fontWeight: '600', marginTop: 2 },

  topCoupeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  topRank:     { fontSize: 13, fontWeight: '800', color: '#A8852A', width: 26 },
  topThumb:    { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topCoupeName:{ fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  topCoupeMeta:{ fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  topLikes:    { fontSize: 12, color: '#e74c3c', fontWeight: '600' },

  barberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  barberAvatar:{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  barberName:  { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  barberRating:{ fontSize: 13, color: '#A8852A', fontWeight: '700' },
  arrow:       { fontSize: 14, color: 'rgba(28,28,30,0.3)' },

  seasonCard: { width: 90, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', padding: 12 },
  seasonName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', marginTop: 4 },

  // ── Slider Avant/Après ──
  sliderHandle:{ position: 'absolute', top: '40%', left: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  sliderLblL:  { position: 'absolute', top: 10, left: 10,  backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sliderLblR:  { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sliderLblTxt:{ color: '#fff', fontSize: 10, fontWeight: '700' },

  // ── Challenge ──
  challengeBox:    { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', padding: 14 },
  challengeTitle:  { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  challengeSub:    { fontSize: 13, color: 'rgba(28,28,30,0.7)', marginBottom: 4 },
  challengeTimer:  { fontSize: 12, color: '#A8852A', fontWeight: '600' },
  participerBtn:   { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(168,133,42,0.12)', borderWidth: 1.5, borderColor: '#A8852A' },
  participerBtnTxt:{ fontSize: 14, fontWeight: '800', color: '#A8852A' },
  challengeGrid:   { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 8 },
  challengeEntry:  { flex: 1 },
  challengeClientName: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 4, textDecorationLine: 'underline' },
  voteBar:     { height: 6, borderRadius: 3, backgroundColor: 'rgba(28,28,30,0.1)', marginBottom: 4, overflow: 'hidden' },
  voteBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#A8852A' },
  votePct:     { fontSize: 12, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 },
  voteBtn:     { borderRadius: 10, paddingVertical: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1.5, borderColor: '#A8852A', marginBottom: 4 },
  voteBtnVoted:{ backgroundColor: '#A8852A' },
  voteBtnTxt:  { fontSize: 12, fontWeight: '800', color: '#A8852A' },

  // ── Tutos ──
  featCard:  { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  featTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  playBtn:   { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -20 }, { translateY: -20 }], width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playIcon:  { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff', marginLeft: 2 },
  durBadge:  { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  durTxt:    { fontSize: 10, color: '#fff', fontWeight: '600' },
  recCard:   { width: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  recPhoto:  { height: 90, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  recPlay:   { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -12 }, { translateY: -12 }], width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  recTitle:  { fontSize: 11, fontWeight: '700', color: '#1C1C1E', lineHeight: 15, marginBottom: 3 },
  recMeta:   { fontSize: 10, color: 'rgba(28,28,30,0.45)' },
  listCard:  { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', height: 80 },
  listThumb: { width: 80, height: 80, flexShrink: 0, position: 'relative' },
  listTitle: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', lineHeight: 16, paddingHorizontal: 12 },
  listMeta:  { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 3, paddingHorizontal: 12 },
  listDur:   { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  listDurTxt:{ fontSize: 8, color: '#fff' },
  searchBar:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', gap: 8 },
  searchPlaceholder:{ fontSize: 13, color: 'rgba(28,28,30,0.35)' },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  chipTxt:   { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.6)' },

  // ── Misc ──
  mockMedia: { backgroundColor: '#0A1A2A', alignItems: 'center', justifyContent: 'center' },
  mockLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 4 },
  playBadge: { position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },

  modalBg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  modalClose:{ position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalImg:  { width: SW, height: SW * 1.2, maxHeight: '80%' },
  modalHint: { position: 'absolute', bottom: 40, fontSize: 12, color: 'rgba(255,255,255,0.35)' },

  loadingTxt: { fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 20 },
});

