import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { haversineKm } from './utils/geo';
import { isWithinHours, todayDow } from './utils/hours';
import { supabase } from './supabase';
import QueueCard from './QueueCard';
import { useFocusEffect } from '@react-navigation/native';
import { colors, SPECIALITES } from './colors';

const { width } = Dimensions.get('window');

// Catégories affichées dans la section "Parcourir"
const CATEGORIES = [
  { id: 'tresses',    label: 'Braids',     emoji: '🧵' },
  { id: 'perruques',  label: 'Lace wigs',  emoji: '👑' },
  { id: 'locks',      label: 'Locks',      emoji: '🌀' },
  { id: 'naturel',    label: 'Silk press', emoji: '✨' },
  { id: 'twist',      label: 'Naturel',    emoji: '🌿' },
  { id: 'defrisage',  label: 'Défrisage',  emoji: '💫' },
];

export default function HomeScreen({ navigation }) {
  const [session, setSession] = useState(null);
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popularCoiffeuses, setPopularCoiffeuses] = useState([]);
  const [queueKey, setQueueKey] = useState(0);
  const [simMode, setSimMode] = useState(null);
  const [clientAvatar, setClientAvatar] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyCount, setNearbyCount] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryPhotos, setCategoryPhotos] = useState({});
  const [inspirationPhoto, setInspirationPhoto] = useState(null);
  const [referenceCoupe, setReferenceCoupe] = useState(null);
  const [trendingCoupes, setTrendingCoupes] = useState([]);

  const SIM_MODES = [null, 'active', 'in_progress'];
  const SIM_LABELS = {
    null: '🧪 Simuler file',
    active: '🟢 File active — →',
    in_progress: '✂ Coupe en cours — →',
  };

  const MOCK_ENTRIES = {
    active: {
      id: 'mock-active', status: 'active', position: 2,
      estimated_wait: 25, service: 'Knotless Braids', duration: 30,
      barber_id: 'mock-barber', decale_used: false,
      updated_at: new Date().toISOString(),
      _mock_people_ahead: 1, _mock_queue_total: 3,
      barbers: { id: 'mock-barber', name: 'Nana', photo_url: null, salons: { name: 'Nana Hair', latitude: null, longitude: null } },
    },
    in_progress: {
      id: 'mock-inprogress', status: 'in_progress', position: 1,
      estimated_wait: 0, service: 'Locks', duration: 180,
      barber_id: 'mock-barber', decale_used: false,
      updated_at: new Date(Date.now() - 10 * 60000).toISOString(),
      _mock_people_ahead: 0, _mock_queue_total: 1,
      barbers: { id: 'mock-barber', name: 'Fatou', photo_url: null, salons: { name: 'Pretty Locks', latitude: null, longitude: null } },
    },
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchClientAvatar(session.user.id);
    });
    supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) fetchClientAvatar(session.user.id);
    });
  }, []);

  useEffect(() => {
    fetchSalons();
    fetchPopularCoiffeuses();
    fetchCategoryPhotos();
    fetchInspirationPhoto();
    fetchUserLocation();
    fetchReferenceCoupe();
    fetchTrendingCoupes();
  }, []);

  useEffect(() => {
    if (!userLocation || salons.length === 0) { setNearbyCount(null); return; }
    const count = salons.filter(s =>
      s.latitude && s.longitude &&
      haversineKm(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude) <= 10,
    ).length;
    setNearbyCount(count);
  }, [salons, userLocation]);

  useFocusEffect(
    useCallback(() => {
      setQueueKey(prev => prev + 1);
      fetchUnreadCount();
      checkBarberPhotoNotif();
    }, []),
  );

  async function checkBarberPhotoNotif() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, data')
      .eq('recipient_user_id', session.user.id)
      .eq('type', 'barber_photo')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();
    if (data?.data) navigation.navigate('PhotoConsent', { ...data.data, notification_id: data.id });
  }

  async function fetchUnreadCount() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', session.user.id)
      .eq('read', false);
    setUnreadCount(count || 0);
  }

  async function fetchClientAvatar(userId) {
    const { data } = await supabase
      .from('clientes').select('avatar_url').eq('user_id', userId).maybeSingle();
    if (data?.avatar_url) setClientAvatar(data.avatar_url);
  }

  async function fetchSalons() {
    try {
      const { data: allSalons } = await supabase
        .from('salons').select('*').order('rating', { ascending: false });
      if (!allSalons) { setLoading(false); return; }

      const { data: todayHours } = await supabase
        .from('opening_hours')
        .select('salon_id, is_closed, open_time, close_time')
        .in('salon_id', allSalons.map(s => s.id))
        .eq('day_of_week', todayDow());

      const hoursMap = {};
      (todayHours || []).forEach(h => { hoursMap[h.salon_id] = h; });

      setSalons(allSalons.filter(salon => {
        const h = hoursMap[salon.id];
        return h ? isWithinHours(h) : true;
      }));
    } catch (e) {
      console.log('Erreur salons:', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPopularCoiffeuses() {
    const { data } = await supabase
      .from('coiffeuses')
      .select('id, name, photo_url, rating, total_reviews, city, latitude, longitude, specialites, salons(name, photo_url)')
      .order('rating', { ascending: false })
      .limit(8);
    if (data) setPopularCoiffeuses(data);
  }

  async function fetchCategoryPhotos() {
    const { data } = await supabase
      .from('book_photos')
      .select('id, photo_url, categorie')
      .not('photo_url', 'is', null)
      .order('likes', { ascending: false })
      .limit(60);
    const map = {};
    (data || []).forEach(p => {
      if (p.categorie && !map[p.categorie]) map[p.categorie] = p.photo_url;
    });
    setCategoryPhotos(map);
  }

  async function fetchReferenceCoupe() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('clientes')
      .select('reference_coupe_id, coupes:reference_coupe_id(id, photo_url, service, name, created_at)')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data?.coupes) setReferenceCoupe(data.coupes);
  }

  async function fetchTrendingCoupes() {
    const { data } = await supabase.rpc('get_trending_coupes', { limit_count: 10 });
    if (data) setTrendingCoupes(data);
  }

  async function fetchInspirationPhoto() {
    const { data } = await supabase
      .from('book_photos')
      .select('id, photo_url, caption, categorie, coiffeuse_id, coiffeuses(id, name)')
      .not('photo_url', 'is', null)
      .order('likes', { ascending: false })
      .limit(1).maybeSingle();
    if (data) setInspirationPhoto(data);
  }

  async function fetchUserLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {}
  }

  function getCoiffeuseDistance(c) {
    if (!userLocation || !c.latitude || !c.longitude) return null;
    return haversineKm(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude);
  }

  const sortedSalons = userLocation
    ? [...salons]
        .map(s => ({
          ...s,
          _dist: s.latitude && s.longitude
            ? haversineKm(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude)
            : Infinity,
        }))
        .sort((a, b) => a._dist - b._dist)
    : salons;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} />
        <View style={s.blob2} />
        <View style={s.blob3} />
        <View style={s.blob4} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.title}>
            <Text style={s.titlePurple}>Fresh</Text>Girlz
          </Text>
          {session ? (
            <TouchableOpacity style={s.bellBtn} onPress={() => navigation.navigate('Notification')}>
              <Image source={require('./assets/notiffull.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
              {unreadCount > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeTxt}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.authBtn} onPress={() => navigation.navigate('Auth')}>
              <Text style={s.authBtnTxt}>Connexion</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── BARRE DE RECHERCHE ── */}
        <View style={s.searchRow}>
          <BlurView intensity={55} tint="light" style={s.searchBar}>
            <TouchableOpacity style={s.searchTap} activeOpacity={0.7}
              onPress={() => navigation.navigate('Search')}>
              <Text style={s.searchIcon}>🔍</Text>
              <Text style={s.searchPh}>Coiffeuse, spécialité, ville...</Text>
            </TouchableOpacity>
          </BlurView>
          <BlurView intensity={55} tint="light" style={s.searchFilterWrap}>
            <TouchableOpacity style={s.searchFilterInner} activeOpacity={0.7}
              onPress={() => navigation.navigate('NearbyAvailable')}>
              <Text style={s.searchFilterIcon}>⚡</Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* ── CATÉGORIES ── */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Parcourir</Text>
          <Text style={s.secLink}>Voir tout</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={s.catItem}
              activeOpacity={0.82}
              onPress={() => navigation.navigate('Search', { category: cat.id })}>
              <View style={s.catCircle}>
                {categoryPhotos[cat.id] ? (
                  <Image source={{ uri: categoryPhotos[cat.id] }} style={s.catImg} resizeMode="cover" />
                ) : (
                  <View style={s.catImgFallback}>
                    <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  </View>
                )}
              </View>
              <Text style={s.catLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── COUPE DE RÉFÉRENCE ── */}
        {referenceCoupe ? (
          <BlurView intensity={55} tint="light" style={s.refCard}>
            <View style={s.refPhotoWrap}>
              {referenceCoupe.photo_url
                ? <Image source={{ uri: referenceCoupe.photo_url }} style={s.refPhoto} resizeMode="cover" />
                : <View style={[s.refPhoto, s.refPhotoFallback]}><Text style={{ fontSize: 28 }}>✂️</Text></View>
              }
            </View>
            <View style={s.refInfo}>
              <Text style={s.refLabel}>Ma coupe de référence</Text>
              <Text style={s.refName} numberOfLines={1}>
                {referenceCoupe.name || referenceCoupe.service || 'Coupe enregistrée'}
              </Text>
              <Text style={s.refDate}>
                Modifiée le {new Date(referenceCoupe.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </Text>
              <View style={s.refActions}>
                <TouchableOpacity style={s.refActionBtn}
                  onPress={() => navigation.navigate('Explorer', { refCoupeId: referenceCoupe.id })}>
                  <Text style={s.refActionTxt}>Trouver une coiffeuse</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.refActionBtn, s.refActionBtnSecondary]}
                  onPress={() => navigation.navigate('Profile', { openRefCoupe: true })}>
                  <Text style={[s.refActionTxt, s.refActionTxtSecondary]}>Modifier</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        ) : session ? (
          <TouchableOpacity style={s.refCardEmpty}
            onPress={() => navigation.navigate('Profile', { openRefCoupe: true })}>
            <BlurView intensity={55} tint="light" style={s.refCardEmptyInner}>
              <Text style={s.refEmptyIcon}>✂️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.refEmptyTitle}>Ajouter ma coupe de référence</Text>
                <Text style={s.refEmptyDesc}>Pour que les coiffeuses comprennent ton style</Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 18 }}>+</Text>
            </BlurView>
          </TouchableOpacity>
        ) : null}

        {/* ── FILE ACTIVE ── */}
        <QueueCard key={queueKey} mockEntry={undefined} />

        {/* ── CARTE MAP ── */}
        <TouchableOpacity style={s.mapCard} activeOpacity={0.9} onPress={() => navigation.navigate('Map')}>
          <View style={s.mapBg}>
            <View style={[s.mapStreetH, { top: '45%' }]} />
            <View style={[s.mapStreetV, { left: '35%' }]} />
            <View style={[s.mapStreetV, { left: '65%', opacity: 0.5 }]} />
            <View style={[s.mapStreetH, { top: '70%', opacity: 0.5 }]} />
            {[
              { top: '30%', left: '30%', color: colors.secondary },
              { top: '55%', left: '60%', color: colors.primary },
              { top: '22%', left: '70%', color: colors.dark },
            ].map((pin, i) => (
              <View key={i} style={[s.pin, { top: pin.top, left: pin.left, backgroundColor: pin.color }]}>
                <Text style={s.pinTxt}>✂</Text>
              </View>
            ))}
          </View>
          <View style={s.mapLabel}>
            <Text style={s.mapLabelTxt}>
              {nearbyCount !== null
                ? `${nearbyCount} salons ouverts à 10 km`
                : salons.length > 0
                  ? `${salons.length} salons ouverts près de toi`
                  : 'Salons près de toi'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ── INSPIRATION DU JOUR ── */}
        {inspirationPhoto && (
          <>
            <View style={[s.secRow, { marginTop: 8 }]}>
              <Text style={s.secTitle}>Inspiration du jour ✦</Text>
            </View>
            <TouchableOpacity
              style={s.inspirCard}
              activeOpacity={0.9}
              onPress={() => inspirationPhoto.coiffeuses?.id &&
                navigation.navigate('BarberProfile', { barber: { id: inspirationPhoto.coiffeuse_id } })}>
              {inspirationPhoto.photo_url && (
                <Image
                  source={{ uri: inspirationPhoto.photo_url }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              )}
              <View style={s.inspirGrad} />
              <View style={s.inspirBody}>
                <Text style={s.inspirLabel}>Inspiration du jour ✦</Text>
                <Text style={s.inspirTitle}>
                  {inspirationPhoto.caption || inspirationPhoto.categorie
                    ? (inspirationPhoto.caption || SPECIALITES.find(sp => sp.id === inspirationPhoto.categorie)?.label || 'Tendance')
                    : 'Tendance du moment'}
                </Text>
                {inspirationPhoto.coiffeuses?.name && (
                  <Text style={s.inspirBy}>par {inspirationPhoto.coiffeuses.name}</Text>
                )}
              </View>
              <TouchableOpacity
                style={s.inspirBtn}
                onPress={() => inspirationPhoto.coiffeuse_id &&
                  navigation.navigate('BarberProfile', { barber: { id: inspirationPhoto.coiffeuse_id } })}>
                <Text style={s.inspirBtnTxt}>Voir</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </>
        )}

        {/* ── PROCHE DE TOI ── */}
        <View style={s.secRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image source={require('./assets/proche.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
            <Text style={s.secTitle}>Proche de toi</Text>
          </View>
          <Text style={s.secLink} onPress={() => navigation.navigate('NearbySalons')}>Voir tout</Text>
        </View>

        {sortedSalons.slice(0, 3).map(salon => {
          const dist = salon._dist !== undefined && salon._dist !== Infinity
            ? salon._dist
            : (userLocation && salon.latitude && salon.longitude
                ? haversineKm(userLocation.latitude, userLocation.longitude, salon.latitude, salon.longitude)
                : null);
          return (
            <TouchableOpacity key={salon.id} activeOpacity={0.9}
              onPress={() => navigation.navigate('SalonPublic', { salon })}>
              <BlurView intensity={55} tint="light" style={s.salonCard}>
                <View style={s.salonPhoto}>
                  {salon.photo_url
                    ? <Image source={{ uri: salon.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : (
                      <View style={[StyleSheet.absoluteFill, s.salonPhotoFallback]}>
                        <Text style={s.salonPhotoInitial}>
                          {salon.name?.charAt(0)?.toUpperCase() || '✂'}
                        </Text>
                      </View>
                    )}
                </View>
                <View style={s.salonInfo}>
                  <Text style={s.salonName} numberOfLines={1}>{salon.name}</Text>
                  <Text style={s.salonCity} numberOfLines={1}>{salon.city || salon.address || ''}</Text>
                  <Text style={s.salonStars}>★ {salon.rating?.toFixed(1) || '—'}</Text>
                </View>
                <View style={s.salonRight}>
                  <View style={s.openPill}>
                    <Text style={s.openPillTxt}>● Ouvert</Text>
                  </View>
                  {dist !== null && (
                    <Text style={s.salonDist}>
                      {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                    </Text>
                  )}
                </View>
              </BlurView>
            </TouchableOpacity>
          );
        })}
        {salons.length === 0 && (
          <BlurView intensity={55} tint="light" style={[s.salonCard, { justifyContent: 'center', padding: 16 }]}>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>Aucun salon ouvert près de toi</Text>
          </BlurView>
        )}

        {/* ── COIFFEUSES POPULAIRES ── */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Coiffeuses proches de toi</Text>
          <Text style={s.secLink} onPress={() => navigation.navigate('TopBarbers')}>Voir tout</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.popContent}>
          {[...popularCoiffeuses]
            .map(c => ({ ...c, _dist: getCoiffeuseDistance(c) }))
            .sort((a, b) => {
              if (a._dist !== null && b._dist !== null) return a._dist - b._dist;
              if (a._dist !== null) return -1;
              if (b._dist !== null) return 1;
              return (b.rating || 0) - (a.rating || 0);
            })
            .map(c => {
            const dist = c._dist !== undefined ? c._dist : getCoiffeuseDistance(c);
            const mainSpec = c.specialites?.length > 0
              ? SPECIALITES.find(sp => c.specialites.includes(sp.id))
              : null;
            return (
              <TouchableOpacity
                key={c.id}
                style={s.popCard}
                activeOpacity={0.88}
                onPress={() => navigation.navigate('BarberProfile', { barber: c })}>
                {/* Photo circulaire */}
                <View style={s.popPhotoWrap}>
                  {(c.photo_url || c.salons?.photo_url) ? (
                    <Image source={{ uri: c.photo_url || c.salons?.photo_url }} style={s.popPhoto} resizeMode="cover" />
                  ) : (
                    <View style={[s.popPhoto, s.popPhotoFallback]}>
                      <Text style={{ fontSize: 24 }}>✂️</Text>
                    </View>
                  )}
                  {/* Badge vérifié */}
                  <View style={s.popVerified}>
                    <Text style={s.popVerifiedTxt}>✓</Text>
                  </View>
                </View>

                {/* Infos */}
                <Text style={s.popName} numberOfLines={1}>{c.name}</Text>
                {mainSpec && (
                  <Text style={s.popSpec} numberOfLines={1}>
                    {mainSpec.emoji} {mainSpec.label}
                  </Text>
                )}
                <View style={s.popMeta}>
                  <Text style={s.popRating}>★ {c.rating?.toFixed(1) || '—'}</Text>
                  {c.total_reviews > 0 && (
                    <Text style={s.popAvis}>({c.total_reviews})</Text>
                  )}
                </View>
                {dist !== null && (
                  <Text style={s.popDist}>
                    📍 {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── TENDANCES DE LA SEMAINE ── */}
        {trendingCoupes.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}>Tendances 🔥</Text>
              <Text style={s.secLink} onPress={() => navigation.navigate('Explorer', { tab: 'inspirations' })}>Voir tout</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.trendContent}>
              {trendingCoupes.map((coupe, i) => (
                <TouchableOpacity key={coupe.id} style={s.trendCard} activeOpacity={0.88}
                  onPress={() => navigation.navigate('BarberProfile', { barber: { id: coupe.barber_id } })}>
                  <View style={s.trendPhotoWrap}>
                    {coupe.photo_url
                      ? <Image source={{ uri: coupe.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryLight }]} />
                    }
                    <View style={s.trendOverlay} />
                    <View style={s.trendRankBadge}>
                      <Text style={s.trendRankTxt}>{i + 1}</Text>
                    </View>
                    {coupe.likes > 0 && (
                      <View style={s.trendLikeBadge}>
                        <Text style={s.trendLikeTxt}>♥ {coupe.likes}</Text>
                      </View>
                    )}
                  </View>
                  {coupe.coiffeuse_name && (
                    <Text style={s.trendCoiffName} numberOfLines={1}>{coupe.coiffeuse_name}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAF4F8',
  },
  blob1: {
    position: 'absolute', top: -50, right: -40,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(124,61,143,0.10)',
  },
  blob2: {
    position: 'absolute', top: 120, left: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(201,80,122,0.08)',
  },
  blob3: {
    position: 'absolute', bottom: 300, right: -50,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(212,168,67,0.10)',
  },
  blob4: {
    position: 'absolute', bottom: -40, left: -30,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(124,61,143,0.07)',
  },

  // ── Header ──
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, paddingTop: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  titlePurple: { color: colors.primary },
  bellBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(28,28,30,0.06)',
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#FAF4F8',
  },
  bellBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
  authBtn: {
    backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  authBtnTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // ── Search ──
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 6, gap: 8,
  },
  searchBar: {
    flex: 1, borderRadius: 16, padding: 13, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  searchTap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchPh: { flex: 1, fontSize: 14, color: 'rgba(28,28,30,0.35)' },
  searchFilterWrap: {
    borderRadius: 12, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  searchFilterInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchFilterIcon: { fontSize: 18 },

  // ── Catégories ──
  catContent: { paddingHorizontal: 16, gap: 14, paddingBottom: 4 },
  catItem: { alignItems: 'center', width: 72 },
  catCircle: {
    width: 66, height: 66, borderRadius: 33, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.primary,
    marginBottom: 6,
  },
  catImg: { width: '100%', height: '100%' },
  catImgFallback: {
    width: '100%', height: '100%',
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  catLabel: {
    fontSize: 11, fontWeight: '600', color: colors.dark,
    textAlign: 'center', lineHeight: 14,
  },

  // ── Sim button ──
  simBtn: {
    alignSelf: 'center', marginTop: 8, marginBottom: 2,
    backgroundColor: 'rgba(28,28,30,0.07)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)',
  },
  simBtnTxt: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },

  // ── Section header ──
  secRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
  },
  secTitle: { fontSize: 18, fontWeight: '800', color: colors.dark },
  secLink: { fontSize: 13, color: colors.primary },

  // ── Map ──
  mapCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    borderRadius: 18, overflow: 'hidden', height: 160, position: 'relative',
  },
  mapBg: { flex: 1, backgroundColor: '#D8C8E8' },
  mapStreetH: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  mapStreetV: {
    position: 'absolute', top: 0, bottom: 0, width: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  pin: {
    position: 'absolute', width: 20, height: 20, borderRadius: 10,
    borderBottomRightRadius: 0, transform: [{ rotate: '-45deg' }],
    borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  pinTxt: { fontSize: 7, color: '#fff', transform: [{ rotate: '45deg' }] },
  mapLabel: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  mapLabelTxt: { fontSize: 10, fontWeight: '700', color: colors.dark },

  // ── Inspiration du jour ──
  inspirCard: {
    marginHorizontal: 16, borderRadius: 20, overflow: 'hidden',
    height: 220, position: 'relative', backgroundColor: colors.primaryLight,
    marginBottom: 4,
  },
  inspirGrad: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(28,0,40,0.52)',
  },
  inspirBody: {
    position: 'absolute', top: 16, left: 18, right: 100,
  },
  inspirLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  inspirTitle: {
    fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 24, marginBottom: 4,
  },
  inspirBy: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  inspirBtn: {
    position: 'absolute', bottom: 16, left: 18,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  inspirBtnTxt: { fontSize: 13, fontWeight: '800', color: colors.primary },

  // ── Salons ──
  salonCard: {
    marginHorizontal: 16, marginBottom: 8, borderRadius: 14,
    overflow: 'hidden', flexDirection: 'row',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  salonPhoto: { width: 64, alignSelf: 'stretch', overflow: 'hidden' },
  salonPhotoFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  salonPhotoInitial: { fontSize: 22, fontWeight: '800', color: colors.primary },
  salonInfo: { flex: 1, padding: 10 },
  salonName: { fontSize: 14, fontWeight: '700', color: colors.dark },
  salonCity: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  salonStars: { fontSize: 11, color: colors.secondary, marginTop: 2 },
  salonRight: { padding: 10, alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  openPill: {
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: colors.primaryLight,
    borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)',
  },
  openPillTxt: { fontSize: 11, fontWeight: '600', color: colors.primary },
  salonDist: { fontSize: 10, color: colors.textMuted },

  // ── Coiffeuses populaires ──
  popContent: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  popCard: {
    width: 120, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 18, padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  popPhotoWrap: { position: 'relative', marginBottom: 8 },
  popPhoto: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: colors.primary,
  },
  popPhotoFallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  popVerified: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1A9FE0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  popVerifiedTxt: { fontSize: 10, color: '#fff', fontWeight: '800' },
  popName: {
    fontSize: 13, fontWeight: '700', color: colors.dark,
    textAlign: 'center', marginBottom: 2,
  },
  popSpec: { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  popMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  popRating: { fontSize: 12, fontWeight: '700', color: colors.secondary },
  popAvis: { fontSize: 11, color: colors.textMuted },
  popDist: { fontSize: 11, color: colors.textMuted, marginTop: 3 },

  // ── Coupe de référence ──
  refCard: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 18, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
    gap: 12,
  },
  refPhotoWrap: {
    width: 72, height: 72, borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: colors.primary,
  },
  refPhoto: { width: '100%', height: '100%' },
  refPhotoFallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  refInfo: { flex: 1, gap: 3 },
  refLabel: { fontSize: 10, fontWeight: '600', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4 },
  refName: { fontSize: 15, fontWeight: '800', color: colors.dark },
  refDate: { fontSize: 11, color: colors.textMuted },
  refActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  refActionBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: colors.primary,
  },
  refActionBtnSecondary: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary,
  },
  refActionTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
  refActionTxtSecondary: { color: colors.primary },
  refCardEmpty: { marginHorizontal: 16, marginTop: 8, borderRadius: 18, overflow: 'hidden' },
  refCardEmptyInner: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  refEmptyIcon: { fontSize: 28 },
  refEmptyTitle: { fontSize: 14, fontWeight: '700', color: colors.dark },
  refEmptyDesc: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  // ── Tendances ──
  trendContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  trendCard: { width: 130, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primaryLight },
  trendPhotoWrap: { width: 130, height: 160, position: 'relative' },
  trendOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(28,0,40,0.3)',
  },
  trendRankBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  trendRankTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  trendLikeBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  trendLikeTxt: { fontSize: 10, color: '#fff', fontWeight: '600' },
  trendCoiffName: {
    fontSize: 11, fontWeight: '600', color: colors.dark,
    paddingHorizontal: 8, paddingVertical: 6,
  },
});
