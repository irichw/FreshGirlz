import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
import { BlurView } from 'expo-blur';

export default function SalonScreen({ navigation, route }) {
  const salonId = route.params?.salon?.id;
  const [salon, setSalon] = useState(route.params?.salon ?? null);
  const [barbers, setBarbers] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('coiffeuses');
  const [queueMode, setQueueMode] = useState('barber');

  useEffect(() => {
    if (salonId) {
      fetchSalon();
      fetchcoiffeuses();
      loadCatalogue();
    }
  }, [salonId]);

  async function fetchSalon() {
    const { data } = await supabase.from('salons').select('*').eq('id', salonId).single();
    if (data) {
      setSalon(data);
      if (data.shop_enabled) loadShopProducts(data.id);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (salonId) fetchcoiffeuses();
    }, 10000);
    return () => clearInterval(interval);
  }, [salonId]);

  async function loadShopProducts(id) {
    const { data } = await supabase
      .from('shop_products')
      .select('*')
      .eq('salon_id', id || salonId)
      .eq('is_available', true)
      .order('created_at', { ascending: false });
    setShopProducts(data || []);
  }

  async function loadCatalogue() {
    const [catsRes, servicesRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('salon_id', salonId).order('position'),
      supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name'),
    ]);
    const cats = catsRes.data || [];
    const services = servicesRes.data || [];

    if (cats.length > 0) {
      setCatalogue(
        cats
          .map(cat => ({
            cat: cat.name,
            items: services
              .filter(s => s.category_id === cat.id)
              .map(s => ({ name: s.name, dur: `${s.duration_minutes} min`, prix: `${s.price}€`, pop: false })),
          }))
          .filter(g => g.items.length > 0)
      );
    } else if (services.length > 0) {
      setCatalogue([{ cat: 'Prestations', items: services.map(s => ({ name: s.name, dur: `${s.duration_minutes} min`, prix: `${s.price}€`, pop: false })) }]);
    }
  }

  async function fetchcoiffeuses() {
    const { data, error } = await supabase
      .from('coiffeuses')
      .select('*')
      .eq('salon_id', salonId);

    if (data) {
      const barbersWithQueue = await Promise.all(
        data.map(async (b) => {
          const { data: queueData } = await supabase
            .from('queue')
            .select('duration')
            .eq('barber_id', b.id)
            .in('status', ['active', 'in_progress']);
          const count = queueData?.length || 0;
          const totalWait = (queueData || []).reduce((sum, e) => sum + (e.duration || 25), 0);
          return { ...b, clients: count, queueCount: count, _totalWait: totalWait };
        })
      );
      setcoiffeuses(barbersWithQueue);
    }
    if (error) console.error('Error:', error);
  }

  const displayBarbers = barbers;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HERO */}
        <View style={styles.hero}>
  {salon?.photo_url ? (
    <Image source={{ uri: salon.photo_url }}
      style={styles.heroBgImage} resizeMode="cover" />
  ) : (
    <View style={styles.heroBg}>
      <Text style={styles.heroBgEmoji}>✂</Text>
    </View>
  )}
  <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <BlurView intensity={40} tint="dark" style={styles.heroLogo}>
              <Text style={styles.heroLogoText}>KS</Text>
            </BlurView>
            <View>
              <Text style={styles.heroName}>{salon?.name || 'King Style Barbershop'}</Text>
              <Text style={styles.heroAddr}>
                {[salon?.address, salon?.city].filter(Boolean).join(' · ') || ''}
              </Text>
              <View style={[styles.heroBadge, { backgroundColor: salon?.is_open ? 'rgba(124,61,143,0.25)' : 'rgba(192,57,43,0.25)' }]}>
                <Text style={[styles.heroBadgeText, { color: salon?.is_open ? '#7EE8A2' : '#FF8A80' }]}>
                  {salon?.is_open ? '● Ouvert' : '● Fermé'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SCORES */}
        <BlurView intensity={50} tint="light" style={styles.scoresRow}>
          {[
            { num: '4.9', lbl: '★ Note' },
            { num: '284', lbl: 'Avis' },
            { num: displayBarbers.length.toString(), lbl: 'coiffeuses' },
            { num: "~8'", lbl: 'Attente min.' },
          ].map((s, i) => (
            <View key={s.lbl} style={[styles.scoreCell, i < 3 && styles.scoreCellBorder]}>
              <Text style={styles.scoreNum}>{s.num}</Text>
              <Text style={styles.scoreLbl}>{s.lbl}</Text>
            </View>
          ))}
        </BlurView>

        {/* TABS */}
        <BlurView intensity={40} tint="light" style={styles.tabs}>
          {['coiffeuses','Catalogue','Book','Avis'].map((t) => (
            <TouchableOpacity key={t} style={styles.tab} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
              {activeTab === t && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* ── ONGLET coiffeuses ── */}
        {activeTab === 'coiffeuses' && (
          <View style={{ marginTop: 10 }}>

            <View style={styles.secRow}>
              <Text style={styles.secTitle}>✂ Choisis ton Coiffeuse</Text>
              <Text style={styles.secSub}>{displayBarbers.length} disponibles</Text>
            </View>

            {queueMode === 'single' ? (
              <BlurView intensity={60} tint="light" style={styles.singleQueueCard}>
                <View style={styles.singleQueueTop}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>File unique · 3 clients</Text>
                  </View>
                  <Text style={styles.singleQueueWait}>~8 min</Text>
                </View>
                <View style={styles.singleSlots}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.singleSlot, i <= 3 && styles.singleSlotFull]}>
                      <Text style={[styles.singleSlotText, i <= 3 && styles.singleSlotTextFull]}>
                        {i <= 3 ? i : ''}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.btnJoinSingle}
                  onPress={() => navigation.navigate('JoinQueue', { barber: { name: 'King Style', id: salon?.id } })}>
                  <Text style={styles.btnJoinSingleText}>✓ Rejoindre la file unique</Text>
                </TouchableOpacity>
              </BlurView>
            ) : (
              displayBarbers.map((b) => (
                <TouchableOpacity key={b.id} onPress={() => navigation.navigate('BarberProfile', { barber: b })} activeOpacity={0.9}>
                  <BlurView intensity={60} tint="light" style={styles.barberCard}>
                    <View style={styles.barberTop}>
                      <View style={styles.barberAv}>
  {b.photo_url ? (
    <Image source={{ uri: b.photo_url }}
      style={styles.barberAvImg} />
  ) : (
    <Text style={styles.barberAvText}>
      {b.ini || b.name?.split(' ').map(n=>n[0]).join('')}
    </Text>
  )}
</View>
                      <View style={styles.barberInfo}>
                        <Text style={styles.barberName}>{b.name}</Text>
                        <Text style={styles.barberSpec}>{b.specialty || 'Expert Coiffeuse'}</Text>
                        <Text style={styles.barberNote}>★ {b.note || '5.0'}</Text>
                      </View>
                      <View style={styles.barberWait}>
                        {(() => {
                          const isOpen = salon?.is_open ?? false;
                          const waitLabel = !isOpen ? 'Fermé' : b.queueCount === 0 ? 'Disponible' : `~${b._totalWait}min`;
                          const badgeBg = !isOpen ? 'rgba(192,57,43,0.12)' : b.queueCount === 0 ? 'rgba(124,61,143,0.12)' : 'rgba(168,133,42,0.12)';
                          const badgeBorder = !isOpen ? 'rgba(192,57,43,0.28)' : b.queueCount === 0 ? 'rgba(124,61,143,0.28)' : 'rgba(168,133,42,0.3)';
                          const textColor = !isOpen ? '#C0392B' : b.queueCount === 0 ? '#7C3D8F' : '#A8852A';
                          return (
                            <View style={[styles.waitBadge, { backgroundColor: badgeBg, borderColor: badgeBorder, borderWidth: 0.5 }]}>
                              <Text style={[styles.waitText, { color: textColor }]}>{waitLabel}</Text>
                            </View>
                          );
                        })()}
                        <Text style={styles.barberClients}>{b.clients || 0} en att.</Text>
                      </View>
                    </View>
                    <View style={styles.miniQueue}>
  <View style={styles.miniQueueSlots}>
    {Array.from({ length: Math.max(b.clients || 0, 5) }).map((_, i) => (
      <View key={i} style={[
        styles.miniSlot,
        i < (b.clients || 0) && styles.miniSlotFull,
      ]} />
    ))}
  </View>
  <Text style={styles.miniQueueLabel}>{b.clients || 0} en attente</Text>
</View>
                    <View style={styles.barberActions}>
                      <TouchableOpacity style={styles.btnJoin} onPress={() => navigation.navigate('JoinQueue', { barber: b })}>
                        <Text style={styles.btnJoinText}>Rejoindre sa file</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnProfile}
  onPress={() => navigation.navigate('Queue', { barber: b })}>
  <Text style={styles.btnProfileText}>Voir la file →</Text>
</TouchableOpacity>
                    </View>
                  </BlurView>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── ONGLET CATALOGUE ── */}
        {activeTab === 'Catalogue' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>💈 Catalogue</Text>
              <Text style={styles.secSub}>
                {catalogue.reduce((n, s) => n + s.items.length, 0)} prestations
              </Text>
            </View>
            {catalogue.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>Aucune prestation disponible</Text>
              </View>
            ) : catalogue.map((section) => (
              <View key={section.cat}>
                <Text style={styles.catLabel}>{section.cat}</Text>
                {section.items.map((item) => (
                  <BlurView key={item.name} intensity={55} tint="light" style={styles.prestCard}>
                    <View style={styles.prestLeft}>
                      <Text style={styles.prestName}>{item.name}</Text>
                      <Text style={styles.prestDur}>⏱ {item.dur}</Text>
                    </View>
                    <View style={styles.prestRight}>
                      {item.pop && (
                        <View style={styles.prestPopBadge}>
                          <Text style={styles.prestPopText}>🔥 Pop</Text>
                        </View>
                      )}
                      <Text style={styles.prestPrix}>{item.prix}</Text>
                    </View>
                  </BlurView>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── AUTRES ONGLETS (Simplifiés) ── */}
        {activeTab === 'Book' && (
  <View>
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>📸 Book du salon</Text>
      <Text style={styles.secSub}>Coupes récentes</Text>
    </View>

    {/* coiffeuses DU SALON */}
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>✂ L'équipe</Text>
      <Text style={styles.secSub}>{displayBarbers.length} coiffeuses</Text>
    </View>
    {displayBarbers.map((b) => (
      <TouchableOpacity key={b.id || b.name}
        onPress={() => navigation.navigate('BarberProfile', { barber: b })}
        activeOpacity={0.9}>
        <BlurView intensity={55} tint="light" style={styles.teamCard}>
          <View style={styles.teamAv}>
            {b.photo_url ? (
              <Image source={{ uri: b.photo_url }} style={styles.teamAvImg} />
            ) : (
              <Text style={styles.teamAvText}>
                {b.ini || b.name?.split(' ').map(n=>n[0]).join('')}
              </Text>
            )}
          </View>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{b.name}</Text>
            <Text style={styles.teamSpec}>{b.specialty || 'Coiffeuse'}</Text>
            <Text style={styles.teamNote}>★ {b.note || b.rating || '—'}</Text>
          </View>
          <View style={styles.teamRight}>
            <View style={styles.teamWaitBadge}>
              <Text style={styles.teamWaitText}>{b.wait || '~15min'}</Text>
            </View>
            <Text style={styles.teamClients}>{b.clients || 0} en att.</Text>
            <Text style={styles.teamArrow}>›</Text>
          </View>
        </BlurView>
      </TouchableOpacity>
    ))}

    {/* PHOTOS GRID */}
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>📸 Galerie</Text>
    </View>
    {(() => {
      const mockPhotos = [
        { bg: '#3A1A06', likes: 10, service: 'Mid Fade' },
        { bg: '#0A1A0A', likes: 17, service: 'Dégradé' },
        { bg: '#0A0A1A', likes: 24, service: 'Design' },
        { bg: '#1A1006', likes: 31, service: 'Afro Fade' },
        { bg: '#1A0814', likes: 38, service: 'Barbe' },
        { bg: '#061014', likes: 45, service: 'Low Fade' },
      ];
      const hero = mockPhotos[0];
      const twoCol = mockPhotos.slice(1, 3);
      const threeCol = mockPhotos.slice(3);
      const cellW2 = (width - 32 - 6) / 2;
      const cellW3 = (width - 32 - 12) / 3;
      return (
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          {/* Photo hero */}
          <View style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: hero.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 40, opacity: 0.15 }}>✂</Text>
            <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>🔥 Top</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 5 }}>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{hero.service}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {hero.likes}</Text>
            </View>
          </View>
          {/* Photos 2-3 : deux colonnes */}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {twoCol.map((p, i) => (
              <View key={i} style={{ width: cellW2, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28, opacity: 0.15 }}>✂</Text>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{p.service}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {p.likes}</Text>
                </View>
              </View>
            ))}
          </View>
          {/* Photos 4+ : trois colonnes */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {threeCol.map((p, i) => (
              <View key={i} style={{ width: cellW3, height: cellW3, borderRadius: 12, overflow: 'hidden', backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, opacity: 0.15 }}>✂</Text>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 8, fontWeight: '600', color: '#fff' }}>{p.service}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>♥ {p.likes}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    })()}
  </View>
)}

        {activeTab === 'Avis' && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>⭐</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 5 }}>Note globale : 4.9</Text>
            <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.5)' }}>284 avis clients</Text>
          </View>
        )}

        {/* ── ONGLET BOUTIQUE — désactivé V1, réactiver en V2 ── */}
        {false && activeTab === 'Boutique' && (
          <View style={{ marginTop: 10 }}>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>🛍 Boutique</Text>
              <Text style={styles.secSub}>{shopProducts.length} produit{shopProducts.length !== 1 ? 's' : ''}</Text>
            </View>

            {shopProducts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🛍</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 }}>Boutique vide</Text>
                <Text style={{ fontSize: 12, color: 'rgba(28,28,30,0.45)', textAlign: 'center' }}>Aucun produit disponible pour l'instant.</Text>
              </View>
            ) : shopProducts.map((p) => (
              <BlurView key={p.id} intensity={55} tint="light" style={styles.shopCard}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.shopImg} />
                ) : (
                  <View style={styles.shopImgPlaceholder}>
                    <Text style={{ fontSize: 28 }}>🛍</Text>
                  </View>
                )}
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{p.name}</Text>
                  {!!p.description && (
                    <Text style={styles.shopDesc} numberOfLines={2}>{p.description}</Text>
                  )}
                  <View style={styles.shopBottom}>
                    <Text style={styles.shopPrice}>{parseFloat(p.price).toFixed(2)} €</Text>
                    <TouchableOpacity style={styles.shopOrderBtn} onPress={() => Alert.alert('Commander', `Vous souhaitez commander "${p.name}" (${parseFloat(p.price).toFixed(2)} €) ? Le salon vous contactera pour finaliser la commande.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Commander', style: 'default' }])}>
                      <Text style={styles.shopOrderBtnText}>Commander</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(168,133,42,0.2)' },
  blob2: { position: 'absolute', top: 350, left: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(60,160,255,0.18)' },
  blob3: { position: 'absolute', bottom: 100, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(107,63,160,0.15)' },
  hero: { height: 200, position: 'relative' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2C1A06', alignItems: 'center', justifyContent: 'center' },
  heroBgEmoji: { fontSize: 80, opacity: 0.08 },
  heroBgImage: { position:'absolute', top:0, left:0, right:0, bottom:0 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: { position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backBtnText: { fontSize: 16, color: '#fff' },
  heroContent: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  heroLogo: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroLogoText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroAddr: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroBadge: { backgroundColor: 'rgba(124,61,143,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  heroBadgeText: { fontSize: 10, color: '#7EE8A2', fontWeight: '600' },
  scoresRow: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  scoreCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  scoreCellBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(0,0,0,0.05)' },
  scoreNum: { fontSize: 19, fontWeight: '800', color: '#A8852A' },
  scoreLbl: { fontSize: 10, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  tabs: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  tabTextActive: { color: '#A8852A' },
  tabLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, backgroundColor: '#A8852A', borderRadius: 1 },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  secTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  secSub: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  barberCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 14 },
  barberTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  barberAv: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(168,133,42,0.18)', borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.35)', alignItems: 'center', justifyContent: 'center' },
  barberAvText: { fontSize: 16, fontWeight: '800', color: '#A8852A' },
  barberInfo: { flex: 1 },
  barberName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  barberSpec: { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  barberNote: { fontSize: 12, color: '#A8852A', marginTop: 3 },
  barberWait: { alignItems: 'flex-end', gap: 4 },
  barberAvImg: { width:50, height:50, borderRadius:15 },
  waitBadge: { backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  waitText: { fontSize: 12, fontWeight: '600', color: '#7C3D8F' },
  barberClients: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  miniQueue: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  miniQueueSlots: { flexDirection: 'row', gap: 4, flex: 1 },
  miniSlot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,28,30,0.08)' },
  miniSlotFull: { backgroundColor: '#A8852A' },
  miniSlotNext: { backgroundColor: 'rgba(168,133,42,0.3)', borderWidth: 1, borderColor: 'rgba(168,133,42,0.4)' },
  miniQueueLabel: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  barberActions: { flexDirection: 'row', gap: 8 },
  btnJoin: { flex: 2, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12, padding: 11, alignItems: 'center' },
  btnJoinText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  btnProfile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 11, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  btnProfileText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.7)' },
  catLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(28,28,30,0.45)', textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  prestCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 12, flexDirection: 'row', alignItems: 'center' },
  prestLeft: { flex: 1 },
  prestName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  prestDur: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 3 },
  prestRight: { alignItems: 'flex-end' },
  prestPopBadge: { backgroundColor: 'rgba(192,57,43,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  prestPopText: { fontSize: 10, color: '#C0392B', fontWeight: '600' },
  prestPrix: { fontSize: 17, fontWeight: '800', color: '#A8852A' },
  modeCard: { margin: 16, padding: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.5)' },
  modeTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  modeSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  modeToggleBtn: { backgroundColor: '#A8852A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  modeToggleBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  singleQueueCard: { marginHorizontal: 16, padding: 20, borderRadius: 20, marginBottom: 20 },
  singleQueueTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  liveRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3D8F', marginRight: 6 },
  liveText: { fontWeight: '700', fontSize: 14 },
  singleQueueWait: { fontSize: 18, fontWeight: '800', color: '#A8852A' },
  singleSlots: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  singleSlot: { flex: 1, height: 40, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  singleSlotFull: { backgroundColor: '#A8852A' },
  singleSlotText: { fontSize: 14, fontWeight: '700', color: 'rgba(0,0,0,0.2)' },
  singleSlotTextFull: { color: '#fff' },
  btnJoinSingle: { backgroundColor: '#1C1C1E', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnJoinSingleText: { color: '#fff', fontWeight: '800' },
  teamCard: { marginHorizontal:16, marginBottom:8, borderRadius:14, overflow:'hidden', padding:11, flexDirection:'row', gap:10, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
teamAv: { width:46, height:46, borderRadius:13, backgroundColor:'rgba(168,133,42,0.15)', borderWidth:1.5, borderColor:'rgba(168,133,42,0.35)', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 },
teamAvImg: { width:46, height:46 },
teamAvText: { fontSize:14, fontWeight:'800', color:'#A8852A' },
teamInfo: { flex:1 },
teamName: { fontSize:14, fontWeight:'700', color:'#1C1C1E' },
teamSpec: { fontSize:11, color:'rgba(28,28,30,0.55)', marginTop:2 },
teamNote: { fontSize:11, color:'#A8852A', marginTop:2 },
teamRight: { alignItems:'flex-end', gap:3 },
teamWaitBadge: { backgroundColor:'rgba(124,61,143,0.12)', borderRadius:20, paddingHorizontal:7, paddingVertical:2, borderWidth:0.5, borderColor:'rgba(124,61,143,0.28)' },
teamWaitText: { fontSize:10, fontWeight:'600', color:'#7C3D8F' },
teamClients: { fontSize:10, color:'rgba(28,28,30,0.45)' },
teamArrow: { fontSize:18, color:'rgba(28,28,30,0.3)' },
bookGrid: { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 },
bookCell: { width:'31%', aspectRatio:1, borderRadius:13, alignItems:'center', justifyContent:'center', position:'relative' },
bookLikes: { position:'absolute', bottom:5, right:5, backgroundColor:'rgba(0,0,0,0.4)', borderRadius:20, paddingHorizontal:5, paddingVertical:1 },
bookLikesText: { fontSize:8, color:'#fff', fontWeight:'600' },
shopCard: { marginHorizontal:16, marginBottom:10, borderRadius:16, overflow:'hidden', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', padding:12, flexDirection:'row', gap:12, alignItems:'flex-start' },
shopImg: { width:80, height:80, borderRadius:12 },
shopImgPlaceholder: { width:80, height:80, borderRadius:12, backgroundColor:'rgba(168,133,42,0.1)', alignItems:'center', justifyContent:'center' },
shopInfo: { flex:1 },
shopName: { fontSize:15, fontWeight:'700', color:'#1C1C1E' },
shopDesc: { fontSize:12, color:'rgba(28,28,30,0.5)', marginTop:4 },
shopBottom: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:10 },
shopPrice: { fontSize:18, fontWeight:'800', color:'#A8852A' },
shopOrderBtn: { backgroundColor:'#1C1C1E', borderRadius:12, paddingHorizontal:14, paddingVertical:8 },
shopOrderBtnText: { fontSize:12, fontWeight:'700', color:'#fff' },
});
