import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, TextInput, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

const CATEGORIES = ['Tout', 'Salons', 'coiffeuses', 'Coupes', 'Utilisateurs'];

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [results, setResults] = useState({ salons: [], barbers: [], coupes: [], users: [] });
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (text, category) => {
    if (!text || text.length < 2) {
      setResults({ salons: [], barbers: [], coupes: [], users: [] });
      return;
    }
    setLoading(true);
    const q = `%${text}%`;

    const [salons, barbers, coupes, users] = await Promise.all([
      // Salons
      (category === 'Tout' || category === 'Salons')
        ? supabase.from('salons').select('*').or(`name.ilike.${q},address.ilike.${q},city.ilike.${q}`).limit(5)
        : { data: [] },

      // coiffeuses
      (category === 'Tout' || category === 'coiffeuses')
        ? supabase.from('coiffeuses').select('*, salons(name)').ilike('name', q).limit(5)
        : { data: [] },

      // Coupes
      (category === 'Tout' || category === 'Coupes')
        ? supabase.from('coupes').select('*, coiffeuses(name)').or(`name.ilike.${q},service.ilike.${q}`).eq('is_public', true).limit(5)
        : { data: [] },

      // Utilisateurs
      (category === 'Tout' || category === 'Utilisateurs')
        ? supabase.from('clientes').select('id, name, avatar_url, fresh_score').ilike('name', q).limit(5)
        : { data: [] },
    ]);

    setResults({
      salons: salons.data || [],
      barbers: barbers.data || [],
      coupes: coupes.data || [],
      users: users.data || [],
    });
    setLoading(false);
  }, []);

  function handleChange(text) {
    setQuery(text);
    search(text, activeCategory);
  }

  function handleCategory(cat) {
    setActiveCategory(cat);
    search(query, cat);
  }

  const hasResults = results.salons.length > 0 || results.barbers.length > 0
    || results.coupes.length > 0 || results.users.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Salon, Coiffeuse, coupe, ville..."
            placeholderTextColor="rgba(28,28,30,0.35)"
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults({ salons: [], barbers: [], coupes: [], users: [] }); }}>
              <Text style={{ fontSize: 14, color: 'rgba(28,28,30,0.4)', paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CATEGORIES */}
      <View style={styles.catsWrapper}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.catsContent}>
    {CATEGORIES.map((c) => (
      <TouchableOpacity key={c}
        style={[styles.cat, activeCategory === c && styles.catActive]}
        onPress={() => handleCategory(c)}>
        <Text style={[styles.catText, activeCategory === c && styles.catTextActive]}>{c}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
</View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ÉTAT VIDE */}
        {!query && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Recherche FreshGirlz</Text>
            <Text style={styles.emptySub}>Salons, coiffeuses, coupes, utilisateurs...</Text>
          </View>
        )}

        {/* CHARGEMENT */}
        {loading && (
          <Text style={styles.loadingText}>Recherche en cours...</Text>
        )}

        {/* AUCUN RÉSULTAT */}
        {query.length >= 2 && !loading && !hasResults && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>😕</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySub}>Essaie un autre mot-clé</Text>
          </View>
        )}

        {/* SALONS */}
        {results.salons.length > 0 && (
          <View>
            <Text style={styles.secTitle}>📍 Salons</Text>
            {results.salons.map((s) => (
              <TouchableOpacity key={s.id} activeOpacity={0.9}
                onPress={() => navigation.navigate('SalonPublic', { salon: s })}>
                <BlurView intensity={55} tint="light" style={styles.resultCard}>
                  <View style={styles.resultPhoto}>
                    {s.photo_url
                      ? <Image source={{ uri: s.photo_url }} style={styles.resultPhotoImg} />
                      : <Text style={styles.resultEmoji}>✂</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{s.name}</Text>
                    <Text style={styles.resultSub}>{s.address} · {s.city}</Text>
                    <Text style={{ fontSize: 11, color: '#A8852A', marginTop: 2 }}>
                      {'★'.repeat(Math.round(s.rating || 0))} {s.rating}
                    </Text>
                  </View>
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>Ouvert</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* coiffeuses */}
        {results.barbers.length > 0 && (
          <View>
            <Text style={styles.secTitle}>✂ coiffeuses</Text>
            {results.barbers.map((b) => (
              <TouchableOpacity key={b.id} activeOpacity={0.9}
                onPress={() => navigation.navigate('BarberProfile', { barber: b })}>
                <BlurView intensity={55} tint="light" style={styles.resultCard}>
                  <View style={[styles.resultPhoto, { backgroundColor: 'rgba(168,133,42,0.1)' }]}>
                    {b.photo_url
                      ? <Image source={{ uri: b.photo_url }} style={styles.resultPhotoImg} />
                      : <Text style={{ fontSize: 18, color: '#A8852A', fontWeight: '800' }}>{b.name?.[0]}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{b.name}</Text>
                    <Text style={styles.resultSub}>{b.salons?.name}</Text>
                    <Text style={{ fontSize: 11, color: '#A8852A', marginTop: 2 }}>★ {b.rating}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* COUPES */}
        {results.coupes.length > 0 && (
          <View>
            <Text style={styles.secTitle}>💈 Coupes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
              {results.coupes.map((c) => (
                <View key={c.id} style={styles.coupeCard}>
                  <View style={[styles.coupePhoto, { backgroundColor: '#3A1A06' }]}>
                    {c.photo_url && (
                      <Image source={{ uri: c.photo_url }}
                        style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                  </View>
                  <Text style={styles.coupeName} numberOfLines={1}>{c.name || c.service || 'Coupe'}</Text>
                  <Text style={styles.coupeBarber} numberOfLines={1}>{c.barbers?.name}</Text>
                  <Text style={styles.coupeLikes}>♥ {c.likes || 0}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* UTILISATEURS */}
        {results.users.length > 0 && (
          <View>
            <Text style={styles.secTitle}>👤 Utilisateurs</Text>
            {results.users.map((u) => (
              <BlurView key={u.id} intensity={55} tint="light" style={styles.resultCard}>
                <View style={[styles.resultPhoto, { backgroundColor: 'rgba(168,133,42,0.1)' }]}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={styles.resultPhotoImg} />
                    : <Text style={{ fontSize: 16, fontWeight: '800', color: '#A8852A' }}>{u.name?.[0]}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{u.name}</Text>
                  <Text style={styles.resultSub}>FreshScore · {u.fresh_score || 0}%</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </BlurView>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E8F4FF' },
  blob1: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(80,160,255,0.22)' },
  blob2: { position: 'absolute', top: 100, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(60,200,120,0.18)' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', flexShrink: 0 },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)' },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchInput: { flex: 1, fontSize: 14, color: '#1C1C1E' },

  catsContent: { paddingHorizontal: 16, gap: 6, paddingVertical: 8 },
  cat: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  catActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  catText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.6)' },
  catTextActive: { color: '#fff' },

  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  resultCard: { marginHorizontal: 16, marginBottom: 7, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  resultPhoto: { width: 48, height: 48, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultPhotoImg: { width: 48, height: 48 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  resultSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  openBadge: { backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  openBadgeText: { fontSize: 10, fontWeight: '600', color: '#7C3D8F' },
  arrow: { fontSize: 16, color: 'rgba(28,28,30,0.3)' },

  coupeCard: { width: 110, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  coupePhoto: { width: '100%', height: 80, overflow: 'hidden' },
  coupeName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', padding: 6, paddingBottom: 2 },
  coupeBarber: { fontSize: 10, color: 'rgba(28,28,30,0.5)', paddingHorizontal: 6 },
  coupeLikes: { fontSize: 10, color: '#C0392B', paddingHorizontal: 6, paddingBottom: 6, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  emptySub: { fontSize: 13, color: 'rgba(28,28,30,0.45)', textAlign: 'center' },
  loadingText: { fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 20 },
  catsWrapper: { height: 44 },
});
