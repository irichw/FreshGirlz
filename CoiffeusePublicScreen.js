import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, RefreshControl, Alert, TextInput,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { colors, SPECIALITES } from './colors';
import { haversineKm } from './utils/geo';

const { width } = Dimensions.get('window');
const HEADER_H = 265;
const GAP = 1.5;
const COL1_W = Math.floor(width * 0.44);
const COL2_TOTAL = width - COL1_W - GAP;
const SMALL_W = Math.floor((COL2_TOTAL - GAP) / 2);
const SMALL_H = Math.floor((HEADER_H - GAP) / 2);
const BOOK_W = Math.floor((width - 35) / 2);

const TABS = ['Book', 'Prestations', 'Avis'];

function fmtDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

function yearsAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / (365.25 * 24 * 3600 * 1000));
}

export default function CoiffeusePublicScreen({ route, navigation }) {
  const { id } = route.params;
  const [coiffeuse, setCoiffeuse] = useState(null);
  const [bookPhotos, setBookPhotos] = useState([]);
  const [prestations, setPrestations] = useState([]);
  const [avis, setAvis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showAvisModal, setShowAvisModal] = useState(false);
  const [avisNote, setAvisNote] = useState(5);
  const [avisText, setAvisText] = useState('');
  const [submittingAvis, setSubmittingAvis] = useState(false);
  const [likedPhotos, setLikedPhotos] = useState(new Set());
  const [savedPhotos, setSavedPhotos] = useState(new Set());
  const [distance, setDistance] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadAll();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) loadUserInteractions(user.id);
    });
    fetchDistance();
  }, [id]);

  async function fetchDistance() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const { data } = await supabase
        .from('coiffeuses').select('latitude, longitude').eq('id', id).single();
      if (data?.latitude && data?.longitude) {
        setDistance(haversineKm(
          loc.coords.latitude, loc.coords.longitude,
          data.latitude, data.longitude,
        ));
      }
    } catch (_) {}
  }

  async function loadUserInteractions(userId) {
    const { data } = await supabase
      .from('photo_likes')
      .select('photo_id, photo_type')
      .eq('user_id', userId)
      .in('photo_type', ['book', 'inspiration']);
    const liked = new Set();
    const saved = new Set();
    (data || []).forEach(l => {
      if (l.photo_type === 'book') liked.add(l.photo_id);
      if (l.photo_type === 'inspiration') saved.add(l.photo_id);
    });
    setLikedPhotos(liked);
    setSavedPhotos(saved);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [coiffRes, photosRes, prestRes, avisRes] = await Promise.all([
        supabase
          .from('coiffeuses')
          .select('id, name, avatar_url, bio, specialites, rating, nb_avis, adresse, ville, is_available, instagram, created_at, latitude, longitude')
          .eq('id', id).single(),
        supabase
          .from('book_photos')
          .select('id, photo_url, caption, categorie, likes, cliente_id, clientes(id, name, avatar_url)')
          .eq('coiffeuse_id', id)
          .order('created_at', { ascending: false }).limit(30),
        supabase
          .from('prestations')
          .select('id, nom, categorie, emoji, prix_min, prix_max, duree_min, duree_max, description')
          .eq('coiffeuse_id', id).eq('is_active', true).order('categorie'),
        supabase
          .from('avis')
          .select('id, note, commentaire, created_at, clientes(id, name, avatar_url)')
          .eq('coiffeuse_id', id)
          .order('created_at', { ascending: false }).limit(20),
      ]);
      setCoiffeuse(coiffRes.data);
      setBookPhotos(photosRes.data || []);
      setPrestations(prestRes.data || []);
      setAvis(avisRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [id]);

  async function toggleLike(photo) {
    if (!currentUser) {
      Alert.alert('Connexion requise', 'Connecte-toi pour liker des photos.');
      return;
    }
    const isLiked = likedPhotos.has(photo.id);
    const newLikes = Math.max(0, (photo.likes || 0) + (isLiked ? -1 : 1));

    setLikedPhotos(prev => {
      const n = new Set(prev);
      isLiked ? n.delete(photo.id) : n.add(photo.id);
      return n;
    });
    setBookPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, likes: newLikes } : p));

    if (isLiked) {
      await supabase.from('photo_likes').delete()
        .eq('photo_id', photo.id).eq('user_id', currentUser.id).eq('photo_type', 'book');
    } else {
      await supabase.from('photo_likes').upsert(
        { photo_id: photo.id, user_id: currentUser.id, photo_type: 'book' },
        { onConflict: 'photo_id,photo_type,user_id' },
      );
    }
    await supabase.from('book_photos').update({ likes: newLikes }).eq('id', photo.id);
  }

  async function toggleSave(photo) {
    if (!currentUser) {
      Alert.alert('Connexion requise', 'Connecte-toi pour sauvegarder des inspirations.');
      return;
    }
    const isSaved = savedPhotos.has(photo.id);
    setSavedPhotos(prev => {
      const n = new Set(prev);
      isSaved ? n.delete(photo.id) : n.add(photo.id);
      return n;
    });
    if (isSaved) {
      await supabase.from('photo_likes').delete()
        .eq('photo_id', photo.id).eq('user_id', currentUser.id).eq('photo_type', 'inspiration');
    } else {
      await supabase.from('photo_likes').upsert(
        { photo_id: photo.id, user_id: currentUser.id, photo_type: 'inspiration' },
        { onConflict: 'photo_id,photo_type,user_id' },
      );
    }
  }

  async function submitAvis() {
    if (!avisText.trim()) {
      Alert.alert('Avis incomplet', 'Écris un commentaire pour compléter ton avis.');
      return;
    }
    setSubmittingAvis(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: clienteRow } = await supabase
        .from('clientes').select('id').eq('user_id', user.id).maybeSingle();
      if (!clienteRow) throw new Error('Profil cliente introuvable');

      await supabase.from('avis').insert({
        coiffeuse_id: id,
        cliente_id: clienteRow.id,
        note: avisNote,
        commentaire: avisText.trim(),
      });
      const { data: allAvis } = await supabase.from('avis').select('note').eq('coiffeuse_id', id);
      if (allAvis?.length) {
        const avg = allAvis.reduce((s, a) => s + a.note, 0) / allAvis.length;
        await supabase.from('coiffeuses')
          .update({ rating: Math.round(avg * 10) / 10, nb_avis: allAvis.length }).eq('id', id);
      }
      setShowAvisModal(false);
      setAvisText('');
      setAvisNote(5);
      loadAll();
      Alert.alert('Merci !', 'Ton avis a été publié 🌸');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSubmittingAvis(false);
    }
  }

  // ─── Header mosaïque ──────────────────────────────────────────────────────────

  function renderHeader() {
    const photos = bookPhotos.slice(0, 5);
    const hasPhotos = photos.length > 0;
    const years = coiffeuse?.created_at ? yearsAgo(coiffeuse.created_at) : null;
    const mainSpec = coiffeuse?.specialites?.length > 0
      ? SPECIALITES.filter(s => coiffeuse.specialites.includes(s.id)).map(s => s.label).join(' & ')
      : null;

    return (
      <>
        {/* MOSAÏQUE PHOTO */}
        <View style={s.mosaic}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <BlurView intensity={70} tint="dark" style={s.backBtnInner}>
              <Text style={s.backBtnText}>‹</Text>
            </BlurView>
          </TouchableOpacity>

          {hasPhotos ? (
            <View style={{ flexDirection: 'row', height: HEADER_H }}>
              {/* Colonne gauche — grande photo */}
              <Image
                source={{ uri: photos[0].photo_url }}
                style={{ width: COL1_W, height: HEADER_H }}
                resizeMode="cover"
              />
              {/* Séparateur */}
              <View style={{ width: GAP, backgroundColor: colors.background }} />
              {/* Colonne droite — 2×2 */}
              <View style={{ width: COL2_TOTAL, flexDirection: 'row', flexWrap: 'wrap' }}>
                {[photos[1], photos[2], photos[3], photos[4]].map((p, i) => (
                  <View
                    key={i}
                    style={{
                      width: SMALL_W,
                      height: SMALL_H,
                      marginLeft: i % 2 === 1 ? GAP : 0,
                      marginTop: i >= 2 ? GAP : 0,
                      overflow: 'hidden',
                      backgroundColor: colors.primaryLight,
                    }}>
                    {p?.photo_url && (
                      <Image
                        source={{ uri: p.photo_url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={[s.mosaicFallback]}>
              <Text style={{ fontSize: 64, opacity: 0.25 }}>✂️</Text>
            </View>
          )}

          {/* Dégradé bas */}
          <View style={s.mosaicGradTop} />
          <View style={s.mosaicGradBot} />

          {/* Avatar — overlap sur la mosaïque */}
          <View style={s.avatarWrap}>
            {coiffeuse?.avatar_url ? (
              <Image source={{ uri: coiffeuse.avatar_url }} style={s.avatarImg} />
            ) : (
              <View style={[s.avatarImg, s.avatarFallback]}>
                <Text style={{ fontSize: 28 }}>✂️</Text>
              </View>
            )}
          </View>
        </View>

        {/* INFOS */}
        <View style={s.info}>
          {/* Nom + badge vérifié */}
          <View style={s.nameRow}>
            <Text style={s.name}>{coiffeuse?.name}</Text>
            <View style={s.verified}>
              <Text style={s.verifiedTxt}>✓</Text>
            </View>
          </View>

          {/* Note + distance */}
          <View style={s.metaRow}>
            <Text style={s.ratingVal}>★ {coiffeuse?.rating?.toFixed(1) || '—'}</Text>
            <Text style={s.ratingCnt}>({coiffeuse?.nb_avis || 0} avis)</Text>
            {distance !== null && (
              <>
                <Text style={s.sep}>|</Text>
                <Text style={s.dist}>
                  📍 {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
                </Text>
              </>
            )}
          </View>

          {/* Spécialité */}
          {mainSpec && (
            <Text style={s.specialty}>Spécialiste {mainSpec}</Text>
          )}

          {/* Ville + depuis X ans */}
          {(coiffeuse?.ville || years >= 1) && (
            <View style={s.locationRow}>
              {coiffeuse?.ville && <Text style={s.locationTxt}>📍 {coiffeuse.ville}, France</Text>}
              {coiffeuse?.ville && years >= 1 && <Text style={s.locationDot}>·</Text>}
              {years >= 1 && (
                <Text style={s.locationTxt}>Depuis {years} an{years > 1 ? 's' : ''}</Text>
              )}
            </View>
          )}

          {/* Badges */}
          <View style={s.badgesRow}>
            {coiffeuse?.is_available && (
              <View style={s.availBadge}>
                <View style={s.availDot} />
                <Text style={s.availTxt}>Disponible</Text>
              </View>
            )}
            {coiffeuse?.instagram && (
              <View style={s.instaBadge}>
                <Text style={s.instaTxt}>@{coiffeuse.instagram}</Text>
              </View>
            )}
          </View>

          {coiffeuse?.bio && <Text style={s.bio}>{coiffeuse.bio}</Text>}
        </View>

        {/* BOUTONS */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.bookBtn}
            onPress={() => navigation.navigate('BookAppointment', { coiffeuse })}>
            <Text style={s.bookBtnTxt}>📅 Prendre rendez-vous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.starBtn} onPress={() => setShowAvisModal(true)}>
            <Text style={s.starBtnTxt}>⭐</Text>
          </TouchableOpacity>
        </View>

        {/* ONGLETS */}
        <View style={s.tabsBar}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, activeTab === i && s.tabBtnActive]}
              onPress={() => setActiveTab(i)}>
              <Text style={[s.tabBtnTxt, activeTab === i && s.tabBtnTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  }

  // ─── Onglet Book ──────────────────────────────────────────────────────────────

  function renderBook() {
    if (bookPhotos.length === 0) {
      return (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📸</Text>
          <Text style={s.emptyTxt}>Aucune photo dans le book</Text>
        </View>
      );
    }

    // Grille 2 colonnes
    const pairs = [];
    for (let i = 0; i < bookPhotos.length; i += 2) {
      pairs.push([bookPhotos[i], bookPhotos[i + 1] || null]);
    }

    return (
      <View style={s.bookGrid}>
        {pairs.map((pair, pi) => (
          <View key={pi} style={s.bookRow}>
            {pair.map((photo, qi) =>
              photo ? (
                <View key={photo.id} style={s.bookCell}>
                  {photo.photo_url ? (
                    <Image source={{ uri: photo.photo_url }} style={s.bookImg} resizeMode="cover" />
                  ) : (
                    <View style={[s.bookImg, s.bookImgFallback]}>
                      <Text style={{ fontSize: 32 }}>💆</Text>
                    </View>
                  )}

                  {/* Actions : like + inspiration */}
                  <View style={s.bookActions}>
                    <TouchableOpacity style={s.actionPill} onPress={() => toggleLike(photo)}>
                      <Text style={[s.actionIcon, likedPhotos.has(photo.id) && s.likedIcon]}>
                        {likedPhotos.has(photo.id) ? '♥' : '♡'}
                      </Text>
                      {(photo.likes || 0) > 0 && (
                        <Text style={s.actionCount}>{photo.likes}</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity style={s.actionPill} onPress={() => toggleSave(photo)}>
                      <Text style={[s.actionIcon, savedPhotos.has(photo.id) && s.savedIcon]}>
                        {savedPhotos.has(photo.id) ? '🔖' : '🏷'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Tag cliente cliquable */}
                  {photo.clientes && (
                    <TouchableOpacity
                      style={s.clienteTag}
                      onPress={() => navigation.navigate('PublicProfile', { userId: photo.clientes.id })}>
                      {photo.clientes.avatar_url ? (
                        <Image source={{ uri: photo.clientes.avatar_url }} style={s.clienteAvatar} />
                      ) : (
                        <View style={[s.clienteAvatar, s.clienteAvatarFallback]}>
                          <Text style={{ fontSize: 8 }}>👤</Text>
                        </View>
                      )}
                      <Text style={s.clienteName} numberOfLines={1}>{photo.clientes.name}</Text>
                    </TouchableOpacity>
                  )}

                  {/* Caption si pas de cliente */}
                  {photo.caption && !photo.clientes && (
                    <BlurView intensity={45} tint="dark" style={s.caption} pointerEvents="none">
                      <Text style={s.captionTxt} numberOfLines={1}>{photo.caption}</Text>
                    </BlurView>
                  )}
                </View>
              ) : (
                <View key={`empty-${qi}`} style={s.bookCell} />
              )
            )}
          </View>
        ))}
      </View>
    );
  }

  // ─── Onglet Prestations ───────────────────────────────────────────────────────

  function renderPrestations() {
    if (prestations.length === 0) {
      return (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>💆</Text>
          <Text style={s.emptyTxt}>Aucune prestation renseignée</Text>
        </View>
      );
    }

    return (
      <View style={s.prestList}>
        {prestations.map((p, idx) => {
          const priceStr = p.prix_min > 0
            ? (p.prix_max > p.prix_min ? `À partir de ${p.prix_min}€` : `${p.prix_min}€`)
            : null;

          const d1 = fmtDuration(p.duree_min);
          const d2 = p.duree_max ? fmtDuration(p.duree_max) : null;
          const durStr = d1
            ? (d2 && d2 !== d1 ? `${d1} - ${d2}` : d1)
            : null;

          return (
            <View
              key={p.id}
              style={[s.prestRow, idx < prestations.length - 1 && s.prestRowBorder]}>
              <Text style={s.prestNom} numberOfLines={2}>{p.nom}</Text>
              <View style={s.prestRight}>
                {priceStr && <Text style={s.prestPrice}>{priceStr}</Text>}
                {durStr && <Text style={s.prestDur}>{durStr}</Text>}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // ─── Onglet Avis ─────────────────────────────────────────────────────────────

  function renderAvis() {
    if (avis.length === 0) {
      return (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>💬</Text>
          <Text style={s.emptyTxt}>Aucun avis pour l'instant</Text>
          <TouchableOpacity style={s.firstAvisBtn} onPress={() => setShowAvisModal(true)}>
            <Text style={s.firstAvisBtnTxt}>Être la première à laisser un avis</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.avisList}>
        {avis.map(a => (
          <BlurView key={a.id} intensity={50} tint="light" style={s.avisCard}>
            <View style={s.avisHeader}>
              {a.clientes?.avatar_url ? (
                <Image source={{ uri: a.clientes.avatar_url }} style={s.avisAvatar} />
              ) : (
                <View style={[s.avisAvatar, s.avisAvatarFallback]}>
                  <Text style={{ fontSize: 14 }}>👤</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.avisName}>{a.clientes?.name || 'Cliente'}</Text>
                <Text style={s.avisDate}>
                  {new Date(a.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Text key={i} style={[s.avisStar, i <= a.note && s.avisStarOn]}>★</Text>
                ))}
              </View>
            </View>
            {a.commentaire && <Text style={s.avisComment}>{a.commentaire}</Text>}
          </BlurView>
        ))}
      </View>
    );
  }

  // ─── Loader ───────────────────────────────────────────────────────────────────

  if (loading || !coiffeuse) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>

        {renderHeader()}

        <View style={s.tabContent}>
          {activeTab === 0 && renderBook()}
          {activeTab === 1 && renderPrestations()}
          {activeTab === 2 && renderAvis()}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* MODAL AVIS */}
      {showAvisModal && (
        <View style={s.overlay}>
          <BlurView intensity={80} tint="light" style={s.modal}>
            <Text style={s.modalTitle}>Laisser un avis</Text>
            <Text style={s.modalSub}>pour {coiffeuse?.name}</Text>

            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setAvisNote(i)}>
                  <Text style={[s.modalStar, i <= avisNote && s.modalStarOn]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={s.modalInput}
              value={avisText}
              onChangeText={setAvisText}
              placeholder="Décris ton expérience..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowAvisModal(false)}>
                <Text style={s.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalSubmit, submittingAvis && { opacity: 0.6 }]}
                onPress={submitAvis}
                disabled={submittingAvis}>
                <Text style={s.modalSubmitTxt}>
                  {submittingAvis ? 'Envoi...' : 'Publier'}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Mosaïque ──
  mosaic: { width, height: HEADER_H, position: 'relative', overflow: 'hidden', backgroundColor: colors.primaryLight },
  mosaicFallback: { width, height: HEADER_H, alignItems: 'center', justifyContent: 'center' },
  mosaicGradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 70,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  mosaicGradBot: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  backBtn: { position: 'absolute', top: 14, left: 14, zIndex: 20 },
  backBtnInner: {
    width: 36, height: 36, borderRadius: 18,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { fontSize: 22, color: '#fff', fontWeight: '600', lineHeight: 26 },
  avatarWrap: {
    position: 'absolute', bottom: -22, left: 20,
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: colors.background,
    overflow: 'hidden', backgroundColor: colors.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // ── Infos ──
  info: { paddingTop: 32, paddingHorizontal: 20, paddingBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { fontSize: 26, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  verified: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#1A9FE0', alignItems: 'center', justifyContent: 'center',
  },
  verifiedTxt: { fontSize: 12, color: '#fff', fontWeight: '800' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  ratingVal: { fontSize: 15, fontWeight: '700', color: colors.secondary },
  ratingCnt: { fontSize: 13, color: colors.textMuted },
  sep: { fontSize: 13, color: colors.textMuted },
  dist: { fontSize: 13, color: colors.textMuted },

  specialty: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationTxt: { fontSize: 13, color: colors.textMuted },
  locationDot: { fontSize: 13, color: colors.textMuted },

  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  availBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(46,158,91,0.1)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  availDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
  availTxt: { fontSize: 12, fontWeight: '600', color: colors.success },
  instaBadge: {
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  instaTxt: { fontSize: 12, fontWeight: '600', color: colors.primary },
  bio: { fontSize: 13, color: colors.text, lineHeight: 19 },

  // ── Actions ──
  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  bookBtn: {
    flex: 1, backgroundColor: colors.primary,
    borderRadius: 16, padding: 15, alignItems: 'center',
  },
  bookBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  starBtn: {
    width: 50, backgroundColor: colors.secondaryLight,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.secondary,
  },
  starBtnTxt: { fontSize: 20 },

  // ── Tabs ──
  tabsBar: {
    flexDirection: 'row', marginHorizontal: 20,
    backgroundColor: 'rgba(28,28,30,0.06)',
    borderRadius: 16, padding: 3, marginBottom: 0,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 13, alignItems: 'center' },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  tabBtnTxt: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabBtnTxtActive: { color: colors.dark, fontWeight: '700' },

  tabContent: { paddingTop: 16 },

  // ── Book ──
  bookGrid: { paddingHorizontal: 16, gap: 3 },
  bookRow: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  bookCell: {
    width: BOOK_W, height: Math.round(BOOK_W * 1.22),
    borderRadius: 14, overflow: 'hidden',
    position: 'relative', backgroundColor: colors.primaryLight,
  },
  bookImg: { width: '100%', height: '100%' },
  bookImgFallback: { alignItems: 'center', justifyContent: 'center' },

  bookActions: { position: 'absolute', top: 8, right: 8, gap: 5 },
  actionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.48)', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  actionIcon: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  likedIcon: { color: '#FF3B5C' },
  savedIcon: { color: '#FFD60A' },
  actionCount: { fontSize: 10, color: '#fff', fontWeight: '700' },

  clienteTag: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: '80%',
  },
  clienteAvatar: { width: 18, height: 18, borderRadius: 9 },
  clienteAvatarFallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  clienteName: { fontSize: 10, color: '#fff', fontWeight: '600', flex: 1 },

  caption: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 6, overflow: 'hidden',
  },
  captionTxt: { fontSize: 9, color: '#fff', fontWeight: '600' },

  // ── Prestations ──
  prestList: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    borderWidth: 0.5, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  prestRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 15,
  },
  prestRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  prestNom: { fontSize: 14, fontWeight: '600', color: colors.dark, flex: 1, marginRight: 12 },
  prestRight: { alignItems: 'flex-end', gap: 2 },
  prestPrice: { fontSize: 13, fontWeight: '700', color: colors.primary },
  prestDur: { fontSize: 12, color: colors.textMuted },

  // ── Avis ──
  avisList: { paddingHorizontal: 16 },
  avisCard: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 0.5, borderColor: colors.borderLight,
    padding: 14, marginBottom: 10,
  },
  avisHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avisAvatar: { width: 36, height: 36, borderRadius: 18 },
  avisAvatarFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avisName: { fontSize: 13, fontWeight: '700', color: colors.dark },
  avisDate: { fontSize: 11, color: colors.textMuted },
  avisStar: { fontSize: 14, color: '#DDD' },
  avisStarOn: { color: colors.secondary },
  avisComment: { fontSize: 13, color: colors.text, lineHeight: 18 },

  // ── Empty ──
  empty: { alignItems: 'center', paddingVertical: 52, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTxt: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginBottom: 16 },
  firstAvisBtn: {
    backgroundColor: colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  firstAvisBtnTxt: { fontSize: 13, fontWeight: '700', color: colors.primary },

  // ── Modal avis ──
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    padding: 24, borderWidth: 0.5, borderColor: colors.borderLight,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.dark, textAlign: 'center', marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  modalStar: { fontSize: 36, color: '#DDD' },
  modalStarOn: { color: colors.secondary },
  modalInput: {
    backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 14, padding: 14,
    fontSize: 14, color: colors.dark, borderWidth: 0.5, borderColor: colors.border,
    minHeight: 100, textAlignVertical: 'top', marginBottom: 20,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, backgroundColor: 'rgba(28,28,30,0.08)',
    borderRadius: 14, padding: 14, alignItems: 'center',
  },
  modalCancelTxt: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  modalSubmit: { flex: 2, backgroundColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center' },
  modalSubmitTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
