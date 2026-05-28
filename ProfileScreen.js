import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, Modal, Alert,
  TouchableOpacity, SafeAreaView, StatusBar, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { calculateFreshScore, getFreshLevel } from './freshScore';
import { Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useWindowDimensions } from 'react-native';
import { FlatList } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import FreshScoreRing from './FreshScoreRing';
import PhotoViewer from './PhotoViewer';




const CAPIL_TYPES = ['3C','4A','4B','4C'];
const FACE_SHAPES = ['Ovale','Rond','Carré','Rectangle'];
const PREFS = ['Fade','Design','Barbe','Locs','Twists','Afro'];


export default function ProfileScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('Profil');
  const [bookTab, setBookTab] = useState('public');
  const [showMenu, setShowMenu] = useState(false);
  const [rappelOn, setRappelOn] = useState(true);
  const [rappelDays, setRappelDays] = useState(21);
  const { width } = useWindowDimensions();
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
const cellSize = Math.floor((width - 32 - 12) / 3); // padding + gaps

  // Données Supabase
  const [clientData, setClientData] = useState(null);
  const [session, setSession] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [queueHistory, setQueueHistory] = useState([]);
  const [favoriteBarber, setFavoriteBarber] = useState(null);
  const [favoriteSalon, setFavoriteSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalLikes, setTotalLikes] = useState(0);
  const [freshScore, setFreshScore] = useState(0);
  const [referenceCut, setReferenceCut] = useState(null);
  const [showRefModal, setShowRefModal] = useState(false);
const [allCoupes, setAllCoupes] = useState([]);

  // State local pour édition
  const [capilType, setCapilType] = useState('4A');
  const [faceShape, setFaceShape] = useState('Ovale');
  const [prefs, setPrefs] = useState(['Fade','Design']);


  useFocusEffect(
  useCallback(() => {
    loadAll();
  }, [])
);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      setSession(null);
      setClientData(null);
      setFreshScore(0);
      setAllCoupes([]);
      setFollowedBarbers([]);
      setLikedCoupes([]);
      setInspirationCoupes([]);
      setFollowedClients([]);
      setReviews([]);
      setQueueHistory([]);
      setFavoriteBarber(null);
      setReferenceCut(null);
    } else {
      setSession(session);
      loadAll();
    }
  });
  return () => subscription.unsubscribe();
}, []);

  const [followedBarbers, setFollowedBarbers] = useState([]);
  const [likedCoupes, setLikedCoupes] = useState([]);
  const [inspirationCoupes, setInspirationCoupes] = useState([]);
  const [followedClients, setFollowedClients] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);

  async function loadAll() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setSession(session);

    // 1. Client
    const { data: client } = await supabase
      .from('clientes')
      .select('*, barbers:favorite_barber_id(id, name, rating, photo_url, salons(name, is_open)), salons:favorite_salon_id(id, name, address, city)')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (client) {
      setClientData(client);
      if (client.hair_type) setCapilType(client.hair_type);
      if (client.face_shape) setFaceShape(client.face_shape);
      if (client.preferences) setPrefs(client.preferences);
      if (client.reminder_on !== null) setRappelOn(client.reminder_on);
      if (client.reminder_days) setRappelDays(client.reminder_days);
      if (client.barbers) setFavoriteBarber(client.barbers);
      if (client.salons) setFavoriteSalon(client.salons);
    }

    // ← DÉCLARÉS ICI, accessibles partout dans loadAll
    let hist = null;
    let rev = null;
    let followed = null;
    let likes = 0;

    if (client?.id) {
      // 2. File d'attente du Coiffeuse favori
      if (client.favorite_barber_id) {
        const { data: queueData } = await supabase
          .from('queue')
          .select('id, estimated_wait')
          .eq('barber_id', client.favorite_barber_id)
          .eq('status', 'active');
        const count = queueData?.length || 0;
        setFavoriteBarber(prev => prev ? { ...prev, queueCount: count, estimatedWait: count * 4 } : null);
      }

      // 3. coiffeuses suivis
      const { data: followedData } = await supabase
        .from('followed_barbers')
        .select('*, coiffeuses(id, name, rating, photo_url, salons(name))')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      followed = followedData; // ← assigné à la variable externe
      if (followed) setFollowedBarbers(followed.map(f => f.coiffeuses).filter(Boolean));

      // 3b. Clients suivis
      const { data: followClientsData } = await supabase
        .from('followed_clients')
        .select('clients:followed_id(id, name, avatar_url, fresh_score)')
        .eq('follower_id', client.id);
      setFollowedClients(followClientsData?.map(f => f.clients).filter(Boolean) || []);

      // 3c. Coupes likées (deux étapes pour fiabilité)
      const { data: likedIds } = await supabase
        .from('coupe_likes')
        .select('coupe_id')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(9);
      if (likedIds?.length) {
        const { data: likedCoupesData } = await supabase
          .from('coupes')
          .select('id, photo_url, service, likes')
          .in('id', likedIds.map(l => l.coupe_id));
        setLikedCoupes(likedCoupesData || []);
      } else {
        setLikedCoupes([]);
      }

      // 3d. Inspirations (deux étapes)
      const { data: inspirIds } = await supabase
        .from('coupe_inspirations')
        .select('coupe_id')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(9);
      if (inspirIds?.length) {
        const { data: inspirCoupesData } = await supabase
          .from('coupes')
          .select('id, photo_url, service, likes')
          .in('id', inspirIds.map(i => i.coupe_id));
        setInspirationCoupes(inspirCoupesData || []);
      } else {
        setInspirationCoupes([]);
      }

      // 4. Avis
      const { data: revData } = await supabase
        .from('reviews')
        .select('*, coiffeuses(name, salons(name))')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(2);
      rev = revData; // ← assigné à la variable externe
      if (rev) setReviews(rev);

      // 5. Historique des coupes
      const { data: histData } = await supabase
        .from('queue')
        .select('*, coiffeuses(name, salons(name))')
        .eq('client_id', client.id)
        .eq('status', 'done')
        .order('updated_at', { ascending: false })
        .limit(3);
      hist = histData; // ← assigné à la variable externe
      if (hist) setQueueHistory(hist);

      // 6. Total likes reçus
      const { data: coupesData } = await supabase
        .from('coupes')
        .select('likes')
        .eq('client_id', client.id);
      likes = coupesData?.reduce((sum, c) => sum + (c.likes || 0), 0) || 0; // ← assigné
      setTotalLikes(likes);

      // 7. Coupe de référence
      if (client?.reference_cut) {
        const { data: refCut } = await supabase
          .from('coupes')
          .select('*, coiffeuses(name, salons(name))')
          .eq('id', client.reference_cut)
          .maybeSingle();
        if (refCut) setReferenceCut(refCut);
      }

      // 8. Toutes les coupes du client
const { data: coupes } = await supabase
  .from('coupes')
  .select('id, photo_url, service, likes, views, is_private')
  .eq('client_id', client.id)
  .order('created_at', { ascending: false });

if (coupes) {
  const coupesWithCache = coupes.map(c => ({
    ...c,
    photo_url: c.photo_url ? `${c.photo_url.split('?')[0]}?t=${Date.now()}` : null
  }));
  setAllCoupes(coupesWithCache);
}

      // 9. Mes rendez-vous (à venir + récents)
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, scheduled_at, time, service, status, client_name, duration, notes, coiffeuse_id, coiffeuses(name, salons(name))')
        .eq('cliente_id', client.id)
        .order('scheduled_at', { ascending: false })
        .limit(20);
      setMyAppointments(appts || []);
}

    // Moyenne plateforme
    const { data: avgData } = await supabase
      .from('queue')
      .select('client_id')
      .eq('status', 'done');

    const clientCounts = {};
    avgData?.forEach(q => {
      clientCounts[q.client_id] = (clientCounts[q.client_id] || 0) + 1;
    });
    const values = Object.values(clientCounts);
    const platformAvg = values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 1;

    // CALCUL FRESHSCORE — hist, rev, followed, likes sont maintenant accessibles
    const score = calculateFreshScore({
      lastCutDate: hist?.[0]?.updated_at || null,
      totalCuts: hist?.length || 0,
      reviewsLeft: rev?.length || 0,
      photosShared: 0,
      hasReference: !!client?.reference_cut,
      presenceRate: 1,
      cancellations: 0,
      decalagesUsed: 0,
      followedBarbers: followed?.length || 0,
      likesGiven: 0,
      likesReceived: likes,
      timesUsedAsRef: 0,
      platformAvgCuts: platformAvg,
    });
    setFreshScore(score);
    await supabase
  .from('clientes')
  .update({ fresh_score: score })
  .eq('id', client.id);

  } catch (e) {
    console.log('Erreur profil:', e.message);
  } finally {
    setLoading(false);
  }
}

async function deletePhoto(coupe) {
  const { data: deleted, error: dbError } = await supabase
    .from('coupes')
    .delete()
    .eq('id', coupe.id)
    .select();

  if (dbError || !deleted?.length) { Alert.alert('Erreur', 'Impossible de supprimer la photo.'); return; }

  const fileName = coupe.photo_url?.split('/photos-coupes/')?.[1]?.split('?')?.[0];
  if (fileName) supabase.storage.from('photos-coupes').remove([fileName]);

  setAllCoupes(prev => prev.filter(c => c.id !== coupe.id));
  if (referenceCut?.id === coupe.id) setReferenceCut(null);
}

  async function saveProfile() {
    if (!clientData) return;
    await supabase
      .from('clientes')
      .update({
        hair_type: capilType,
        face_shape: faceShape,
        preferences: prefs,
        reminder_on: rappelOn,
      })
      .eq('id', clientData.id);
  }

  async function toggleRappel() {
    const newVal = !rappelOn;
    setRappelOn(newVal);
    if (clientData) {
      await supabase
        .from('clientes')
        .update({ reminder_on: newVal })
        .eq('id', clientData.id);
    }
  }

  async function selectReferenceCut(coupe) {
  setReferenceCut(coupe);
  setShowRefModal(false);
  await supabase
    .from('clientes')
    .update({ reference_cut: coupe.id })
    .eq('id', clientData.id);
}

  function togglePref(p) {
    const newPrefs = prefs.includes(p) ? prefs.filter(x => x !== p) : [...prefs, p];
    setPrefs(newPrefs);
    if (clientData) {
      supabase.from('clientes').update({ preferences: newPrefs }).eq('id', clientData.id);
    }
  }

  //update avatar//
  async function updateAvatar() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { alert('Permission galerie requise'); return; }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled) return;

  const asset = result.assets[0];
  const fileName = `${clientData.id}_avatar.jpeg`;
  const byteArray = Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, byteArray, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) { alert('Erreur upload : ' + uploadError.message); return; }

  const { data: urlData } = supabase.storage
  .from('avatars')
  .getPublicUrl(fileName);

const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

await supabase
  .from('clientes')
  .update({ avatar_url: avatarUrl })
  .eq('id', clientData.id);

setClientData(prev => ({ ...prev, avatar_url: avatarUrl }));
}

  // import d'images //
  async function addPhotoToBook(isPrivate = false) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    alert('Permission galerie requise');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled) return;

  const asset = result.assets[0];
  const fileName = `${clientData.id}_${Date.now()}.jpeg`;
  const byteArray = Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0));

  const { error: uploadError } = await supabase.storage
    .from('photos-coupes')
    .upload(fileName, byteArray, { contentType: 'image/jpeg' });

  if (uploadError) {
    alert('Erreur upload : ' + uploadError.message);
    return;
  }

  const { data: urlData } = supabase.storage
    .from('photos-coupes') 
    .getPublicUrl(fileName);
    console.log('URL publique:', urlData?.publicUrl); 
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  // Insert dans la table coupes
  const { data: newCoupe, error: insertError } = await supabase
    .from('coupes')
    .insert({
      client_id: clientData.id,
      photo_url: publicUrl,
      is_private: isPrivate,
      likes: 0,
    })
    .select()
    .single();

    console.log('insertError:', insertError);
    console.log('newCoupe:', newCoupe);

  if (newCoupe) {
  setAllCoupes(prev => [{ ...newCoupe, photo_url: publicUrl }, ...prev]);
}
}

  // Stats
  const totalCoupes = queueHistory.length;
  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)
    : '—';

  const initials = clientData?.name
    ?.split(' ').map(n => n[0]).join('').toUpperCase() || 'MK';
    console.log('allCoupes URLs:', allCoupes.map(c => c.photo_url));

    if (!session) return (
  <SafeAreaView style={styles.safe}>
    <View style={styles.wallpaper}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />
    </View>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>✂</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 8, textAlign: 'center' }}>
        Mon profil FreshGirlz
      </Text>
      <Text style={{ fontSize: 14, color: 'rgba(28,28,30,0.5)', textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
        Connecte-toi pour accéder à ton book, ton FreshScore et tes coiffeuses favoris.
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Auth')}
        style={{ backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Se connecter</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Auth')}
        style={{ marginTop: 12, padding: 14, width: '100%', alignItems: 'center' }}>
        <Text style={{ color: '#A8852A', fontSize: 14, fontWeight: '600' }}>Créer un compte →</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wallpaper} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView 
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ paddingBottom: 100 }}
  delayLongPress={300}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mon profil</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowMenu(prev => !prev)}>
              <Image source={require('./assets/parametres.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
            </TouchableOpacity>

          </View>
        </View>

        {/* HERO */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={updateAvatar} style={styles.avWrap}>
  <BlurView intensity={60} tint="light" style={styles.av}>
    {clientData?.avatar_url ? (
      <Image
        source={{ uri: clientData.avatar_url }}
        style={{ width: 66, height: 66, borderRadius: 18 }}
        resizeMode="cover"
      />
    ) : (
      <Text style={styles.avText}>{initials}</Text>
    )}
  </BlurView>
  <View style={styles.avEdit}>
    <Text style={styles.avEditText}>✎</Text>
  </View>
</TouchableOpacity>
          <View style={{ flex: 1 }}>
  <View style={styles.nameRow}>
    <Text style={styles.name}>{clientData?.name || 'Mon profil'}</Text>
    <Text style={styles.editIcon}>✎</Text>
  </View>
  <Text style={styles.sub}>
    Membre depuis {clientData?.created_at
      ? new Date(clientData.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      : '—'}
  </Text>
  <Text style={styles.sub}>
    Dernière coupe · {queueHistory[0]?.updated_at
      ? new Date(queueHistory[0].updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'aucune'}
  </Text>
  {/* Profil capillaire — désactivé V1, réactiver en V2 */}
  {false && (
  <View style={styles.tags}>
    <View style={styles.tag}><Text style={styles.tagText}>{capilType}</Text></View>
    <View style={styles.tag}><Text style={styles.tagText}>{faceShape}</Text></View>
    {prefs.slice(0,1).map(p => (
      <View key={p} style={styles.tag}><Text style={styles.tagText}>{p}</Text></View>
    ))}
  </View>
  )}
</View>
        </View>

        {/* FRESHSCORE — désactivé V1, réactiver en V2 */}
        {false && (
        <BlurView intensity={55} tint="light" style={styles.scoreBar}>
          <FreshScoreRing score={freshScore} color={getFreshLevel(freshScore).color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>FreshScore {getFreshLevel(freshScore).emoji}</Text>
            <Text style={styles.scoreSub}>{getFreshLevel(freshScore).label}</Text>
            <Text style={styles.scoreHint}>Comment améliorer mon score ? →</Text>
          </View>
        </BlurView>
        )}

        {/* STATS */}
        <BlurView intensity={55} tint="light" style={styles.statsRow}>
          {[
            { num: String(totalCoupes), lbl: 'Coupes', color: '#A8852A' },
{ num: String(avgRating), lbl: 'Note moy.', color: '#1C1C1E' },
           { num: String(totalLikes), lbl: '♥ Reçus', color: '#C0392B' },
          ].map((s, i) => (
            <View key={s.lbl} style={[styles.stat, i < 2 && styles.statBorder]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </BlurView>

        {/* TABS */}
        <BlurView intensity={40} tint="light" style={styles.tabs}>
          {['Profil','Historique','Book'].map((t) => (
            <TouchableOpacity key={t} style={styles.tab} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
              {activeTab === t && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* ── ONGLET PROFIL ── */}
        {activeTab === 'Profil' && (
          <View>
            {/* COUPE DE RÉFÉRENCE */}
<View style={styles.secRow}>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Image source={require('./assets/prefer.png')} style={{ width: 22, height: 22, resizeMode: 'contain' }} />
    <Text style={styles.secTitle}>Coupe de référence</Text>
  </View>
</View>
<BlurView intensity={60} tint="light" style={styles.refBigCard}>
  <View style={styles.refPhotoWrap}>
    {referenceCut?.photo_url ? (
      <Image
        source={{ uri: referenceCut.photo_url }}
        style={{ width: '100%', height: 240 }}
        resizeMode="cover"
      />
    ) : (
      <View style={[styles.refPhotoBg, { backgroundColor: '#3A1A06', height: 240 }]}>
        <Text style={styles.refPhotoEmoji}>✂</Text>
      </View>
    )}
    <View style={styles.refRankBadge}>
      <Text style={styles.refRankText}>★</Text>
    </View>
    <TouchableOpacity style={styles.refChangeBig} onPress={() => setShowRefModal(true)}>
      <Text style={styles.refChangeBigText}>Changer</Text>
    </TouchableOpacity>
  </View>

  {referenceCut ? (
    <View style={[styles.refBigBody, { flexDirection: 'row', justifyContent: 'center', gap: 20 }]}>
      <Text style={styles.refBigStatInline}>♥ {referenceCut.likes || 0} likes</Text>
      <Text style={styles.refBigStatInline}>🔖 {referenceCut.saves || 0} inspirations</Text>
    </View>
  ) : (
    <View style={styles.refBigBody}>
      <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 8 }}>
        Aucune coupe de référence — choisis ta meilleure coupe 🔖
      </Text>
    </View>
  )}
</BlurView>

            {/* Coiffeuse & SALON FAVORI */}
<View style={styles.secRow}>
  <Text style={styles.secTitle}>✂ Mon Coiffeuse</Text>
</View>
{favoriteBarber ? (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={() => navigation.navigate('BarberProfile', { barber: favoriteBarber })}>
    <BlurView intensity={60} tint="light" style={styles.card}>
      <View style={styles.row}>
        {favoriteBarber.photo_url ? (
          <Image source={{ uri: favoriteBarber.photo_url }} style={styles.barberThumb} />
        ) : (
          <View style={[styles.barberThumb, { backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 18, color: '#854F0B' }}>{favoriteBarber.name?.[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{favoriteBarber.name}</Text>
          <Text style={styles.itemSub}>{favoriteBarber.salons?.name}</Text>
          <View style={styles.row}>
            <Text style={{ fontSize: 11, color: '#A8852A' }}>{'★'.repeat(Math.round(favoriteBarber.rating || 0))}</Text>
            <Text style={{ fontSize: 11, color: 'rgba(28,28,30,0.5)' }}> {favoriteBarber.rating}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
  <View style={[styles.openBadge, !favoriteBarber.salons?.is_open && { backgroundColor: 'rgba(192,57,43,0.12)', borderColor: 'rgba(192,57,43,0.28)' }]}>
    <Text style={[styles.openBadgeText, !favoriteBarber.salons?.is_open && { color: '#C0392B' }]}>
      {favoriteBarber.salons?.is_open ? '● Ouvert' : '● Fermé'}
    </Text>
  </View>
  <Text style={{ fontSize: 10, color: 'rgba(28,28,30,0.45)' }}>
    {favoriteBarber?.queueCount || 0} en attente ~{favoriteBarber?.estimatedWait || 0} min
  </Text>
</View>
      </View>
    </BlurView>
  </TouchableOpacity>
) : (
  <BlurView intensity={55} tint="light" style={styles.card}>
    <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 8 }}>
      Aucun Coiffeuse favori
    </Text>
  </BlurView>
)}

        {/* coiffeuses Suivis — désactivé V1, réactiver en V2 */}
        {false && (<>
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>👥 coiffeuses suivis</Text>
          <Text style={styles.secLink}>Voir tout</Text>
        </View>
        {followedBarbers.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {followedBarbers.map((b) => (
              <TouchableOpacity key={b.id} activeOpacity={0.9}
                style={styles.featCard}
                onPress={() => navigation.navigate('BarberProfile', { barber: b })}>
                <View style={[styles.featPhoto, { backgroundColor: b.bg || '#331a00' }]}>
                  {b.photo_url ? (
                    <Image source={{ uri: b.photo_url.trim() }} style={styles.featPhotoImg} />
                  ) : (
                    <View style={styles.featAv}>
                      <Text style={styles.featAvText}>{b.name?.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.featBadge}>
                    <Text style={styles.featBadgeText}>⭐ Suivi</Text>
                  </View>
                  <Text style={styles.featName}>{b.name}</Text>
                </View>
                <View style={styles.featBody}>
                  <Text style={styles.featSalon} numberOfLines={1}>{b.salons?.name || 'Salon'}</Text>
                  <Text style={styles.featNote}>★ {b.rating || '4.9'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <BlurView intensity={55} tint="light" style={styles.card}>
            <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 8 }}>
              Aucun Coiffeuse suivi — explore et suis tes coiffeuses préférés
            </Text>
          </BlurView>
        )}
        </>)}

            {/* MES RENDEZ-VOUS */}
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>📅 Mes rendez-vous</Text>
              {myAppointments.length > 0 && (
                <Text style={styles.secLink}>{myAppointments.length}</Text>
              )}
            </View>
            {myAppointments.length === 0 ? (
              <BlurView intensity={50} tint="light" style={[styles.card, { alignItems: 'center', paddingVertical: 20 }]}>
                <Text style={{ fontSize: 22, marginBottom: 8 }}>📅</Text>
                <Text style={[styles.itemTitle, { marginBottom: 4 }]}>Aucun rendez-vous</Text>
                <Text style={styles.itemSub}>Prends RDV depuis le profil d'une coiffeuse</Text>
              </BlurView>
            ) : (
              myAppointments.map(a => {
                const isPast = a.scheduled_at && new Date(a.scheduled_at) < new Date();
                const isCancelled = a.status === 'cancelled' || a.status === 'no_show';
                const statusMap = {
                  pending:   { label: 'En attente', color: '#B06A00', bg: 'rgba(176,106,0,0.1)' },
                  confirmed: { label: 'Confirmé',   color: '#7C3D8F', bg: 'rgba(124,61,143,0.1)' },
                  done:      { label: 'Terminé',    color: 'rgba(28,28,30,0.4)', bg: 'rgba(28,28,30,0.06)' },
                  cancelled: { label: 'Annulé',     color: '#C0392B', bg: 'rgba(192,57,43,0.1)' },
                  no_show:   { label: 'Absent',     color: '#C0392B', bg: 'rgba(192,57,43,0.1)' },
                };
                const st = statusMap[a.status] || statusMap.pending;
                const dateLabel = a.scheduled_at
                  ? new Date(a.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                  : '—';
                const timeLabel = a.time?.slice(0, 5) || (a.scheduled_at
                  ? new Date(a.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  : '—');
                return (
                  <BlurView key={a.id} intensity={55} tint="light" style={[styles.card, { marginBottom: 8, opacity: isCancelled ? 0.6 : 1 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <View>
                        <Text style={[styles.itemTitle, { marginBottom: 2 }]}>
                          {dateLabel} · {timeLabel}
                        </Text>
                        <Text style={styles.itemSub}>
                          {a.coiffeuses?.name || 'Coiffeuse'}{a.coiffeuses?.salons?.name ? ` · ${a.coiffeuses.salons.name}` : ''}
                        </Text>
                      </View>
                      <View style={[{ borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 }, { backgroundColor: st.bg }]}>
                        <Text style={[{ fontSize: 11, fontWeight: '600' }, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    {a.service ? (
                      <View style={[styles.infoRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                        <Text style={styles.infoL}>Prestation</Text>
                        <Text style={styles.infoV}>{a.service}</Text>
                      </View>
                    ) : null}
                    {(a.status === 'pending' || a.status === 'confirmed') && !isPast && (
                      <TouchableOpacity
                        style={{ marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: 'rgba(192,57,43,0.08)', borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' }}
                        onPress={() => {
                          Alert.alert(
                            'Annuler ce rendez-vous ?',
                            'Tu ne pourras pas revenir en arrière. La coiffeuse sera notifiée.',
                            [
                              { text: 'Garder', style: 'cancel' },
                              {
                                text: 'Annuler le RDV', style: 'destructive',
                                onPress: async () => {
                                  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', a.id);
                                  setMyAppointments(prev => prev.map(p => p.id === a.id ? { ...p, status: 'cancelled' } : p));
                                  // Notifie la coiffeuse
                                  if (a.coiffeuse_id) {
                                    const { data: coifRow } = await supabase
                                      .from('coiffeuses').select('user_id, name').eq('id', a.coiffeuse_id).maybeSingle();
                                    if (coifRow?.user_id) {
                                      const dateLabel = a.scheduled_at
                                        ? new Date(a.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                                        : '—';
                                      supabase.from('notifications').insert({
                                        recipient_user_id: coifRow.user_id,
                                        type:  'appointment_cancelled_by_client',
                                        title: 'RDV annulé par la cliente ❌',
                                        body:  `Le RDV du ${dateLabel} a été annulé par la cliente.`,
                                        data:  JSON.stringify({ screen: 'Agenda' }),
                                        read:  false,
                                      });
                                    }
                                  }
                                },
                              },
                            ]
                          );
                        }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#C0392B' }}>Annuler ce RDV</Text>
                      </TouchableOpacity>
                    )}
                  </BlurView>
                );
              })
            )}

            {/* RAPPELS */}
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>🔔 Rappels</Text>
            </View>
            <BlurView intensity={55} tint="light" style={styles.card}>
              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
                <View>
                  <Text style={styles.itemTitle}>Rappel automatique</Text>
                  <Text style={styles.itemSub}>Tous les {rappelDays} jours</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, rappelOn && styles.toggleOn]}
                  onPress={() => setRappelOn(!rappelOn)}>
                  <View style={[styles.toggleThumb, rappelOn && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoL}>Fréquence</Text>
                <TouchableOpacity onPress={() => {
                  Alert.alert(
                    "Fréquence du rappel",
                    "Choisir l'intervalle entre chaque rappel",
                    [
                      { text: "7 jours",  onPress: async () => { setRappelDays(7);  if (clientData) await supabase.from('clientes').update({ reminder_days: 7 }).eq('id', clientData.id); } },
                      { text: "14 jours", onPress: async () => { setRappelDays(14); if (clientData) await supabase.from('clientes').update({ reminder_days: 14 }).eq('id', clientData.id); } },
                      { text: "21 jours", onPress: async () => { setRappelDays(21); if (clientData) await supabase.from('clientes').update({ reminder_days: 21 }).eq('id', clientData.id); } },
                      { text: "28 jours", onPress: async () => { setRappelDays(28); if (clientData) await supabase.from('clientes').update({ reminder_days: 28 }).eq('id', clientData.id); } },
                      { text: "35 jours", onPress: async () => { setRappelDays(35); if (clientData) await supabase.from('clientes').update({ reminder_days: 35 }).eq('id', clientData.id); } },
                      { text: "Annuler", style: "cancel" },
                    ]
                  );
                }}>
                  <Text style={[styles.infoV, { color: '#0071E3' }]}>{rappelDays} jours →</Text>
                </TouchableOpacity>
              </View>
            </BlurView>

            {/* COUPES LIKÉES */}
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>♥ Coupes likées</Text>
              {likedCoupes.length > 0 && <Text style={styles.secLink}>{likedCoupes.length}</Text>}
            </View>
            {likedCoupes.length > 0 ? (
              <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {likedCoupes.map((c) => (
                  <View key={c.id} style={{ width: (width - 44) / 3, height: (width - 44) / 3, borderRadius: 13, overflow: 'hidden', backgroundColor: '#3A1A06', position: 'relative' }}>
                    {c.photo_url ? (
                      <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20, opacity: 0.15 }}>✂</Text>
                      </View>
                    )}
                    <View style={styles.bookLikes}><Text style={styles.bookLikesText}>♥ {c.likes || 0}</Text></View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ paddingHorizontal: 16, paddingBottom: 8, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>
                Aucune coupe likée pour l'instant
              </Text>
            )}

            {/* INSPIRATIONS */}
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>🔖 Mes inspirations</Text>
              {inspirationCoupes.length > 0 && <Text style={styles.secLink}>{inspirationCoupes.length}</Text>}
            </View>
            {inspirationCoupes.length > 0 ? (
              <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {inspirationCoupes.map((c) => (
                  <View key={c.id} style={{ width: (width - 44) / 3, height: (width - 44) / 3, borderRadius: 13, overflow: 'hidden', backgroundColor: '#0A1A0A', position: 'relative' }}>
                    {c.photo_url ? (
                      <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20, opacity: 0.15 }}>✂</Text>
                      </View>
                    )}
                    <View style={styles.bookLikes}><Text style={styles.bookLikesText}>🔖</Text></View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ paddingHorizontal: 16, paddingBottom: 8, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>
                Aucune inspiration enregistrée
              </Text>
            )}

            {/* MES AMIS */}
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>👥 Mes amis</Text>
              {followedClients.length > 0 && <Text style={styles.secLink}>{followedClients.length}</Text>}
            </View>
            {followedClients.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
                {followedClients.map((c) => c && (
                  <TouchableOpacity key={c.id} activeOpacity={0.85}
                    onPress={() => navigation.navigate('PublicProfile', { client: c })}>
                    <BlurView intensity={55} tint="light" style={styles.followClientChip}>
                      {c.avatar_url ? (
                        <Image source={{ uri: c.avatar_url }} style={styles.followClientPhoto} />
                      ) : (
                        <View style={[styles.followClientPhoto, { backgroundColor: '#3A1A06', alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 16, fontWeight: '800', color: '#A8852A' }}>
                            {c.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.followClientName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.followClientScore}>FS {c.fresh_score || 0}</Text>
                    </BlurView>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={{ paddingHorizontal: 16, paddingBottom: 8, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>
                Tu ne suis encore personne
              </Text>
            )}
          </View>
        )}

        {/* ── ONGLET HISTORIQUE ── */}
        {activeTab === 'Historique' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>✂ 3 dernières coupes</Text>
            </View>
            <View style={styles.histGrid}>
              {queueHistory.length > 0 ? queueHistory.map((h, i) => (
  <View key={h.id} style={[styles.histCell, { backgroundColor: ['#3A1A06','#0A1A0A','#0A0A1A'][i] }]}>
    <Text style={styles.histEmoji}>✂</Text>
    <View style={styles.histLabel}>
      <Text style={styles.histLabelText}>{h.service}</Text>
    </View>
  </View>
)) : (
  <Text style={{ padding: 16, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>Aucune coupe pour l'instant</Text>
)}
            </View>

            <View style={styles.secRow}>
              <Text style={styles.secTitle}>⭐ Mes avis</Text>
              <Text style={styles.secLink}>Voir tout</Text>
            </View>
            {reviews.length > 0 ? reviews.map((a) => (
  <BlurView key={a.id} intensity={55} tint="light" style={styles.avisCard}>
    <View style={[styles.row, { marginBottom: 6 }]}>
      <View style={[styles.thumb, { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.12)' }]}>
        <Text style={{ fontSize: 14, color: '#854F0B' }}>{a.barbers?.name?.[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{a.barbers?.name} · {a.barbers?.salons?.name}</Text>
        <Text style={{ fontSize: 12, color: '#A8852A' }}>{'★'.repeat(a.rating)}{'☆'.repeat(5-a.rating)}</Text>
      </View>
    </View>
    <Text style={styles.avisText}>"{a.comment}"</Text>
    <Text style={styles.avisMeta}>{new Date(a.created_at).toLocaleDateString('fr-FR')}</Text>
  </BlurView>
)) : (
  <Text style={{ padding: 16, color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>Aucun avis laissé</Text>
)}

          </View>
        )}

        {/* ── ONGLET BOOK ── */}
        {activeTab === 'Book' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>📸 Mon book</Text>
              <Text style={styles.secSub}>24 photos</Text>
            </View>
            <View style={styles.bookTabsRow}>
              {['public','private'].map((t) => (
                <TouchableOpacity key={t}
                  style={[styles.bookTabBtn, bookTab === t && styles.bookTabBtnActive]}
                  onPress={() => setBookTab(t)}>
                  <Text style={[styles.bookTabText, bookTab === t && styles.bookTabTextActive]}>
                    {t === 'public' ? 'Publiques' : 'Privées'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

         {bookTab === 'public' && (() => {
  const publicCoupes = allCoupes.filter(c => !c.is_private);
  function renderDeleteBtn(c) {
    if (!editMode) return null;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (Platform.OS === 'web') {
            if (window.confirm('Supprimer cette photo ?')) deletePhoto(c);
          } else {
            Alert.alert('Supprimer', 'Supprimer cette photo ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => deletePhoto(c) }
            ]);
          }
        }}
        style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {editMode && (
        <TouchableOpacity
          onPress={() => setEditMode(false)}
          style={{ alignSelf: 'flex-end', marginBottom: 8, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Terminer</Text>
        </TouchableOpacity>
      )}
      <View style={{ gap: 6 }}>
        {/* Photo hero */}
        {publicCoupes[0] && (() => {
          const c = publicCoupes[0];
          return (
            <View key={c.id} style={{ position: 'relative' }}>
              <TouchableOpacity activeOpacity={0.85}
                onPress={() => { if (!editMode) { setViewerPhotos(publicCoupes); setViewerIndex(publicCoupes.findIndex(x => x.id === c.id)); } }}
                onLongPress={() => setEditMode(true)}
                delayLongPress={400}
                style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#3A1A06' }}>
                <ExpoImage source={c.photo_url} style={{ width: '100%', height: 220 }} contentFit="cover" cachePolicy="none" />
                {referenceCut?.id === c.id && (
                  <View style={styles.bookRef}><Text style={styles.bookRefText}>🔖</Text></View>
                )}
                <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>🔥 Top</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
                    <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>👁 {c.views || 0}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              {renderDeleteBtn(c)}
            </View>
          );
        })()}

        {/* Photos 2-3 : deux colonnes */}
        {publicCoupes.slice(1, 3).length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {publicCoupes.slice(1, 3).map((c) => {
              const cellW = (width - 32 - 6) / 2;
              return (
                <View key={c.id} style={{ position: 'relative' }}>
                  <TouchableOpacity activeOpacity={0.85}
                    onPress={() => { if (!editMode) { setViewerPhotos(publicCoupes); setViewerIndex(publicCoupes.findIndex(x => x.id === c.id)); } }}
                    onLongPress={() => setEditMode(true)}
                    delayLongPress={400}
                    style={{ width: cellW, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                    <ExpoImage source={c.photo_url} style={{ width: cellW, height: 150 }} contentFit="cover" cachePolicy="none" />
                    {referenceCut?.id === c.id && (
                      <View style={styles.bookRef}><Text style={styles.bookRefText}>🔖</Text></View>
                    )}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                      <View style={{ flexDirection: 'row', gap: 5 }}>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>👁 {c.views || 0}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {renderDeleteBtn(c)}
                </View>
              );
            })}
          </View>
        )}

        {/* Photos 4+ : trois colonnes + bouton Ajouter */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {publicCoupes.slice(3).map((c) => {
            const cellW = (width - 32 - 12) / 3;
            return (
              <View key={c.id} style={{ position: 'relative' }}>
                <TouchableOpacity activeOpacity={0.85}
                  onPress={() => { if (!editMode) { setViewerPhotos(publicCoupes); setViewerIndex(publicCoupes.findIndex(x => x.id === c.id)); } }}
                  onLongPress={() => setEditMode(true)}
                  delayLongPress={400}
                  style={{ width: cellW, height: cellW, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                  <ExpoImage source={c.photo_url} style={{ width: cellW, height: cellW }} contentFit="cover" cachePolicy="none" />
                  {referenceCut?.id === c.id && (
                    <View style={styles.bookRef}><Text style={styles.bookRefText}>🔖</Text></View>
                  )}
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 8, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
                      <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>👁 {c.views || 0}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {renderDeleteBtn(c)}
              </View>
            );
          })}
          {/* Bouton Ajouter dans la grille 3 colonnes */}
          {publicCoupes.length < 3 ? null : (
            <TouchableOpacity
              style={[styles.bookAddCell, { width: (width - 32 - 12) / 3, height: (width - 32 - 12) / 3 }]}
              onPress={() => addPhotoToBook(false)}>
              <Text style={styles.bookAddIcon}>+</Text>
              <Text style={styles.bookAddText}>Ajouter</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bouton Ajouter si moins de 3 photos (dans la 2-col ou seul) */}
        {publicCoupes.length < 3 && (
          publicCoupes.length === 0 ? (
            <TouchableOpacity
              style={[styles.bookAddCell, { width: '100%', height: 100 }]}
              onPress={() => addPhotoToBook(false)}>
              <Text style={styles.bookAddIcon}>+</Text>
              <Text style={styles.bookAddText}>Ajouter une photo</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {publicCoupes.length === 1 && (
                <TouchableOpacity
                  style={[styles.bookAddCell, { width: (width - 32 - 6) / 2, height: 150 }]}
                  onPress={() => addPhotoToBook(false)}>
                  <Text style={styles.bookAddIcon}>+</Text>
                  <Text style={styles.bookAddText}>Ajouter</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      </View>
    </View>
  );
})()}

{bookTab === 'private' && (() => {
  const privateCoupes = allCoupes.filter(c => c.is_private);
  function renderDeleteBtnPriv(c) {
    if (!editMode) return null;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (Platform.OS === 'web') {
            if (window.confirm('Supprimer cette photo ?')) deletePhoto(c);
          } else {
            Alert.alert('Supprimer', 'Supprimer cette photo ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Supprimer', style: 'destructive', onPress: () => deletePhoto(c) }
            ]);
          }
        }}
        style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
    );
  }
  return (
    <>
      <Text style={styles.privateSub}>Visible seulement par toi</Text>
      <View style={{ paddingHorizontal: 16 }}>
        {editMode && (
          <TouchableOpacity
            onPress={() => setEditMode(false)}
            style={{ alignSelf: 'flex-end', marginBottom: 8, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Terminer</Text>
          </TouchableOpacity>
        )}
        <View style={{ gap: 6 }}>
          {/* Photo hero */}
          {privateCoupes[0] && (() => {
            const c = privateCoupes[0];
            return (
              <View key={c.id} style={{ position: 'relative' }}>
                <TouchableOpacity activeOpacity={0.85}
                  onPress={() => { if (!editMode) { setViewerPhotos(privateCoupes); setViewerIndex(privateCoupes.findIndex(x => x.id === c.id)); } }}
                  onLongPress={() => setEditMode(true)}
                  delayLongPress={400}
                  style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1A0814' }}>
                  <ExpoImage source={c.photo_url} style={{ width: '100%', height: 220 }} contentFit="cover" cachePolicy="none" />
                  <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>🔒 Privé</Text>
                  </View>
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                  </View>
                </TouchableOpacity>
                {renderDeleteBtnPriv(c)}
              </View>
            );
          })()}

          {/* Photos 2-3 : deux colonnes */}
          {privateCoupes.slice(1, 3).length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {privateCoupes.slice(1, 3).map((c) => {
                const cellW = (width - 32 - 6) / 2;
                return (
                  <View key={c.id} style={{ position: 'relative' }}>
                    <TouchableOpacity activeOpacity={0.85}
                      onPress={() => { if (!editMode) { setViewerPhotos(privateCoupes); setViewerIndex(privateCoupes.findIndex(x => x.id === c.id)); } }}
                      onLongPress={() => setEditMode(true)}
                      delayLongPress={400}
                      style={{ width: cellW, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A0814' }}>
                      <ExpoImage source={c.photo_url} style={{ width: cellW, height: 150 }} contentFit="cover" cachePolicy="none" />
                      <View style={styles.lockBadge}><Text style={styles.lockText}>🔒</Text></View>
                    </TouchableOpacity>
                    {renderDeleteBtnPriv(c)}
                  </View>
                );
              })}
            </View>
          )}

          {/* Photos 4+ : trois colonnes + bouton Ajouter */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {privateCoupes.slice(3).map((c) => {
              const cellW = (width - 32 - 12) / 3;
              return (
                <View key={c.id} style={{ position: 'relative' }}>
                  <TouchableOpacity activeOpacity={0.85}
                    onPress={() => { if (!editMode) { setViewerPhotos(privateCoupes); setViewerIndex(privateCoupes.findIndex(x => x.id === c.id)); } }}
                    onLongPress={() => setEditMode(true)}
                    delayLongPress={400}
                    style={{ width: cellW, height: cellW, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A0814' }}>
                    <ExpoImage source={c.photo_url} style={{ width: cellW, height: cellW }} contentFit="cover" cachePolicy="none" />
                    <View style={styles.lockBadge}><Text style={styles.lockText}>🔒</Text></View>
                  </TouchableOpacity>
                  {renderDeleteBtnPriv(c)}
                </View>
              );
            })}
            {privateCoupes.length >= 3 && (
              <TouchableOpacity
                style={[styles.bookAddCell, { width: (width - 32 - 12) / 3, height: (width - 32 - 12) / 3 }]}
                onPress={() => addPhotoToBook(true)}>
                <Text style={styles.bookAddIcon}>+</Text>
                <Text style={styles.bookAddText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>

          {privateCoupes.length < 3 && (
            privateCoupes.length === 0 ? (
              <TouchableOpacity
                style={[styles.bookAddCell, { width: '100%', height: 100 }]}
                onPress={() => addPhotoToBook(true)}>
                <Text style={styles.bookAddIcon}>+</Text>
                <Text style={styles.bookAddText}>Ajouter une photo privée</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {privateCoupes.length === 1 && (
                  <TouchableOpacity
                    style={[styles.bookAddCell, { width: (width - 32 - 6) / 2, height: 150 }]}
                    onPress={() => addPhotoToBook(true)}>
                    <Text style={styles.bookAddIcon}>+</Text>
                    <Text style={styles.bookAddText}>Ajouter</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          )}
        </View>
      </View>
    </>
  );
})()}
          </View>
        )}

       

      </ScrollView>
      {/* Menu déconnexion — Modal pour éviter tout problème de clipping */}
      <Modal
        transparent
        animationType="fade"
        visible={showMenu}
        onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        />
        <View style={styles.menuPopoverWrapper} pointerEvents="box-none">
          <BlurView intensity={80} tint="light" style={styles.menuPopover}>
            {session?.user?.email && (
              <Text style={styles.menuEmail} numberOfLines={1}>{session.user.email}</Text>
            )}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); navigation.navigate('AccountSettings'); }}>
              <Text style={styles.menuItemText}>⚙️  Gérer le profil</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); supabase.auth.signOut(); }}>
              <Text style={[styles.menuItemText, styles.menuItemDestructive]}>🚪  Se déconnecter</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>

       <Modal
  visible={showRefModal}
  animationType="slide"
  transparent
  onRequestClose={() => setShowRefModal(false)}>
  <View style={styles.modalOverlay}>
    <BlurView intensity={80} tint="light" style={styles.modalSheet}>
      {/* Handle */}
      <View style={styles.modalHandle} />

      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Choisir une référence</Text>
        <TouchableOpacity onPress={() => setShowRefModal(false)}>
          <Text style={styles.modalClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Grille */}
      {allCoupes.length > 0 ? (
        <ScrollView contentContainerStyle={styles.modalGrid}>
          {allCoupes.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.modalCell,
                referenceCut?.id === c.id && styles.modalCellActive,
              ]}
              onPress={() => selectReferenceCut(c)}>
              {c.photo_url ? (
                <Image
                  source={{ uri: c.photo_url }}
                  style={styles.modalCellImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.modalCellImg, { backgroundColor: '#3A1A06', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 22, opacity: 0.2 }}>✂</Text>
                </View>
              )}
              {referenceCut?.id === c.id && (
                <View style={styles.modalCellCheck}>
                  <Text style={{ fontSize: 10, color: '#fff' }}>🔖</Text>
                </View>
              )}
              {c.service ? (
                <View style={styles.modalCellLabel}>
                  <Text style={styles.modalCellLabelText} numberOfLines={1}>{c.service}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center' }}>
            Aucune coupe dans ton book pour l'instant.{'\n'}Ajoute des photos depuis l'onglet Book 📸
          </Text>
        </View>
      )}
    </BlurView>
  </View>
</Modal>
<PhotoViewer
  visible={viewerIndex !== null}
  photos={viewerPhotos}
  initialIndex={viewerIndex ?? 0}
  onClose={() => setViewerIndex(null)}
/>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 400, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(107,63,160,0.12)' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 14, color: '#1C1C1E' },

  menuPopoverWrapper: { position: 'absolute', top: 60, right: 16 },
  menuPopover: {
    width: 210, borderRadius: 14, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  menuEmail: { fontSize: 11, color: 'rgba(28,28,30,0.45)', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  menuDivider: { height: 0.5, backgroundColor: 'rgba(28,28,30,0.1)', marginHorizontal: 14 },
  menuItem: { paddingHorizontal: 14, paddingVertical: 12 },
  menuItemText: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  menuItemDestructive: { color: '#C0392B' },

  hero: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12, alignItems: 'flex-start' },
  avWrap: { position: 'relative', flexShrink: 0 },
  av: { width: 66, height: 66, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(168,133,42,0.35)', alignItems: 'center', justifyContent: 'center' },
  avText: { fontSize: 20, fontWeight: '800', color: '#A8852A' },
  avEdit: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1C1C1E', borderWidth: 2, borderColor: '#FAF4F8', alignItems: 'center', justifyContent: 'center' },
  avEditText: { fontSize: 9, color: '#fff' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  editIcon: { fontSize: 12, color: 'rgba(28,28,30,0.3)' },
  sub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginBottom: 7 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.28)' },
  tagText: { fontSize: 11, color: '#A8852A', fontWeight: '500' },

  scoreBar: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.25)' },
  scoreRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 4, borderColor: '#7C3D8F', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scoreVal: { fontSize: 12, fontWeight: '800', color: '#7C3D8F' },
  scoreTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  scoreSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 1 },
  scoreHint: { fontSize: 10, color: 'rgba(168,133,42,0.8)', marginTop: 2 },

  statsRow: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  stat: { flex: 1, padding: 10, alignItems: 'center' },
  statBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(28,28,30,0.08)' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 10, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  tabs: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  tabTextActive: { color: '#A8852A' },
  tabLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, backgroundColor: '#A8852A', borderRadius: 1 },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  secSub: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  secLink: { fontSize: 13, color: '#0071E3' },

  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 13, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumbEmoji: { fontSize: 18, opacity: 0.25 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  itemSub: { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  itemMeta: { fontSize: 10, color: '#A8852A', marginTop: 3 },
  changeBtn: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.28)' },
  changeBtnText: { fontSize: 11, color: '#A8852A', fontWeight: '600' },
  badgeGreen: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  badgeGreenText: { fontSize: 10, color: '#0F6E56', fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  infoL: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  infoV: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  rdvBtnRed: { flex: 1, backgroundColor: 'rgba(192,57,43,0.08)', borderRadius: 9, padding: 8, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' },
  rdvBtnRedText: { fontSize: 11, fontWeight: '600', color: '#C0392B' },
  rdvBtnBlue: { flex: 1, backgroundColor: 'rgba(0,113,227,0.08)', borderRadius: 9, padding: 8, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  rdvBtnBlueText: { fontSize: 11, fontWeight: '600', color: '#0071E3' },

  capilLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.45)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  capilRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  capilBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  capilBtnActive: { backgroundColor: 'rgba(28,28,30,0.88)', borderColor: 'rgba(28,28,30,0.88)' },
  capilBtnText: { fontSize: 13, fontWeight: '500', color: 'rgba(28,28,30,0.6)' },
  capilBtnTextActive: { color: '#fff' },
  prefBtn: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  prefBtnActive: { backgroundColor: 'rgba(168,133,42,0.15)', borderColor: 'rgba(168,133,42,0.35)' },
  prefBtnText: { fontSize: 12, fontWeight: '500', color: 'rgba(28,28,30,0.6)' },
  prefBtnTextActive: { color: '#A8852A', fontWeight: '600' },

  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.15)', position: 'relative', flexShrink: 0 },
  toggleOn: { backgroundColor: '#7C3D8F' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, left: 2 },
  toggleThumbOn: { left: 22 },

  favGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  favCell: { width: '47.5%', aspectRatio: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  favEmoji: { fontSize: 24, opacity: 0.15 },
  favLikes: { position: 'absolute', bottom: 6, right: 7, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  favLikesText: { fontSize: 9, color: '#fff', fontWeight: '600' },

  histGrid: { paddingHorizontal: 16, flexDirection: 'row', gap: 6, marginBottom: 4 },
  histCell: { flex: 1, height: 90, borderRadius: 13, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  histEmoji: { fontSize: 22, opacity: 0.15 },
  histLabel: { position: 'absolute', bottom: 6, left: 7, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  histLabelText: { fontSize: 9, color: '#fff', fontWeight: '600' },
  avisCard: { marginHorizontal: 16, marginBottom: 7, borderRadius: 14, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  avisText: { fontSize: 12, color: 'rgba(28,28,30,0.65)', lineHeight: 18 },
  avisMeta: { fontSize: 10, color: 'rgba(28,28,30,0.4)', marginTop: 5 },

  bookTabsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  bookTabBtn: { flex: 1, padding: 9, borderRadius: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)', backgroundColor: 'rgba(255,255,255,0.5)' },
  bookTabBtnActive: { backgroundColor: 'rgba(28,28,30,0.88)', borderColor: 'rgba(28,28,30,0.88)' },
  bookTabText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  bookTabTextActive: { color: '#fff' },
  bookGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bookCell: { 
  flex: 1,
  aspectRatio: 1, 
  borderRadius: 13, 
  overflow: 'hidden',
  backgroundColor: '#3A1A06',
},
  bookEmoji: { fontSize: 20, opacity: 0.2 },
  bookRef: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(168,133,42,0.8)', borderRadius: 20, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  bookRefText: { fontSize: 9 },
  bookLikes: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 5, paddingVertical: 1 },
  bookLikesText: { fontSize: 8, color: '#fff', fontWeight: '600' },
  bookAddCell: { width: '31%', aspectRatio: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)', borderStyle: 'dashed' },
  bookAddIcon: { fontSize: 20, color: '#A8852A' },
  bookAddText: { fontSize: 10, color: 'rgba(28,28,30,0.4)', marginTop: 3 },
  privateSub: { fontSize: 12, color: 'rgba(28,28,30,0.4)', paddingHorizontal: 16, marginBottom: 10 },
  lockBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 5, padding: 2 },
  lockText: { fontSize: 9 },
  refBigCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)', marginBottom: 4 },
refPhotoWrap: { position: 'relative' },
refPhotoBg: { height: 160, alignItems: 'center', justifyContent: 'center' },
refPhotoEmoji: { fontSize: 50, opacity: 0.1 },
refRankBadge: { position: 'absolute', top: 10, left: 10, width: 28, height: 28, borderRadius: 9, backgroundColor: '#A8852A', alignItems: 'center', justifyContent: 'center' },
refRankText: { fontSize: 14, color: '#fff' },
refChangeBig: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
refChangeBigText: { fontSize: 11, fontWeight: '600', color: '#fff' },
refBigBody: { padding: 8, paddingTop: 5 },
refBigStats: { flexDirection: 'row', gap: 8, marginBottom: 3, alignItems: 'center' },
refBigStatInline: { fontSize: 11, color: 'rgba(28,28,30,0.5)', fontWeight: '500' },
refBigName: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
refBigBarber: { fontSize: 12, color: '#0071E3', fontWeight: '600', marginBottom: 10 },
barberThumb: { width: 52, height: 52, borderRadius: 14, flexShrink: 0 },
openBadge: { backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
openBadgeText: { fontSize: 10, fontWeight: '600', color: '#7C3D8F' },
barberFooter: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(28,28,30,0.07)' },
barberStat: { flex: 1, alignItems: 'center' },
barberStatNum: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
barberStatLbl: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 2 },
barberStatSep: { width: 1, backgroundColor: 'rgba(28,28,30,0.08)', alignSelf: 'stretch' },
followCard: { borderRadius: 14, overflow: 'hidden', padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', width: 100 },
followAv: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
followName: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
followSalon: { fontSize: 10, color: 'rgba(28,28,30,0.5)', textAlign: 'center', marginTop: 2 },
followRating: { fontSize: 10, color: '#A8852A', marginTop: 3 },
featPhoto: { width:130, height:115, borderTopLeftRadius:18, borderTopRightRadius:18, alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' },
featPhotoImg: { width:130, height:110, position:'absolute', top:0, left:0, right:0, bottom:0 },
  featAv: { width:52, height:52, borderRadius:16, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1.5, borderColor:'rgba(255,255,255,0.3)', alignItems:'center', justifyContent:'center' },
  featCard: { borderRadius:18, overflow:'hidden', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  featAvText: { fontSize:18, fontWeight:'800', color:'#fff' },
  featBadge: { position:'absolute', top:7, left:7, backgroundColor:'rgba(168,133,42,0.3)', borderRadius:20, paddingHorizontal:7, paddingVertical:2 },
  featBadgeText: { fontSize:9, fontWeight:'700', color:'#A8852A' },
  featName: { position:'absolute', bottom:7, left:9, fontSize:11, fontWeight:'700', color:'#fff' },
  featBody: { width:130, borderBottomLeftRadius:18, borderBottomRightRadius:18, overflow:'hidden', padding:9, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', borderTopWidth:0 },
  featSalon: { fontSize:11, fontWeight:'500', color:'#1C1C1E', width:110 },
  featNote: { fontSize:11, color:'#A8852A', marginTop:2 },
  featRow: { flexDirection:'row', justifyContent:'space-between', marginTop:5 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 40, maxHeight: '75%' },
modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
modalTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
modalClose: { fontSize: 14, color: 'rgba(28,28,30,0.4)', padding: 4 },
modalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 14 },
modalCell: { width: '31%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', position: 'relative', borderWidth: 2, borderColor: 'transparent' },
modalCellActive: { borderColor: '#A8852A' },
modalCellImg: { width: '100%', height: '100%',borderRadius: 13 },
modalCellCheck: { position: 'absolute', top: 5, right: 5, backgroundColor: '#A8852A', borderRadius: 20, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
modalCellLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 5, paddingVertical: 3 },
modalCellLabelText: { fontSize: 9, color: '#fff', fontWeight: '600' },
followClientChip: { borderRadius: 14, overflow: 'hidden', width: 90, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', paddingBottom: 8 },
followClientPhoto: { width: 90, height: 70, overflow: 'hidden' },
followClientName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', paddingHorizontal: 6, paddingTop: 5, textAlign: 'center' },
followClientScore: { fontSize: 10, color: '#A8852A', fontWeight: '600', marginTop: 2 },
});
