import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image, Alert, useWindowDimensions } from 'react-native';
import PhotoViewer from './PhotoViewer';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { isWithinHours, todayDow } from './utils/hours';


// Formate une durée en minutes → "30 min", "1h", "1h30"
function fmtDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

// Formate le prix selon price_type
function fmtPrice(svc) {
  const min = svc.price_min ?? svc.price;
  const max = svc.price_max;
  const type = svc.price_type || 'fixed';
  if (!min && min !== 0) return 'Sur devis';
  if (type === 'range' && max) return `${Number(min).toFixed(0)} – ${Number(max).toFixed(0)} €`;
  if (type === 'from') return `À partir de ${Number(min).toFixed(0)} €`;
  if (Number(min) === 0) return 'Gratuit';
  return `${Number(min).toFixed(0)} €`;
}



export default function CoiffeuseProfileScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const barber = route.params?.barber || {};
const [barberData, setBarberData] = useState(barber);
  const [activeTab, setActiveTab] = useState('Book');

  const [salonOpen, setSalonOpen] = useState(true);
const [isFavorite, setIsFavorite] = useState(false);


/* ajouter le Coiffeuse en favori */
useEffect(() => {
  checkFavorite();
}, []);

useEffect(() => {
  if (barberData?.id) checkFavorite();
}, [barberData?.id]);

const [isFollowing, setIsFollowing] = useState(false);
  const [barberCoupes, setBarberCoupes] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [myClientId, setMyClientId] = useState(null);
  const [likedCoupeIds, setLikedCoupeIds] = useState(new Set());
  const [inspirationCoupeIds, setInspirationCoupeIds] = useState(new Set());
  const [coupeStats, setCoupeStats] = useState({});
  const [reviews, setReviews] = useState([]);
  const [salonServices, setSalonServices] = useState([]);
  const [salonHours, setSalonHours] = useState([]);

useEffect(() => {
  if (barber.id) {
    loadBarberCoupes();
    loadMySession();
    loadBarberReviews();
  }
}, [barber.id]);

async function loadBarberReviews() {
  const { data } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, clientes(name, avatar_url)')
    .eq('barber_id', barber.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (data) setReviews(data);
}

async function loadBarberCoupes() {
  const { data } = await supabase
    .from('coupes')
    .select('id, photo_url, service, likes, views, client_id')
    .eq('barber_id', barber.id)
    .eq('is_private', false)
    .order('likes', { ascending: false })
    .limit(9);
  if (data) setBarberCoupes(data);
}

async function loadMySession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: me } = await supabase
    .from('clientes').select('id').eq('user_id', session.user.id).maybeSingle();
  if (!me) return;
  setMyClientId(me.id);
}

async function loadMyInteractions(coupeIds) {
  if (!myClientId || !coupeIds.length) return;
  const [{ data: likes }, { data: insps }] = await Promise.all([
    supabase.from('coupe_likes').select('coupe_id').eq('client_id', myClientId).in('coupe_id', coupeIds),
    supabase.from('coupe_inspirations').select('coupe_id').eq('client_id', myClientId).in('coupe_id', coupeIds),
  ]);
  setLikedCoupeIds(new Set(likes?.map(l => l.coupe_id) || []));
  setInspirationCoupeIds(new Set(insps?.map(i => i.coupe_id) || []));
}

function handleOpenCoupe(coupe) {
  const i = barberCoupes.findIndex(c => c.id === coupe.id);
  if (i >= 0) setViewerIndex(i);
  supabase.rpc('increment_coupe_views', { p_coupe_id: coupe.id });
  setCoupeStats(prev => ({ ...prev, [coupe.id]: { ...prev[coupe.id], views: (prev[coupe.id]?.views ?? coupe.views ?? 0) + 1 } }));
  if (myClientId) loadMyInteractions([coupe.id]);
}

function handleViewerIndexChange(photo) {
  if (!photo) return;
  supabase.rpc('increment_coupe_views', { p_coupe_id: photo.id });
  setCoupeStats(prev => ({ ...prev, [photo.id]: { ...prev[photo.id], views: (prev[photo.id]?.views ?? photo.views ?? 0) + 1 } }));
  if (myClientId) loadMyInteractions([photo.id]);
}

async function handleLike(coupe) {
  if (!myClientId) return;
  const isLiked = likedCoupeIds.has(coupe.id);
  if (isLiked) {
    const { error } = await supabase.from('coupe_likes').delete()
      .eq('client_id', myClientId).eq('coupe_id', coupe.id);
    if (error) { console.error('unlike error:', error.message); return; }
    setLikedCoupeIds(prev => { const s = new Set(prev); s.delete(coupe.id); return s; });
    setCoupeStats(prev => ({ ...prev, [coupe.id]: { ...prev[coupe.id], likes: Math.max(0, (prev[coupe.id]?.likes ?? coupe.likes ?? 0) - 1) } }));
    supabase.from('coupes').update({ likes: Math.max(0, (coupe.likes || 0) - 1) }).eq('id', coupe.id);
  } else {
    const { error } = await supabase.from('coupe_likes').insert({ client_id: myClientId, coupe_id: coupe.id });
    if (error) { console.error('like error:', error.message); return; }
    setLikedCoupeIds(prev => new Set([...prev, coupe.id]));
    setCoupeStats(prev => ({ ...prev, [coupe.id]: { ...prev[coupe.id], likes: (prev[coupe.id]?.likes ?? coupe.likes ?? 0) + 1 } }));
    supabase.from('coupes').update({ likes: (coupe.likes || 0) + 1 }).eq('id', coupe.id);
  }
}

async function handleInspire(coupe) {
  if (!myClientId) return;
  const isInspired = inspirationCoupeIds.has(coupe.id);
  if (isInspired) {
    const { error } = await supabase.from('coupe_inspirations').delete()
      .eq('client_id', myClientId).eq('coupe_id', coupe.id);
    if (error) { console.error('uninspire error:', error.message); return; }
    setInspirationCoupeIds(prev => { const s = new Set(prev); s.delete(coupe.id); return s; });
  } else {
    const { error } = await supabase.from('coupe_inspirations').insert({ client_id: myClientId, coupe_id: coupe.id });
    if (error) { console.error('inspire error:', error.message); return; }
    setInspirationCoupeIds(prev => new Set([...prev, coupe.id]));
  }
}

async function checkFavorite() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: client } = await supabase
    .from('clientes')
    .select('id, favorite_barber_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (client?.favorite_barber_id === barberData.id) setIsFavorite(true);

  // Vérifie si suivi
  const { data: follow } = await supabase
    .from('followed_barbers')
    .select('id')
    .eq('client_id', client?.id)
    .eq('barber_id', barberData.id)
    .maybeSingle();
  if (follow) setIsFollowing(true);
}

async function handleFollow() {
  console.log('handleFollow called, isFollowing:', isFollowing);
  const { data: { session } } = await supabase.auth.getSession();
  console.log('session:', session?.user?.id);
  const { data: client } = await supabase
    .from('clientes')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  console.log('client:', client?.id);
  
  if (!client) return;

  if (isFollowing) {
    const { error } = await supabase
      .from('followed_barbers')
      .delete()
      .eq('client_id', client.id)
      .eq('barber_id', barberData.id);
    console.log('unfollow error:', error);
    setIsFollowing(false);
  } else {
    const { error } = await supabase
      .from('followed_barbers')
      .insert({ client_id: client.id, barber_id: barberData.id });
    console.log('follow error:', error);
    setIsFollowing(true);
  }
}

async function handleFavorite() {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('handleFavorite session:', session?.user?.id);
  if (!session) { navigation.navigate('Auth'); return; }
  
  const { data: client, error } = await supabase
    .from('clientes')
    .select('id, favorite_barber_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  
  console.log('client found:', JSON.stringify(client), 'error:', error);
  if (!client) return;

  if (isFavorite) {
    const { error: e } = await supabase
      .from('clientes')
      .update({ favorite_barber_id: null })
      .eq('id', client.id);
    console.log('update null error:', e);
    setIsFavorite(false);
  } else {
    const { error: e } = await supabase
      .from('clientes')
      .update({ favorite_barber_id: barberData.id })
      .eq('id', client.id);
    console.log('update favorite error:', e);
    setIsFavorite(true);
  }
}

useEffect(() => {
  if (barber.id) loadSalonStatus();
}, [barber.id]);

async function loadSalonStatus() {
  // Pour les coiffeuses à domicile, pas de notion d'ouverture/fermeture
  if (barber.work_mode === 'domicile') { setSalonOpen(true); return; }
  const { data } = await supabase
    .from('coiffeuses')
    .select('salons(id, is_open)')
    .eq('id', barber.id)
    .maybeSingle();
  const salonId = data?.salons?.id;
  if (salonId) {
    const { data: hoursRow } = await supabase
      .from('opening_hours')
      .select('is_closed, open_time, close_time')
      .eq('salon_id', salonId)
      .eq('day_of_week', todayDow())
      .maybeSingle();
    setSalonOpen(hoursRow ? isWithinHours(hoursRow) : true);
  } else {
    setSalonOpen(data?.salons?.is_open ?? true);
  }
}

  // Toujours recharger les données complètes depuis DB (peu importe le chemin de navigation)
  useEffect(() => {
    if (barber.id) loadBarberWithSalon();
  }, [barber.id]);

  async function loadBarberWithSalon() {
    const { data } = await supabase
      .from('coiffeuses')
      .select('*, salons(*)')
      .eq('id', barber.id)
      .single();
    if (data) {
      setBarberData(data);
      if (data.salon_id) loadSalonServices(data.salon_id);
    }
  }

  async function loadSalonServices(salonId) {
    const [svcRes, hoursRes] = await Promise.all([
      supabase.from('services').select('id, name, price, price_type, price_min, price_max, duration_minutes')
        .eq('salon_id', salonId).eq('is_active', true).order('name'),
      supabase.from('opening_hours').select('day_of_week, open_time, close_time, is_closed')
        .eq('salon_id', salonId),
    ]);
    if (svcRes.data?.length) setSalonServices(svcRes.data);
    if (hoursRes.data) setSalonHours(hoursRes.data);
  }
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


{/* HERO */}
<View style={styles.heroSection}>
  <View style={styles.heroBg}>
    {barberData.photo_url ? (
      <Image source={{ uri: barberData.photo_url }}
        style={styles.heroBgImg} resizeMode="cover" />
    ) : (
      <View style={[styles.heroBgColor, {backgroundColor:'#2C1A06'}]}>
        <Text style={{fontSize:60, opacity:0.08}}>✂</Text>
      </View>
    )}

    {/* Gradient bas seulement */}
    <View style={styles.heroGradient} />

    {/* Bouton retour */}
    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
      <Text style={styles.back}>←</Text>
    </TouchableOpacity>

    {/* Infos en bas de la photo */}
    <View style={styles.heroOverContent}>
      {/* Avatar circulaire */}
      <View style={styles.heroAvatarWrap}>
        {(barberData.avatar_url || barberData.photo_url) ? (
          <Image source={{ uri: barberData.avatar_url || barberData.photo_url }}
            style={styles.heroAvatarImg} resizeMode="cover" />
        ) : (
          <View style={styles.heroAvatarFallback}>
            <Text style={styles.heroAvatarInitials}>
              {barberData.name?.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      {/* Nom + note + spécialité */}
      <View style={styles.heroOverText}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.heroName}>{barberData.name}</Text>
          <View style={styles.ratingInline}>
            <Text style={styles.ratingInlineText}>★ {barberData.rating}</Text>
          </View>
        </View>
        <Text style={styles.heroSpec}>{barberData.specialty}</Text>
      </View>
    </View>
  </View>

  {/* LOCALISATION — salon cliquable ou domicile avec zone */}
  {barberData.work_mode === 'domicile' ? (
    <View style={styles.salonInfoRow}>
      <BlurView intensity={60} tint="light" style={styles.salonInfoCard}>
        <View style={styles.salonInfoIconWrap}>
          <Text style={styles.salonInfoIcon}>🏠</Text>
        </View>
        <View style={styles.salonInfoLeft}>
          <Text style={styles.salonInfoName}>Coiffeuse à domicile</Text>
          <Text style={styles.salonInfoAddr}>
            📍 {barberData.location_label || barberData.city || barberData.address || 'Zone non précisée'}
          </Text>
        </View>
        <View style={styles.salonInfoRight}>
          <View style={[styles.openBadge, { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.28)' }]}>
            <Text style={[styles.openBadgeText, { color: '#7C3D8F' }]}>● Disponible</Text>
          </View>
        </View>
      </BlurView>
    </View>
  ) : barberData.salons ? (
    <TouchableOpacity
      style={styles.salonInfoRow}
      onPress={() => navigation.navigate('SalonPublic', { salon: barberData.salons, barber: barberData })}>
      <BlurView intensity={60} tint="light" style={styles.salonInfoCard}>
        <View style={styles.salonInfoIconWrap}>
          <Text style={styles.salonInfoIcon}>✂️</Text>
        </View>
        <View style={styles.salonInfoLeft}>
          <Text style={styles.salonInfoName}>{barberData.salons.name}</Text>
          <Text style={styles.salonInfoAddr}>
            📍 {[barberData.salons.address, barberData.salons.city].filter(Boolean).join(', ') || 'Voir le salon'}
          </Text>
        </View>
        <View style={styles.salonInfoRight}>
          <View style={[styles.openBadge, !salonOpen && { backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.28)' }]}>
            <Text style={[styles.openBadgeText, !salonOpen && { color: '#C0392B' }]}>
              {salonOpen ? '● Ouvert' : '● Fermé'}
            </Text>
          </View>
          <Text style={styles.salonArrow}>›</Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  ) : null}

  {/* TAGS */}
  <View style={styles.heroTags}>
  <View style={styles.heroTag}>
    <Text style={styles.heroTagText}>{barberData.total_reviews || barberData.clients || '—'} avis</Text>
  </View>
  {barberData.work_mode === 'domicile' ? (
    <View style={[styles.heroTag, {backgroundColor:'rgba(124,61,143,0.12)', borderColor:'rgba(124,61,143,0.28)'}]}>
      <Text style={[styles.heroTagText, {color:'#7C3D8F'}]}>● Disponible</Text>
    </View>
  ) : (
    <View style={[styles.heroTag,
      !salonOpen
        ? {backgroundColor:'rgba(192,57,43,0.12)', borderColor:'rgba(192,57,43,0.28)'}
        : {backgroundColor:'rgba(124,61,143,0.12)', borderColor:'rgba(124,61,143,0.28)'},
    ]}>
      <Text style={[styles.heroTagText, !salonOpen ? {color:'#C0392B'} : {color:'#7C3D8F'}]}>
        {salonOpen ? '● Ouvert' : '● Fermé'}
      </Text>
    </View>
  )}
  <TouchableOpacity
    style={[styles.heroTag, isFavorite
      ? {backgroundColor:'rgba(168,133,42,0.2)', borderColor:'rgba(168,133,42,0.5)'}
      : {backgroundColor:'rgba(168,133,42,0.1)', borderColor:'rgba(168,133,42,0.3)'}]}
    onPress={handleFavorite}>
    <Text style={styles.heroTagText}>
      {isFavorite ? '★ Mon Coiffeuse' : '☆ Favori'}
    </Text>
  </TouchableOpacity>

  {/* SUIVRE — désactivé V1, réactiver en V2 */}
  {false && (
  <TouchableOpacity
    style={[styles.heroTag, isFollowing
      ? {backgroundColor:'rgba(0,113,227,0.15)', borderColor:'rgba(0,113,227,0.3)'}
      : {backgroundColor:'rgba(0,113,227,0.08)', borderColor:'rgba(0,113,227,0.2)'}]}
    onPress={handleFollow}>
    <Text style={[styles.heroTagText, {color:'#0071E3'}]}>
      {isFollowing ? '✓ Suivi' : '+ Suivre'}
    </Text>
  </TouchableOpacity>
  )}
</View>
</View>

        {/* STATS */}
        <BlurView intensity={55} tint="light" style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{barberData.reservations_count > 0 ? barberData.reservations_count : (barberData.nb_avis || 0)}</Text>
            <Text style={styles.statLabel}>Réservations</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>★ {barberData.rating?.toFixed(1) || '—'}</Text>
            <Text style={styles.statLabel}>{barberData.nb_avis > 0 ? `${barberData.nb_avis} avis` : 'Avis'}</Text>
          </View>
          <View style={styles.statSep} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{barberData.loyalty_rate > 0 ? `${Math.round(barberData.loyalty_rate)}%` : '—'}</Text>
            <Text style={styles.statLabel}>Fidèles</Text>
          </View>
        </BlurView>

        {/* SPÉCIALITÉS TAGS */}
        {barberData.specialites?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.specialitesContent}>
            {barberData.specialites.map(sp => {
              const found = require('./colors').SPECIALITES.find(s => s.id === sp);
              return found ? (
                <View key={sp} style={[styles.specPill, { backgroundColor: found.color + '18', borderColor: found.color + '40' }]}>
                  <Text style={[styles.specPillTxt, { color: found.color }]}>{found.label}</Text>
                </View>
              ) : null;
            })}
          </ScrollView>
        )}

        {/* CTA — Prendre rendez-vous */}
        <TouchableOpacity
          style={styles.reserveBtn}
          onPress={() => navigation.navigate('BookAppointment', { barberId: barberData.id })}
          activeOpacity={0.8}>
          <Text style={styles.reserveBtnText}>Réserver</Text>
        </TouchableOpacity>

        {/* TABS */}
        <BlurView intensity={40} tint="light" style={styles.tabs}>
          {['Portfolio','Prestations','Avis','Infos'].map((t) => (
            <TouchableOpacity key={t} style={styles.tab}
              onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab===t && styles.tabActive]}>{t}</Text>
              {activeTab===t && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* ── ONGLET PORTFOLIO ── */}
        {activeTab === 'Portfolio' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>📸 Coupes récentes</Text>
              <Text style={styles.secSub}>{barberCoupes.length} photos</Text>
            </View>

            {barberCoupes.length === 0 ? (
              <Text style={{ padding: 16, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>
                Aucune photo pour l'instant
              </Text>
            ) : (
              <View style={{ paddingHorizontal: 16, gap: 6 }}>
                {/* Ligne 1 : hero pleine largeur */}
                {barberCoupes[0] && (() => {
                  const p = barberCoupes[0];
                  const stats = coupeStats[p.id] || {};
                  return (
                    <TouchableOpacity key={p.id} activeOpacity={0.85}
                      onPress={() => handleOpenCoupe(p)}
                      style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#3A1A06' }}>
                      {p.photo_url
                        ? <Image source={{ uri: p.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.photoEmoji}>✂</Text></View>}
                      <View style={styles.refBadge}><Text style={styles.refBadgeText}>🔥 Top</Text></View>
                      <View style={styles.photoBottom}>
                        <Text style={styles.photoService}>{p.service || '—'}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Text style={styles.photoLikes}>♥ {stats.likes ?? p.likes ?? 0}</Text>
                          <Text style={styles.photoLikes}>👁 {stats.views ?? p.views ?? 0}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* Ligne 2 : deux colonnes égales */}
                {barberCoupes.slice(1, 3).length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {barberCoupes.slice(1, 3).map((p) => {
                      const stats = coupeStats[p.id] || {};
                      const cellW = (width - 32 - 6) / 2;
                      return (
                        <TouchableOpacity key={p.id} activeOpacity={0.85}
                          onPress={() => handleOpenCoupe(p)}
                          style={{ width: cellW, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                          {p.photo_url
                            ? <Image source={{ uri: p.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.photoEmoji}>✂</Text></View>}
                          <View style={styles.photoBottom}>
                            <Text style={styles.photoService}>{p.service || '—'}</Text>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              <Text style={styles.photoLikes}>♥ {stats.likes ?? p.likes ?? 0}</Text>
                              <Text style={styles.photoLikes}>👁 {stats.views ?? p.views ?? 0}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Ligne 3+ : trois colonnes carrées */}
                {barberCoupes.slice(3).length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {barberCoupes.slice(3).map((p) => {
                      const stats = coupeStats[p.id] || {};
                      const cellW = (width - 32 - 12) / 3;
                      return (
                        <TouchableOpacity key={p.id} activeOpacity={0.85}
                          onPress={() => handleOpenCoupe(p)}
                          style={{ width: cellW, height: cellW, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                          {p.photo_url
                            ? <Image source={{ uri: p.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={styles.photoEmoji}>✂</Text></View>}
                          <View style={styles.photoBottom}>
                            <Text style={[styles.photoService, { fontSize: 8 }]}>{p.service || '—'}</Text>
                            <Text style={styles.photoLikes}>♥ {stats.likes ?? p.likes ?? 0}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── ONGLET PRESTATIONS ── */}
        {activeTab === 'Prestations' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>💅 Prestations</Text>
            </View>
            {salonServices.length === 0 ? (
              <BlurView intensity={55} tint="light" style={[styles.timerCard, { alignItems: 'flex-start', padding: 16 }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucune prestation renseignée</Text>
              </BlurView>
            ) : (
              salonServices.map(svc => (
                <BlurView key={svc.id} intensity={55} tint="light" style={styles.svcCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.svcName}>{svc.name}</Text>
                    <Text style={styles.svcMeta}>⏱ {fmtDuration(svc.duration_minutes)}</Text>
                  </View>
                  <Text style={styles.svcPrice}>{fmtPrice(svc)}</Text>
                </BlurView>
              ))
            )}
          </View>
        )}


        {/* ── ONGLET INFOS ── */}
        {activeTab === 'Infos' && (
          <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 8 }}>
            {barberData.bio && (
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>À propos</Text>
                <Text style={styles.infoCardBody}>{barberData.bio}</Text>
              </BlurView>
            )}
            {barberData.instagram && (
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Instagram</Text>
                <Text style={[styles.infoCardBody, { color: '#7C3D8F' }]}>@{barberData.instagram}</Text>
              </BlurView>
            )}
            {(barberData.ville || barberData.adresse) && (
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Localisation</Text>
                <Text style={styles.infoCardBody}>
                  📍 {[barberData.adresse, barberData.ville].filter(Boolean).join(', ')}
                </Text>
              </BlurView>
            )}
            {barberData.work_mode && (
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoCardTitle}>Mode de travail</Text>
                <Text style={styles.infoCardBody}>
                  {barberData.work_mode === 'domicile' ? '🏠 À domicile' : '✂️ En salon'}
                </Text>
              </BlurView>
            )}
          </View>
        )}

        {/* ── ONGLET AVIS ── */}
        {activeTab === 'Avis' && (
          <View>
            <BlurView intensity={60} tint="light" style={styles.ratingCard}>
              <Text style={styles.ratingNum}>{barberData.rating ? Number(barberData.rating).toFixed(1) : '—'}</Text>
              <View style={styles.ratingStarsRow}>
                {[1,2,3,4,5].map(s => (
                  <Text key={s} style={[styles.ratingStar, s <= Math.round(barberData.rating) && styles.ratingStarActive]}>★</Text>
                ))}
              </View>
              <Text style={styles.ratingCount}>{barberData.total_reviews || 0} avis clients</Text>
            </BlurView>

            {reviews.length === 0 ? (
              <BlurView intensity={55} tint="light" style={[styles.avisCard, { alignItems: 'center', paddingVertical: 24 }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun avis pour l'instant</Text>
              </BlurView>
            ) : reviews.map((avis) => {
              const clientName = avis.clientes?.name || 'Client anonyme';
              const date = new Date(avis.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              return (
                <BlurView key={avis.id} intensity={55} tint="light" style={styles.avisCard}>
                  <View style={styles.avisTop}>
                    <View style={styles.avisAv}>
                      <Text style={styles.avisAvText}>{clientName[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.avisInfo}>
                      <Text style={styles.avisName}>{clientName}</Text>
                      <Text style={styles.avisDate}>{date}</Text>
                    </View>
                    <Text style={styles.avisNote}>{'★'.repeat(avis.rating)}</Text>
                  </View>
                  {avis.comment ? <Text style={styles.avisComment}>{avis.comment}</Text> : null}
                </BlurView>
              );
            })}
          </View>
        )}

      </ScrollView>

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={barberCoupes.map(c => ({
          ...c,
          likes: coupeStats[c.id]?.likes ?? c.likes ?? 0,
          views: coupeStats[c.id]?.views ?? c.views ?? 0,
        }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        onIndexChange={handleViewerIndexChange}
        renderActions={myClientId ? (photo) => (
          <View style={styles.photoModalActions}>
            <TouchableOpacity
              style={[styles.photoActionBtn, likedCoupeIds.has(photo.id) && styles.photoActionBtnActive]}
              onPress={() => handleLike(photo)}>
              <Text style={styles.photoActionIcon}>♥</Text>
              <Text style={styles.photoActionLabel}>
                {likedCoupeIds.has(photo.id) ? 'Liké' : 'Liker'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.photoActionBtn, inspirationCoupeIds.has(photo.id) && styles.photoActionBtnSaved]}
              onPress={() => handleInspire(photo)}>
              <Text style={styles.photoActionIcon}>🔖</Text>
              <Text style={styles.photoActionLabel}>
                {inspirationCoupeIds.has(photo.id) ? 'Sauvé' : 'Inspiration'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#FAF4F8' },
  blob1: { position:'absolute', top:-40, right:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(168,133,42,0.18)' },
  blob2: { position:'absolute', top:350, left:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(201,80,122,0.12)' },
  blob3: { position:'absolute', bottom:100, right:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(124,61,143,0.12)' },

// Hero
  heroSection: { marginBottom: 8 },
heroBg: { height: 260, position:'relative', overflow:'hidden' },
heroBgImg: { width:'100%', height:'100%' },
heroBgColor: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center' },
heroGradient: { position:'absolute', bottom:0, left:0, right:0, height:20, backgroundColor:'rgba(0,0,0,0.22)' },
backBtn: { position:'absolute', top:14, left:14, width:32, height:32, borderRadius:16, backgroundColor:'rgba(0,0,0,0.3)', alignItems:'center', justifyContent:'center' },
back: { fontSize:16, color:'#fff' },
heroOverContent: { position:'absolute', bottom:12, left:14, flexDirection:'row', alignItems:'flex-end', gap:10 },
heroAvatarWrap: { width:56, height:56, borderRadius:28, overflow:'hidden', borderWidth:2.5, borderColor:'rgba(255,255,255,0.9)' },
heroAvatarImg: { width:'100%', height:'100%' },
heroAvatarFallback: { width:'100%', height:'100%', backgroundColor:'#7C3D8F', alignItems:'center', justifyContent:'center' },
heroAvatarInitials: { color:'#fff', fontSize:18, fontWeight:'800', letterSpacing:-0.5 },
heroOverText: { flex:1, paddingBottom:4 },
heroName: { fontSize:22, fontWeight:'800', color:'#fff', letterSpacing:-0.5 },
heroSpec: { fontSize:12, color:'rgba(255,255,255,0.72)', marginTop:2 },
salonInfoRow: { marginHorizontal:16, marginTop:10 },
salonInfoCard: { borderRadius:14, overflow:'hidden', padding:11, flexDirection:'row', alignItems:'center', gap:10, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
salonInfoIconWrap: { width:36, height:36, borderRadius:10, backgroundColor:'rgba(124,61,143,0.1)', alignItems:'center', justifyContent:'center', flexShrink:0 },
salonInfoIcon: { fontSize:18 },
salonInfoLeft: { flex:1 },
salonInfoName: { fontSize:14, fontWeight:'700', color:'#1C1C1E' },
salonInfoAddr: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:2 },
salonInfoRight: { flexDirection:'row', alignItems:'center', gap:6 },
openBadge: { backgroundColor:'rgba(124,61,143,0.12)', borderRadius:20, paddingHorizontal:8, paddingVertical:3, borderWidth:0.5, borderColor:'rgba(124,61,143,0.28)' },
openBadgeText: { fontSize:11, fontWeight:'600', color:'#7C3D8F' },
salonArrow: { fontSize:20, color:'rgba(28,28,30,0.3)' },
heroTags: { flexDirection:'row', gap:6, marginTop:10, flexWrap:'wrap', paddingHorizontal:16 },
heroTag: { backgroundColor:'rgba(168,133,42,0.12)', borderRadius:20, paddingHorizontal:9, paddingVertical:4, borderWidth:0.5, borderColor:'rgba(168,133,42,0.28)' },
heroTagText: { fontSize:12, color:'#A8852A', fontWeight:'600' },

  // Stats
  statsRow: { marginHorizontal:16, marginTop:10, borderRadius:16, overflow:'hidden', flexDirection:'row', padding:14, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', justifyContent:'space-around' },
  statItem: { alignItems:'center', flex:1 },
  statVal: { fontSize:18, fontWeight:'800', color:'#7C3D8F' },
  statLabel: { fontSize:10, color:'rgba(28,28,30,0.5)', marginTop:2 },
  statSep: { width:1, backgroundColor:'rgba(28,28,30,0.1)', alignSelf:'stretch', marginVertical:4 },

  // Spécialités pills
  specialitesContent: { paddingHorizontal:16, gap:8, paddingTop:10, paddingBottom:4 },
  specPill: { borderRadius:20, paddingHorizontal:12, paddingVertical:5, borderWidth:1 },
  specPillTxt: { fontSize:12, fontWeight:'600' },

  // Infos tab
  infoCard: { borderRadius:14, overflow:'hidden', padding:14, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  infoCardTitle: { fontSize:11, fontWeight:'700', color:'rgba(28,28,30,0.45)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 },
  infoCardBody: { fontSize:14, color:'#1C1C1E', lineHeight:20 },

  // CTA RDV
  reserveBtn: { marginHorizontal:16, marginVertical:12, backgroundColor:'#7C3D8F', borderRadius:16, paddingVertical:15, alignItems:'center', shadowColor:'#7C3D8F', shadowOffset:{width:0,height:4}, shadowOpacity:0.35, shadowRadius:10, elevation:4 },
  reserveBtnText: { fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.2 },

  // TABS
  tabs: { flexDirection:'row', overflow:'hidden', borderBottomWidth:0.5, borderBottomColor:'rgba(255,255,255,0.5)', marginBottom:4 },
  tab: { flex:1, paddingVertical:10, alignItems:'center', position:'relative' },
  tabText: { fontSize:13, fontWeight:'600', color:'rgba(28,28,30,0.5)' },
  tabActive: { color:'#A8852A' },
  tabLine: { position:'absolute', bottom:0, width:'60%', height:2, backgroundColor:'#A8852A', borderRadius:1 },

  // SECTION
  secRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingTop:12, paddingBottom:8 },
  secTitle: { fontSize:16, fontWeight:'800', color:'#1C1C1E' },
  secSub: { fontSize:12, color:'rgba(28,28,30,0.45)' },

  // BOOK GRID
  photoGrid: { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:6 },
  photoCell: { width:'31%', aspectRatio:1, borderRadius:13, overflow:'hidden', alignItems:'center', justifyContent:'center', position:'relative' },
  photoCellWide: { width:'100%', height:160, aspectRatio:'auto' },
  photoEmoji: { fontSize:24, opacity:0.15 },
  refBadge: { position:'absolute', top:7, left:7, backgroundColor:'rgba(168,133,42,0.85)', borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  refBadgeText: { fontSize:9, fontWeight:'700', color:'#fff' },
  photoOverlay: { position:'absolute', bottom:0, left:0, right:0, height:50, backgroundColor:'rgba(0,0,0,0.6)' },
  photoBottom: { position:'absolute', bottom:6, left:8, right:8, flexDirection:'row', justifyContent:'space-between' },
  photoService: { fontSize:9, fontWeight:'600', color:'#fff' },
  photoLikes: { fontSize:9, color:'rgba(255,255,255,0.7)' },

  // AVIS
  ratingCard: { marginHorizontal:16, borderRadius:16, overflow:'hidden', padding:16, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', marginBottom:10 },
  ratingNum: { fontSize:44, fontWeight:'800', color:'#A8852A', lineHeight:48 },
  ratingStars: { fontSize:20, color:'#A8852A', marginTop:4 },
  ratingStarsRow: { flexDirection:'row', gap:3, marginTop:4 },
  ratingStar: { fontSize:20, color:'rgba(28,28,30,0.15)' },
  ratingStarActive: { color:'#A8852A' },
  ratingCount: { fontSize:12, color:'rgba(28,28,30,0.5)', marginTop:4 },
  avisCard: { marginHorizontal:16, marginBottom:8, borderRadius:15, overflow:'hidden', padding:12, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  avisTop: { flexDirection:'row', gap:9, alignItems:'center', marginBottom:8 },
  avisAv: { width:32, height:32, borderRadius:10, backgroundColor:'rgba(168,133,42,0.12)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  avisAvText: { fontSize:12, fontWeight:'700', color:'#A8852A' },
  avisInfo: { flex:1 },
  avisName: { fontSize:13, fontWeight:'600', color:'#1C1C1E' },
  avisDate: { fontSize:10, color:'rgba(28,28,30,0.45)', marginTop:1 },
  avisNote: { fontSize:13, color:'#A8852A' },
  avisComment: { fontSize:12, color:'rgba(28,28,30,0.65)', lineHeight:18 },

  // PRESTATIONS
  svcCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden', padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  svcName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  svcMeta: { fontSize: 12, color: 'rgba(28,28,30,0.5)' },
  svcPrice: { fontSize: 16, fontWeight: '800', color: '#7C3D8F' },

  // RDV
  domicileNote: { marginHorizontal:16, marginBottom:12, borderRadius:14, overflow:'hidden', padding:12, borderWidth:0.5, borderColor:'rgba(124,61,143,0.25)' },
  domicileNoteText: { fontSize:13, color:'#7C3D8F', lineHeight:18 },
  rdvEmptyCard: { marginHorizontal:16, borderRadius:14, overflow:'hidden', padding:14, alignItems:'flex-start', borderWidth:0.5, borderColor:'rgba(192,57,43,0.2)' },
  rdvLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(28,28,30,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  rdvSvcChip: { backgroundColor: 'rgba(124,61,143,0.08)', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.25)', minWidth: 120 },
  rdvSvcChipActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  rdvSvcChipText: { fontSize: 13, fontWeight: '700', color: '#7C3D8F', marginBottom: 2 },
  rdvSvcChipSub: { fontSize: 11, color: 'rgba(124,61,143,0.6)' },
  rdvDayChip: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)', alignItems: 'center', minWidth: 58 },
  rdvDayChipActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  rdvDayLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(28,28,30,0.45)', textTransform: 'uppercase' },
  rdvDayNum: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', lineHeight: 24 },
  rdvDayMonth: { fontSize: 10, color: 'rgba(28,28,30,0.4)' },
  rdvSummary: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 16, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.25)', marginBottom: 8 },
  rdvSummaryTitle: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 12 },
  rdvSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  rdvSummaryLabel: { fontSize: 13, color: 'rgba(28,28,30,0.5)' },
  rdvSummaryValue: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  rdvTimeChip: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)' },
  rdvTimeChipActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  rdvTimeChipText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  rdvBookBtn: { marginTop: 14, backgroundColor: '#7C3D8F', borderRadius: 14, padding: 14, alignItems: 'center' },
  rdvBookBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  favoriteBtn: { marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: 'rgba(168,133,42,0.1)', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)' },
favoriteBtnActive: { backgroundColor: 'rgba(168,133,42,0.2)', borderColor: 'rgba(168,133,42,0.5)' },
favoriteBtnText: { fontSize: 13, fontWeight: '600', color: '#A8852A' },
favoriteBtnTextActive: { color: '#854F0B' },
ratingInline: { backgroundColor: 'rgba(168,133,42,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.4)' },
ratingInlineText: { fontSize: 12, fontWeight: '700', color: '#A8852A' },
photoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
photoModalClose: { position: 'absolute', top: 50, left: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
photoModalService: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 14 },
photoModalStats: { flexDirection: 'row', gap: 16, marginTop: 8 },
photoModalStatText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
photoModalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
photoActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
photoActionBtnActive: { backgroundColor: 'rgba(192,57,43,0.3)', borderColor: 'rgba(192,57,43,0.6)' },
photoActionBtnSaved: { backgroundColor: 'rgba(168,133,42,0.3)', borderColor: 'rgba(168,133,42,0.6)' },
photoActionIcon: { fontSize: 16 },
photoActionLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
