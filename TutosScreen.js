import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

const CATEGORIES = ['Tout', 'Entretien', 'Soin', 'Style', 'Conseil'];

export default function TutosScreen({ navigation }) {
  const [tutos, setTutos] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [loading, setLoading] = useState(true);
  const [clientHairType, setClientHairType] = useState(null);

  useEffect(() => {
    loadTutos();
    loadClientProfile();
  }, []);

  async function loadClientProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('clientes')
      .select('hair_type')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data?.hair_type) setClientHairType(data.hair_type);
  }

  async function loadTutos() {
    const { data } = await supabase
      .from('tutos')
      .select('*, coiffeuses(name, photo_url), clientes(name, avatar_url)')
      .eq('is_approved', true)
      .order('views', { ascending: false });
    if (data) setTutos(data);
    setLoading(false);
  }

  const filtered = tutos.filter(t =>
    activeCategory === 'Tout' || t.category === activeCategory
  );

  const recommended = clientHairType
    ? tutos.filter(t => t.category === 'Soin' || t.category === 'Entretien').slice(0, 3)
    : [];

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💡 Tutos</Text>
          <Text style={styles.headerSub}>Conseils & guides coiffure</Text>
        </View>
        <TouchableOpacity style={styles.addBtn}
          onPress={() => Alert.alert('Bientôt disponible', 'La création de tutos arrive prochainement.')}>
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* CATEGORIES */}
      <View style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catsContent}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c}
              style={[styles.cat, activeCategory === c && styles.catActive]}
              onPress={() => setActiveCategory(c)}>
              <Text style={[styles.catText, activeCategory === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* RECOMMANDÉS POUR TON TYPE */}
        {recommended.length > 0 && activeCategory === 'Tout' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>✨ Pour ton type {clientHairType}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {recommended.map((t) => (
                <TouchableOpacity key={t.id} style={styles.recCard} activeOpacity={0.9}>
                  <View style={[styles.recPhoto, { backgroundColor: '#1C1C1E' }]}>
                    {t.photo_url && (
                      <Image source={{ uri: t.photo_url }}
                        style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    )}
                    {t.type === 'video' && (
                      <View style={styles.playBtn}>
                        <View style={styles.playIcon} />
                      </View>
                    )}
                    <View style={styles.recCatBadge}>
                      <Text style={styles.recCatText}>{t.category}</Text>
                    </View>
                  </View>
                  <View style={{ padding: 8 }}>
                    <Text style={styles.recTitle} numberOfLines={2}>{t.title}</Text>
                    <Text style={styles.recMeta}>{t.duration || t.views + ' vues'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* FEATURED */}
        {featured && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>
                {activeCategory === 'Tout' ? '🔥 À la une' : activeCategory}
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.9} style={styles.featCard}>
              <View style={styles.featPhoto}>
                {featured.photo_url ? (
                  <Image source={{ uri: featured.photo_url }}
                    style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1C1C1E' }]} />
                )}
                <View style={styles.featOverlay} />
                {featured.type === 'video' && (
                  <View style={styles.featPlay}>
                    <View style={styles.playIcon} />
                  </View>
                )}
                <View style={styles.featBottom}>
                  <View style={styles.featCatBadge}>
                    <Text style={styles.featCatText}>{featured.category}</Text>
                  </View>
                  {featured.duration && (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{featured.duration}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.featBody}>
                <Text style={styles.featTitle}>{featured.title}</Text>
                <View style={styles.featMeta}>
                  <Text style={styles.featMetaText}>
                    {featured.barbers?.name || featured.clients?.name || 'FreshGirlz'}
                  </Text>
                  <Text style={styles.featMetaText}>
                    {featured.views?.toLocaleString()} vues
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* LISTE */}
        {rest.length > 0 && (
          <View style={{ marginTop: 4 }}>
            {rest.map((t) => (
              <TouchableOpacity key={t.id} activeOpacity={0.9}>
                <BlurView intensity={55} tint="light" style={styles.listCard}>
                  <View style={styles.listThumb}>
                    {t.photo_url ? (
                      <Image source={{ uri: t.photo_url }}
                        style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.type === 'article' ? '#0A1A2A' : '#1C1C1E', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 22, opacity: 0.3 }}>
                          {t.type === 'article' ? '📖' : '▶'}
                        </Text>
                      </View>
                    )}
                    {t.type === 'video' && (
                      <View style={styles.listPlay}>
                        <View style={[styles.playIcon, { borderLeftWidth: 7, borderTopWidth: 5, borderBottomWidth: 5 }]} />
                      </View>
                    )}
                    {t.duration && (
                      <View style={styles.listDuration}>
                        <Text style={styles.listDurationText}>{t.duration}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={styles.listCatBadge}>
                      <Text style={[styles.listCatText, {
                        color: t.category === 'Soin' ? '#0071E3'
                          : t.category === 'Style' ? '#A8852A'
                          : t.category === 'Entretien' ? '#7C3D8F'
                          : 'rgba(28,28,30,0.5)'
                      }]}>{t.category}</Text>
                    </View>
                    <Text style={styles.listTitle} numberOfLines={2}>{t.title}</Text>
                    <Text style={styles.listMeta}>
                      {t.barbers?.name || t.clients?.name || 'FreshGirlz'} · {t.views?.toLocaleString()} vues
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, color: 'rgba(28,28,30,0.25)', paddingLeft: 8 }}>→</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && (
          <Text style={styles.loadingText}>Chargement...</Text>
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💡</Text>
            <Text style={styles.emptyTitle}>Aucun tuto</Text>
            <Text style={styles.emptySub}>Sois le premier à partager un conseil !</Text>
            <TouchableOpacity style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>+ Ajouter un tuto</Text>
            </TouchableOpacity>
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

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  headerSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  addBtn: { backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  catsContent: { paddingHorizontal: 16, gap: 6, paddingVertical: 8 },
  cat: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  catActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  catText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.6)' },
  catTextActive: { color: '#fff' },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },

  recCard: { width: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  recPhoto: { height: 90, position: 'relative' },
  recCatBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  recCatText: { fontSize: 9, color: '#fff', fontWeight: '600' },
  recTitle: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', lineHeight: 15, marginBottom: 3 },
  recMeta: { fontSize: 10, color: 'rgba(28,28,30,0.45)' },

  featCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  featPhoto: { height: 180, position: 'relative' },
  featOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.3)' },
  featPlay: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -20 }, { translateY: -20 }], width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  featBottom: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featCatBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.4)' },
  featCatText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  durationBadge: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  durationText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  featBody: { padding: 12 },
  featTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  featMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  featMetaText: { fontSize: 11, color: 'rgba(28,28,30,0.5)' },

  listCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden', padding: 0, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', height: 80 },
  listThumb: { width: 80, height: 80, position: 'relative', flexShrink: 0 },
  listPlay: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -10 }, { translateY: -10 }], width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  listDuration: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  listDurationText: { fontSize: 8, color: '#fff' },
  listCatBadge: { alignSelf: 'flex-start', marginBottom: 3, marginLeft: 12 },
  listCatText: { fontSize: 9, fontWeight: '700' },
  listTitle: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', lineHeight: 16, paddingHorizontal: 12 },
  listMeta: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 3, paddingHorizontal: 12 },

  playBtn: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -14 }, { translateY: -14 }], width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playIcon: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#fff', marginLeft: 2 },

  loadingText: { fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 20 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  emptySub: { fontSize: 13, color: 'rgba(28,28,30,0.45)', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
