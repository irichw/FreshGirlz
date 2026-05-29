import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, Image, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { colors, SPECIALITES } from './colors';
import * as Location from 'expo-location';
import { haversineKm } from './utils/geo';

const RESULT_TABS = ['Tout', 'Coiffeuses', 'Inspirations'];
const FILTERS = [
  { id: null,        label: 'Tout' },
  { id: 'tresses',   label: 'Tresses' },
  { id: 'locks',     label: 'Locks' },
  { id: 'twist',     label: 'Twist' },
  { id: 'naturel',   label: 'Naturel' },
  { id: 'perruques', label: 'Wigs' },
  { id: 'coloration',label: 'Color' },
  { id: 'soins',     label: 'Soins' },
];

export default function ExplorerScreen({ navigation, route }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [activeTab, setActiveTab] = useState('Tout');
  const [coiffeuses, setCoiffeuses] = useState([]);
  const [inspirations, setInspirations] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchTrending();
    fetchUserLocation();
    if (route.params?.tab === 'inspirations') setActiveTab('Inspirations');
  }, []);

  useEffect(() => {
    if (query.length > 1 || activeFilter !== null) {
      const t = setTimeout(doSearch, 300);
      return () => clearTimeout(t);
    } else if (query.length === 0 && activeFilter === null) {
      setSearched(false);
      setCoiffeuses([]);
      setInspirations([]);
    }
  }, [query, activeFilter]);

  async function fetchUserLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (_) {}
  }

  async function fetchTrending() {
    const { data } = await supabase.rpc('get_trending_coupes', { limit_count: 12 });
    if (data) setTrending(data);
    const { data: inspis } = await supabase.rpc('get_coiffeuse_inspirations', { limit_count: 16 });
    if (inspis) setInspirations(inspis);
  }

  async function doSearch() {
    setLoading(true);
    setSearched(true);
    const lat = userLocation?.latitude ?? null;
    const lon = userLocation?.longitude ?? null;
    const { data } = await supabase.rpc('search_coiffeuses', {
      p_query: query || null,
      p_specialite: activeFilter,
      p_lat: lat,
      p_lon: lon,
    });
    setCoiffeuses(data || []);
    setLoading(false);
  }

  const isSearching = searched && (query.length > 0 || activeFilter !== null);

  function fmtDist(km) {
    if (km === null || km === undefined) return null;
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  }

  // ─── Sous-composants ─────────────────────────────────────────────────────

  function CoiffeuseTile({ item }) {
    const dist = item.distance_km;
    const mainSpec = SPECIALITES.find(sp => item.specialites?.includes(sp.id));
    return (
      <TouchableOpacity style={s.coiffCard} activeOpacity={0.88}
        onPress={() => navigation.navigate('BarberProfile', { barber: item })}>
        <BlurView intensity={55} tint="light" style={s.coiffCardInner}>
          <View style={s.coiffPhotoWrap}>
            {(item.photo_url || item.avatar_url)
              ? <Image source={{ uri: item.photo_url || item.avatar_url }} style={s.coiffPhoto} resizeMode="cover" />
              : (
                <View style={[s.coiffPhoto, s.coiffPhotoFallback]}>
                  <Text style={{ fontSize: 22 }}>✂️</Text>
                </View>
              )}
            <View style={s.coiffVerified}><Text style={{ fontSize: 9, color: '#fff', fontWeight: '800' }}>✓</Text></View>
          </View>
          <View style={s.coiffInfo}>
            <Text style={s.coiffName} numberOfLines={1}>{item.nom_pro || item.name}</Text>
            {mainSpec && <Text style={s.coiffSpec}>{mainSpec.emoji} {mainSpec.label}</Text>}
            <View style={s.coiffMeta}>
              <Text style={s.coiffRating}>★ {item.rating?.toFixed(1) || '—'}</Text>
              {item.nb_avis > 0 && <Text style={s.coiffAvis}> ({item.nb_avis} avis)</Text>}
              {dist && <Text style={s.coiffDist}> · 📍 {fmtDist(dist)}</Text>}
            </View>
            {item.specialites?.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  {item.specialites.slice(0, 3).map(sp => {
                    const found = SPECIALITES.find(s => s.id === sp);
                    return found ? (
                      <View key={sp} style={s.specTag}>
                        <Text style={s.specTagTxt}>{found.label}</Text>
                      </View>
                    ) : null;
                  })}
                </View>
              </ScrollView>
            )}
          </View>
          <TouchableOpacity style={s.coiffReservBtn}
            onPress={() => navigation.navigate('BookAppointment', { barberId: item.id })}>
            <Text style={s.coiffReservTxt}>Réserver</Text>
          </TouchableOpacity>
        </BlurView>
      </TouchableOpacity>
    );
  }

  function InspirationTile({ item }) {
    return (
      <TouchableOpacity style={s.inspTile} activeOpacity={0.88}
        onPress={() => navigation.navigate('BarberProfile', { barber: { id: item.coiffeuse_id } })}>
        {item.photo_url
          ? <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryLight }]} />
        }
        <View style={s.inspOverlay} />
        {item.likes > 0 && (
          <View style={s.inspLikes}>
            <Text style={s.inspLikesTxt}>♥ {item.likes}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} />
        <View style={s.blob2} />
        <View style={s.blob3} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Explorer</Text>
        </View>

        {/* ── BARRE DE RECHERCHE ── */}
        <View style={s.searchRow}>
          <BlurView intensity={55} tint="light" style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={s.searchInput}
              placeholder="Knotless, boho, locks..."
              placeholderTextColor="rgba(28,28,30,0.35)"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={doSearch}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </View>

        {/* ── FILTRES ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersContent} style={s.filtersScroll}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={String(f.id)}
              style={[s.filterPill, activeFilter === f.id && s.filterPillActive]}
              onPress={() => setActiveFilter(activeFilter === f.id ? (f.id === null ? null : null) : f.id)}>
              <Text style={[s.filterTxt, activeFilter === f.id && s.filterTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

          {/* ── MODE RÉSULTATS ── */}
          {isSearching ? (
            <>
              {/* Onglets résultats */}
              <View style={s.resultTabs}>
                {RESULT_TABS.map(tab => (
                  <TouchableOpacity key={tab} style={[s.resultTab, activeTab === tab && s.resultTabActive]}
                    onPress={() => setActiveTab(tab)}>
                    <Text style={[s.resultTabTxt, activeTab === tab && s.resultTabTxtActive]}>{tab}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
              ) : (
                <>
                  {(activeTab === 'Tout' || activeTab === 'Coiffeuses') && (
                    <>
                      {coiffeuses.length > 0 && (
                        <>
                          {activeTab === 'Tout' && (
                            <Text style={s.resultSectionTitle}>Coiffeuses</Text>
                          )}
                          {coiffeuses.map(c => <CoiffeuseTile key={c.id} item={c} />)}
                        </>
                      )}
                      {coiffeuses.length === 0 && activeTab === 'Coiffeuses' && (
                        <View style={s.emptyState}>
                          <Text style={s.emptyIcon}>✂️</Text>
                          <Text style={s.emptyTxt}>Aucune coiffeuse trouvée</Text>
                        </View>
                      )}
                    </>
                  )}
                  {(activeTab === 'Tout' || activeTab === 'Inspirations') && (
                    <>
                      {activeTab === 'Tout' && inspirations.length > 0 && (
                        <Text style={s.resultSectionTitle}>Inspirations</Text>
                      )}
                      <View style={s.inspGrid}>
                        {inspirations.map(i => <InspirationTile key={i.id} item={i} />)}
                      </View>
                      {inspirations.length === 0 && activeTab === 'Inspirations' && (
                        <View style={s.emptyState}>
                          <Text style={s.emptyIcon}>🖼️</Text>
                          <Text style={s.emptyTxt}>Aucune inspiration trouvée</Text>
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* ── MODE DÉCOUVERTE ── */}

              {/* Tendances de la semaine */}
              {trending.length > 0 && (
                <>
                  <View style={s.secRow}>
                    <Text style={s.secTitle}>Tendances de la semaine 🔥</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.trendContent}>
                    {trending.map((c, i) => (
                      <TouchableOpacity key={c.id} style={s.trendCard} activeOpacity={0.88}
                        onPress={() => navigation.navigate('BarberProfile', { barber: { id: c.barber_id } })}>
                        <View style={s.trendPhotoWrap}>
                          {c.photo_url
                            ? <Image source={{ uri: c.photo_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryLight }]} />
                          }
                          <View style={s.trendOverlay} />
                          <View style={s.trendRankBadge}>
                            <Text style={s.trendRankTxt}>{i + 1}</Text>
                          </View>
                          {c.likes > 0 && (
                            <View style={s.trendLikeBadge}>
                              <Text style={s.trendLikeTxt}>♥ {c.likes}</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.trendBottom}>
                          <Text style={s.trendSpec} numberOfLines={1}>{c.coiffeuse_name || '—'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Inspirations pour toi */}
              <View style={s.secRow}>
                <Text style={s.secTitle}>Inspirations pour toi</Text>
              </View>
              <View style={s.inspGrid}>
                {inspirations.map(i => <InspirationTile key={i.id} item={i} />)}
              </View>

              {/* CTA Trouver une coiffeuse */}
              <TouchableOpacity style={s.ctaBtn} activeOpacity={0.88}
                onPress={() => { setSearched(true); doSearch(); }}>
                <Text style={s.ctaTxt}>✂️ Trouver une coiffeuse</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAF4F8',
  },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(124,61,143,0.10)' },
  blob2: { position: 'absolute', top: 200, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.07)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(212,168,67,0.09)' },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },

  searchRow: { marginHorizontal: 16, marginBottom: 10 },
  searchBar: {
    borderRadius: 16, overflow: 'hidden', padding: 13,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchInput: { flex: 1, fontSize: 14, color: colors.dark },

  filtersScroll: { marginBottom: 6 },
  filtersContent: { paddingHorizontal: 16, gap: 7 },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)',
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTxt: { fontSize: 13, fontWeight: '500', color: colors.text },
  filterTxtActive: { color: '#fff', fontWeight: '700' },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 18, fontWeight: '800', color: colors.dark },

  // Onglets résultats
  resultTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12, marginTop: 8 },
  resultTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)',
  },
  resultTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  resultTabTxt: { fontSize: 13, fontWeight: '500', color: colors.text },
  resultTabTxtActive: { color: '#fff', fontWeight: '700' },
  resultSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.dark, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },

  // Carte coiffeuse
  coiffCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden' },
  coiffCardInner: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
  },
  coiffPhotoWrap: { position: 'relative' },
  coiffPhoto: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: colors.primary },
  coiffPhotoFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  coiffVerified: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1A9FE0', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  coiffInfo: { flex: 1 },
  coiffName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  coiffSpec: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  coiffMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  coiffRating: { fontSize: 12, fontWeight: '700', color: colors.secondary },
  coiffAvis: { fontSize: 11, color: colors.textMuted },
  coiffDist: { fontSize: 11, color: colors.textMuted },
  coiffReservBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  coiffReservTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  specTag: {
    backgroundColor: colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  specTagTxt: { fontSize: 10, color: colors.primary, fontWeight: '600' },

  // Tendances
  trendContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  trendCard: { width: 150, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.primaryLight },
  trendPhotoWrap: { width: 150, height: 190, position: 'relative' },
  trendOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(28,0,40,0.25)' },
  trendRankBadge: {
    position: 'absolute', top: 8, left: 8, width: 26, height: 26, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  trendRankTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },
  trendLikeBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  trendLikeTxt: { fontSize: 11, color: '#fff', fontWeight: '600' },
  trendBottom: { padding: 8 },
  trendSpec: { fontSize: 11, fontWeight: '600', color: colors.dark },

  // Inspirations grid
  inspGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 6,
  },
  inspTile: {
    width: '31.5%', aspectRatio: 0.75,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: colors.primaryLight, position: 'relative',
  },
  inspOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(28,0,40,0.18)' },
  inspLikes: {
    position: 'absolute', bottom: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  inspLikesTxt: { fontSize: 9, color: '#fff', fontWeight: '600' },

  // CTA
  ctaBtn: {
    margin: 16, marginTop: 20, borderRadius: 18, overflow: 'hidden',
    backgroundColor: colors.primary, padding: 16, alignItems: 'center',
  },
  ctaTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTxt: { fontSize: 14, color: colors.textMuted },
});
