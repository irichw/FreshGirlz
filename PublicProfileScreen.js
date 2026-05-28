import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, useWindowDimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { getFreshLevel } from './freshScore';
import FreshScoreRing from './FreshScoreRing';
import PhotoViewer from './PhotoViewer';

export default function PublicProfileScreen({ route, navigation }) {
  const { client } = route.params;
  const { width } = useWindowDimensions();
  const [fullClient, setFullClient] = useState(null);
  const [coupes, setCoupes] = useState([]);
  const [favoriteBarber, setFavoriteBarber] = useState(null);
  const [followedBarbers, setFollowedBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [myClientId, setMyClientId] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [likedCoupeIds, setLikedCoupeIds] = useState(new Set());
  const [inspirationCoupeIds, setInspirationCoupeIds] = useState(new Set());
  const [coupeStats, setCoupeStats] = useState({});

  useEffect(() => {
    loadProfile();
    loadMySession();
  }, []);

  useEffect(() => {
    if (myClientId && coupes.length > 0) {
      loadMyInteractions(coupes.map(c => c.id));
    }
  }, [myClientId, coupes.length]);

  async function loadMySession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: me } = await supabase
      .from('clientes').select('id').eq('user_id', session.user.id).maybeSingle();
    if (!me) return;
    setMyClientId(me.id);
    const { data: follow } = await supabase
      .from('followed_clients')
      .select('id')
      .eq('follower_id', me.id)
      .eq('followed_id', client.id)
      .maybeSingle();
    setIsFollowing(!!follow);
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
    const i = coupes.findIndex(c => c.id === coupe.id);
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

  async function handleToggleFollow() {
    if (!myClientId || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from('followed_clients')
          .delete().eq('follower_id', myClientId).eq('followed_id', client.id);
        setIsFollowing(false);
      } else {
        await supabase.from('followed_clients')
          .insert({ follower_id: myClientId, followed_id: client.id });
        setIsFollowing(true);
      }
    } catch (_) {}
    setFollowLoading(false);
  }

  async function loadProfile() {
    // Infos complètes client
    const { data: clientData } = await supabase
      .from('clientes')
      .select('*, barbers:favorite_barber_id(id, name, rating, photo_url, salons(name))')
      .eq('id', client.id)
      .maybeSingle();

    if (clientData) {
      setFullClient(clientData);
      if (clientData.barbers) setFavoriteBarber(clientData.barbers);
    }

    // Coupes publiques
    const { data: coupesData } = await supabase
      .from('coupes')
      .select('id, photo_url, service, likes, views')
      .eq('client_id', client.id)
      .eq('is_private', false)
      .order('created_at', { ascending: false });
    if (coupesData) {
      setCoupes(coupesData);
      if (coupesData.length) loadMyInteractions(coupesData.map(c => c.id));
    }

    // coiffeuses suivis
    const { data: followed } = await supabase
      .from('followed_barbers')
      .select('*, coiffeuses(id, name, rating, photo_url, salons(name))')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (followed) setFollowedBarbers(followed.map(f => f.coiffeuses).filter(Boolean));

    setLoading(false);
  }

  const level = getFreshLevel(fullClient?.fresh_score || 0);
  const initials = fullClient?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

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

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* HERO */}
        <View style={styles.hero}>
          <BlurView intensity={60} tint="light" style={styles.av}>
            {fullClient?.avatar_url ? (
              <Image source={{ uri: fullClient.avatar_url }}
                style={{ width: 66, height: 66, borderRadius: 18 }} resizeMode="cover" />
            ) : (
              <Text style={styles.avText}>{initials}</Text>
            )}
          </BlurView>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{fullClient?.name}</Text>
            <Text style={styles.sub}>
              {fullClient?.created_at
                ? new Date(fullClient.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                : '—'}
            </Text>
            <View style={styles.tags}>
              {fullClient?.hair_type && (
                <View style={styles.tag}><Text style={styles.tagText}>{fullClient.hair_type}</Text></View>
              )}
              {fullClient?.face_shape && (
                <View style={styles.tag}><Text style={styles.tagText}>{fullClient.face_shape}</Text></View>
              )}
              {fullClient?.preferences?.slice(0, 1).map(p => (
                <View key={p} style={styles.tag}><Text style={styles.tagText}>{p}</Text></View>
              ))}
            </View>
          </View>
        </View>

        {/* FOLLOW BUTTON */}
        {myClientId && myClientId !== client.id && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={handleToggleFollow}
            disabled={followLoading}
            activeOpacity={0.8}>
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {followLoading ? '…' : isFollowing ? 'Suivi ✓' : '+ Suivre'}
            </Text>
          </TouchableOpacity>
        )}

        {/* FRESHSCORE */}
        <BlurView intensity={55} tint="light" style={styles.scoreBar}>
          <FreshScoreRing score={fullClient?.fresh_score || 0} color={level.color} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreTitle}>FreshScore {level.emoji}</Text>
            <Text style={styles.scoreSub}>{level.label}</Text>
          </View>
        </BlurView>

        {/* STATS */}
        <BlurView intensity={55} tint="light" style={styles.statsRow}>
          {[
            { num: String(coupes.length), lbl: 'Coupes', color: '#A8852A' },
            { num: String(followedBarbers.length), lbl: 'coiffeuses', color: '#1C1C1E' },
            { num: String(coupes.reduce((a, c) => a + (c.likes || 0), 0)), lbl: '♥ Reçus', color: '#C0392B' },
          ].map((s, i) => (
            <View key={s.lbl} style={[styles.stat, i < 2 && styles.statBorder]}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.num}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </BlurView>

        {/* Coiffeuse FAVORI */}
        {favoriteBarber && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>✂ Coiffeuse favori</Text>
            </View>
            <TouchableOpacity activeOpacity={0.85}
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
                    <Text style={{ fontSize: 11, color: '#A8852A' }}>★ {favoriteBarber.rating}</Text>
                  </View>
                  <Text style={{ fontSize: 16, color: 'rgba(28,28,30,0.3)' }}>→</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        )}

        {/* coiffeuses SUIVIS */}
        {followedBarbers.length > 0 && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>👥 coiffeuses suivis</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {followedBarbers.map((b) => b && (
                <TouchableOpacity key={b.id} activeOpacity={0.9}
                  onPress={() => navigation.navigate('BarberProfile', { barber: b })}>
                  <BlurView intensity={55} tint="light" style={styles.barberChip}>
                    {b.photo_url ? (
                      <Image source={{ uri: b.photo_url }} style={styles.barberChipPhoto} />
                    ) : (
                      <View style={[styles.barberChipPhoto, { backgroundColor: '#3A1A06', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#A8852A' }}>{b.name?.[0]}</Text>
                      </View>
                    )}
                    <Text style={styles.barberChipName} numberOfLines={1}>{b.name}</Text>
                    <Text style={styles.barberChipSalon} numberOfLines={1}>{b.salons?.name}</Text>
                  </BlurView>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* BOOK PUBLIC */}
        {coupes.length > 0 && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>📸 Book</Text>
              <Text style={styles.secSub}>{coupes.length} photos</Text>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 6 }}>
              {/* Photo hero */}
              {coupes[0] && (() => {
                const c = coupes[0];
                const stats = coupeStats[c.id] || {};
                const likes = stats.likes ?? c.likes ?? 0;
                const views = stats.views ?? c.views ?? 0;
                return (
                  <TouchableOpacity key={c.id} activeOpacity={0.85}
                    onPress={() => handleOpenCoupe(c)}
                    style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#3A1A06' }}>
                    {c.photo_url
                      ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                    <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>🔥 Top</Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {likes}</Text>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>👁 {views}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })()}

              {/* Photos 2-3 : deux colonnes */}
              {coupes.slice(1, 3).length > 0 && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {coupes.slice(1, 3).map((c) => {
                    const stats = coupeStats[c.id] || {};
                    const likes = stats.likes ?? c.likes ?? 0;
                    const views = stats.views ?? c.views ?? 0;
                    const cellW = (width - 32 - 6) / 2;
                    return (
                      <TouchableOpacity key={c.id} activeOpacity={0.85}
                        onPress={() => handleOpenCoupe(c)}
                        style={{ width: cellW, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                        {c.photo_url
                          ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {likes}</Text>
                            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>👁 {views}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Photos 4+ : trois colonnes */}
              {coupes.slice(3).length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {coupes.slice(3).map((c) => {
                    const stats = coupeStats[c.id] || {};
                    const likes = stats.likes ?? c.likes ?? 0;
                    const views = stats.views ?? c.views ?? 0;
                    const cellW = (width - 32 - 12) / 3;
                    return (
                      <TouchableOpacity key={c.id} activeOpacity={0.85}
                        onPress={() => handleOpenCoupe(c)}
                        style={{ width: cellW, height: cellW, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A0A06' }}>
                        {c.photo_url
                          ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 8, fontWeight: '600', color: '#fff' }}>{c.service || '—'}</Text>
                          <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>♥ {likes}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        <PhotoViewer
          visible={viewerIndex !== null}
          photos={coupes.map(c => ({
            ...c,
            likes: coupeStats[c.id]?.likes ?? c.likes ?? 0,
            views: coupeStats[c.id]?.views ?? c.views ?? 0,
          }))}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
          onIndexChange={handleViewerIndexChange}
          renderActions={myClientId && myClientId !== client.id ? (photo) => (
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

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 300, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(107,63,160,0.12)' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },

  hero: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12, alignItems: 'flex-start' },
  av: { width: 66, height: 66, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(168,133,42,0.35)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avText: { fontSize: 20, fontWeight: '800', color: '#A8852A' },
  name: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5, marginBottom: 2 },
  sub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginBottom: 7 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.28)' },
  tagText: { fontSize: 11, color: '#A8852A', fontWeight: '500' },

  scoreBar: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.25)' },
  scoreTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  scoreSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 1 },

  statsRow: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, overflow: 'hidden', flexDirection: 'row', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  stat: { flex: 1, padding: 10, alignItems: 'center' },
  statBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(28,28,30,0.08)' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 10, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  secSub: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },

  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 13, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barberThumb: { width: 52, height: 52, borderRadius: 14, flexShrink: 0 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  itemSub: { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginTop: 2 },

  barberChip: { borderRadius: 14, overflow: 'hidden', width: 110, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  barberChipPhoto: { width: '100%', height: 70, overflow: 'hidden' },
  barberChipName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', padding: 6, paddingBottom: 2 },
  barberChipSalon: { fontSize: 10, color: 'rgba(28,28,30,0.5)', paddingHorizontal: 6, paddingBottom: 6 },

  bookGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bookCell: { width: '31%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: '#3A1A06', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bookLikes: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, paddingHorizontal: 5, paddingVertical: 1 },
  bookLikesText: { fontSize: 8, color: '#fff', fontWeight: '600' },
  bookOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 },
  bookOverlayText: { fontSize: 8, color: '#fff', fontWeight: '600' },
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

  followBtn: { marginHorizontal: 16, marginBottom: 10, borderRadius: 22, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(168,133,42,0.4)', backgroundColor: 'rgba(168,133,42,0.08)' },
  followBtnActive: { backgroundColor: 'rgba(168,133,42,0.18)', borderColor: '#A8852A' },
  followBtnText: { fontSize: 14, fontWeight: '700', color: '#A8852A' },
  followBtnTextActive: { color: '#A8852A' },
});
