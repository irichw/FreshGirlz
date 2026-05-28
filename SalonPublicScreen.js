import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image, Alert,
  Dimensions, Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import PhotoViewer from './PhotoViewer';

const { width } = Dimensions.get('window');
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function SalonPublicScreen({ navigation, route }) {
  const salonParam = route.params?.salon;
  const barberParam = route.params?.barber;
  const salonId = salonParam?.id || route.params?.salonId || barberParam?.salon_id;

  const [salon, setSalon] = useState(salonParam || null);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hours, setHours] = useState([]);
  const [coupes, setCoupes] = useState([]);
  const [cutsCount, setCutsCount] = useState(0);
  const [shopProducts, setShopProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('Infos');
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [filterBarberId, setFilterBarberId] = useState(null);
  const [salonPhotos, setSalonPhotos] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroViewerOpen, setHeroViewerOpen] = useState(false);

  useEffect(() => {
    if (salonId) {
      loadData();
    } else {
      // Si on a un Coiffeuse mais pas encore son salon_id, on le charge d'abord
      if (barberParam?.id) {
        loadSalonIdFromBarber();
      } else {
        setLoading(false);
      }
    }
  }, []);

  async function loadSalonIdFromBarber() {
    const { data } = await supabase
      .from('coiffeuses')
      .select('salon_id')
      .eq('id', barberParam.id)
      .maybeSingle();
    if (data?.salon_id) {
      await loadDataWithId(data.salon_id);
    } else {
      setLoading(false);
    }
  }

  async function loadData() {
    await loadDataWithId(salonId);
  }

  async function loadDataWithId(id) {
    const [salonRes, barbersRes, servicesRes, catsRes, hoursRes, coupesRes, cutsRes, photosRes] = await Promise.all([
      supabase.from('salons').select('*').eq('id', id).single(),
      supabase.from('coiffeuses').select('*').eq('salon_id', id),
      supabase.from('services').select('*').eq('salon_id', id).eq('is_active', true).order('name'),
      supabase.from('service_categories').select('*').eq('salon_id', id).order('position'),
      supabase.from('opening_hours').select('*').eq('salon_id', id).order('day_of_week'),
      supabase.from('coupes')
        .select('*, coiffeuses(name), clientes(id, name, avatar_url)')
        .eq('salon_id', id)
        .eq('is_private', false)
        .order('created_at', { ascending: false }),
      supabase.from('queue').select('id', { count: 'exact' }).eq('salon_id', id).eq('status', 'done'),
      supabase.from('salon_photos').select('*').eq('salon_id', id).order('position'),
    ]);
    if (photosRes.data) setSalonPhotos(photosRes.data);

    if (salonRes.data) {
      setSalon(salonRes.data);
      if (salonRes.data.shop_enabled) {
        const { data: productsData } = await supabase
          .from('shop_products')
          .select('*')
          .eq('salon_id', id)
          .eq('is_available', true)
          .order('created_at', { ascending: false });
        setShopProducts(productsData || []);
      }
    }
    if (barbersRes.data) {
      const barbersWithQueue = await Promise.all(
        barbersRes.data.map(async (b) => {
          const { data: queueData } = await supabase
            .from('queue')
            .select('duration')
            .eq('barber_id', b.id)
            .in('status', ['active', 'in_progress']);
          const count = queueData?.length || 0;
          const totalWait = (queueData || []).reduce((sum, e) => sum + (e.duration || 25), 0);
          const salonIsOpen = salonRes.data?.is_open ?? false;
          const wait = !salonIsOpen ? 'Fermé' : count === 0 ? 'Disponible' : `~${totalWait} min`;
          return { ...b, queueCount: count, wait, salonIsOpen };
        })
      );
      setcoiffeuses(barbersWithQueue);
    }
    if (servicesRes.data) setServices(servicesRes.data);
    if (catsRes.data) setCategories(catsRes.data);
    if (hoursRes.data) setHours(hoursRes.data);
    if (coupesRes.data) setCoupes(coupesRes.data);
    if (cutsRes.count !== null) setCutsCount(cutsRes.count);
    setLoading(false);
  }

  async function loadReviews() {
    if (!salonId && !salon?.id) return;
    const id = salonId || salon.id;
    const { data: barberIds } = await supabase
      .from('coiffeuses').select('id').eq('salon_id', id);
    if (!barberIds?.length) { setReviewsLoaded(true); return; }
    const ids = barberIds.map(b => b.id);
    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, barber_id, coiffeuses(id, name), clientes(name, avatar_url)')
      .in('barber_id', ids)
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews(data || []);
    setReviewsLoaded(true);
  }

  const displayCoupes = selectedBarber
    ? coupes.filter(c => c.barbers?.name === selectedBarber)
    : coupes;

  const displayReviews = filterBarberId
    ? reviews.filter(r => r.barber_id === filterBarberId)
    : reviews;

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wallpaper} />
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  if (!salon && !salonId) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wallpaper} />
      <TouchableOpacity style={[styles.backBtn, { top: 50, left: 16 }]} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>✂</Text>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 }}>Salon introuvable</Text>
        <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.5)', textAlign: 'center' }}>
          Ce Coiffeuse n'est pas encore rattaché à un salon.
        </Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* HERO — carousel swipeable */}
        {(() => {
          const heroPhotos = salonPhotos.length > 0
            ? salonPhotos.map(p => p.photo_url)
            : [salon?.photo_url].filter(Boolean);
          const hasPhotos = heroPhotos.length > 0;
          return (
            <View style={styles.hero}>
              {hasPhotos ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                  onMomentumScrollEnd={e => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setHeroIndex(idx);
                  }}>
                  {heroPhotos.map((uri, i) => (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.95}
                      onPress={() => { setHeroIndex(i); setHeroViewerOpen(true); }}
                      style={{ width, height: 220 }}>
                      <Image source={{ uri }} style={{ width, height: 220 }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.heroBg}><Text style={styles.heroBgEmoji}>✂</Text></View>
              )}
              <View style={styles.heroOverlay} />
              <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backBtnText}>←</Text>
              </TouchableOpacity>
              {/* Indicateurs de pagination */}
              {heroPhotos.length > 1 && (
                <View style={styles.heroDots}>
                  {heroPhotos.map((_, i) => (
                    <View key={i} style={[styles.heroDot, heroIndex === i && styles.heroDotActive]} />
                  ))}
                </View>
              )}
              {/* Bouton agrandir */}
              {hasPhotos && (
                <TouchableOpacity
                  style={styles.heroExpandBtn}
                  onPress={() => setHeroViewerOpen(true)}>
                  <Text style={styles.heroExpandText}>⊕</Text>
                </TouchableOpacity>
              )}
              <View style={styles.heroContent}>
                <View style={styles.heroLogo}>
                  <Text style={styles.heroLogoText}>
                    {salon?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{salon?.name || 'Salon'}</Text>
                  <Text style={styles.heroAddr}>
                    {[salon?.address, salon?.city].filter(Boolean).join(' · ')}
                  </Text>
                  <View style={[styles.heroBadge, {
                    backgroundColor: salon?.is_open ? 'rgba(124,61,143,0.3)' : 'rgba(192,57,43,0.3)',
                  }]}>
                    <Text style={[styles.heroBadgeText, { color: salon?.is_open ? '#7EE8A2' : '#FF8A80' }]}>
                      {salon?.is_open ? '● Ouvert' : '● Fermé'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* PhotoViewer plein écran */}
              <PhotoViewer
                visible={heroViewerOpen}
                photos={heroPhotos.map(uri => ({ photo_url: uri }))}
                initialIndex={heroIndex}
                onClose={() => setHeroViewerOpen(false)}
              />
            </View>
          );
        })()}

        {/* SCORES */}
        <BlurView intensity={50} tint="light" style={styles.scoresRow}>
          {[
            { num: salon?.rating ?? '—', lbl: '★ Note' },
            { num: salon?.total_reviews ?? '—', lbl: 'Avis' },
            { num: barbers.length, lbl: 'coiffeuses' },
            { num: salon?.show_cuts_count !== false ? cutsCount : '—', lbl: 'Coupes' },
          ].map((s, i) => (
            <View key={s.lbl} style={[styles.scoreCell, i < 3 && styles.scoreCellBorder]}>
              <Text style={styles.scoreNum}>{s.num}</Text>
              <Text style={styles.scoreLbl}>{s.lbl}</Text>
            </View>
          ))}
        </BlurView>

        {/* TABS */}
        <BlurView intensity={40} tint="light" style={styles.tabs}>
          {['Infos', 'Équipe', 'Services', 'Book', 'Avis'].map((t) => (
            <TouchableOpacity key={t} style={styles.tab} onPress={() => { setActiveTab(t); if (t === 'Avis' && !reviewsLoaded) loadReviews(); }}>
              <Text style={[styles.tabText, activeTab === t && styles.tabActive]}>{t}</Text>
              {activeTab === t && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* ── INFOS ── */}
        {activeTab === 'Infos' && (
          <View>
            <BlurView intensity={60} tint="light" style={styles.infoCard}>
              <Text style={styles.infoTitle}>📍 Adresse</Text>
              <Text style={styles.infoValue}>{salon?.address || '—'}</Text>
              <Text style={styles.infoSub}>{salon?.city || '—'}</Text>
            </BlurView>

            {salon?.description ? (
              <BlurView intensity={60} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>📝 Description</Text>
                <Text style={styles.infoDesc}>{salon.description}</Text>
              </BlurView>
            ) : null}

            <BlurView intensity={60} tint="light" style={styles.infoCard}>
              <Text style={styles.infoTitle}>🕐 Horaires</Text>
              {hours.length > 0 ? hours.map((h) => (
                <View key={h.day_of_week} style={styles.dayRow}>
                  <Text style={styles.dayLabel}>{DAYS_FULL[h.day_of_week]}</Text>
                  <Text style={[styles.dayHours, h.is_closed && styles.dayClosed]}>
                    {h.is_closed ? 'Fermé' : `${h.open_time?.slice(0, 5)} – ${h.close_time?.slice(0, 5)}`}
                  </Text>
                </View>
              )) : (
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Horaires non configurés</Text>
              )}
            </BlurView>

            {(salon?.transport || salon?.parking || salon?.pmr || salon?.access_notes) ? (
              <BlurView intensity={60} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>🗺 Comment m'y rendre</Text>
                {salon?.transport ? (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessIcon}>🚇</Text>
                    <Text style={styles.accessText}>{salon.transport}</Text>
                  </View>
                ) : null}
                {salon?.parking ? (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessIcon}>🅿️</Text>
                    <Text style={styles.accessText}>{salon.parking}</Text>
                  </View>
                ) : null}
                {salon?.pmr ? (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessIcon}>♿</Text>
                    <Text style={styles.accessText}>{salon.pmr_description || 'Accessible PMR'}</Text>
                  </View>
                ) : null}
                {salon?.access_notes ? (
                  <View style={styles.accessRow}>
                    <Text style={styles.accessIcon}>📌</Text>
                    <Text style={styles.accessText}>{salon.access_notes}</Text>
                  </View>
                ) : null}
              </BlurView>
            ) : null}

            {(salon?.phone || salon?.instagram) ? (
              <BlurView intensity={60} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>📞 Contact</Text>
                {salon?.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${salon.phone}`)}>
                    <Text style={[styles.infoValue, { color: '#0071E3' }]}>{salon.phone}</Text>
                  </TouchableOpacity>
                ) : null}
                {salon?.instagram ? (
                  <Text style={styles.infoSub}>@{salon.instagram}</Text>
                ) : null}
              </BlurView>
            ) : null}
          </View>
        )}

        {/* ── ÉQUIPE ── */}
        {activeTab === 'Équipe' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>✂ L'équipe</Text>
              <Text style={styles.secSub}>{barbers.length} Coiffeuse{barbers.length > 1 ? 's' : ''}</Text>
            </View>
            {barbers.map((b) => (
              <TouchableOpacity key={b.id} activeOpacity={0.85}
                onPress={() => navigation.push('BarberProfile', { barber: b })}>
                <BlurView intensity={55} tint="light" style={styles.barberCard}>
                  <View style={styles.barberTop}>
                    <View style={styles.barberAv}>
                      {b.photo_url ? (
                        <Image source={{ uri: b.photo_url }} style={styles.barberAvImg} />
                      ) : (
                        <Text style={styles.barberAvText}>
                          {b.name?.split(' ').map(n => n[0]).join('')}
                        </Text>
                      )}
                    </View>
                    <View style={styles.barberInfo}>
                      <Text style={styles.barberName}>{b.name}</Text>
                      <Text style={styles.barberSpec}>{b.specialty || 'Coiffeuse'}</Text>
                      <Text style={styles.barberNote}>★ {b.rating || '—'}</Text>
                    </View>
                    <View style={styles.barberWait}>
                      <View style={[styles.waitBadge, {
                        backgroundColor: !b.salonIsOpen ? 'rgba(192,57,43,0.12)' : b.queueCount === 0 ? 'rgba(124,61,143,0.12)' : 'rgba(168,133,42,0.12)',
                        borderColor: !b.salonIsOpen ? 'rgba(192,57,43,0.28)' : b.queueCount === 0 ? 'rgba(124,61,143,0.28)' : 'rgba(168,133,42,0.3)',
                      }]}>
                        <Text style={[styles.waitText, { color: !b.salonIsOpen ? '#C0392B' : b.queueCount === 0 ? '#7C3D8F' : '#A8852A' }]}>
                          {b.wait}
                        </Text>
                      </View>
                      {b.queueCount > 0 && (
                        <Text style={styles.barberClients}>{b.queueCount} en att.</Text>
                      )}
                      <Text style={{ fontSize: 16, color: 'rgba(28,28,30,0.3)', marginTop: 4 }}>›</Text>
                    </View>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
            {barbers.length === 0 && (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun Coiffeuse enregistré</Text>
              </BlurView>
            )}
          </View>
        )}

        {/* ── SERVICES ── */}
        {activeTab === 'Services' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>💈 Prestations</Text>
              <Text style={styles.secSub}>{services.length} au total</Text>
            </View>

            {categories.map((cat) => {
              const catServices = services.filter(s => s.category_id === cat.id);
              if (catServices.length === 0) return null;
              return (
                <View key={cat.id}>
                  <Text style={styles.catLabel}>{cat.name}</Text>
                  {catServices.map((s) => (
                    <BlurView key={s.id} intensity={55} tint="light" style={styles.prestCard}>
                      <View style={styles.prestLeft}>
                        <Text style={styles.prestName}>{s.name}</Text>
                        <Text style={styles.prestDur}>⏱ {s.duration_minutes} min</Text>
                        {s.description ? <Text style={styles.prestDesc}>{s.description}</Text> : null}
                      </View>
                      <Text style={styles.prestPrix}>{s.price}€</Text>
                    </BlurView>
                  ))}
                </View>
              );
            })}

            {services.filter(s => !s.category_id).length > 0 && (
              <View>
                <Text style={styles.catLabel}>Autres</Text>
                {services.filter(s => !s.category_id).map((s) => (
                  <BlurView key={s.id} intensity={55} tint="light" style={styles.prestCard}>
                    <View style={styles.prestLeft}>
                      <Text style={styles.prestName}>{s.name}</Text>
                      <Text style={styles.prestDur}>⏱ {s.duration_minutes} min</Text>
                      {s.description ? <Text style={styles.prestDesc}>{s.description}</Text> : null}
                    </View>
                    <Text style={styles.prestPrix}>{s.price}€</Text>
                  </BlurView>
                ))}
              </View>
            )}

            {services.length === 0 && (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucune prestation configurée</Text>
              </BlurView>
            )}
          </View>
        )}

        {/* ── GALERIE ── */}
        {activeTab === 'Book' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}>
              <TouchableOpacity
                style={[styles.barberPill, !selectedBarber && styles.barberPillActive]}
                onPress={() => setSelectedBarber(null)}>
                <Text style={[styles.barberPillText, !selectedBarber && styles.barberPillTextActive]}>Tous</Text>
              </TouchableOpacity>
              {barbers.map(b => (
                <TouchableOpacity key={b.id}
                  style={[styles.barberPill, selectedBarber === b.name && styles.barberPillActive]}
                  onPress={() => setSelectedBarber(selectedBarber === b.name ? null : b.name)}>
                  <Text style={[styles.barberPillText, selectedBarber === b.name && styles.barberPillTextActive]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {displayCoupes.length === 0 ? (
              <View style={{ width: '100%', padding: 32, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center' }}>
                  Aucune photo disponible
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, gap: 6 }}>
                {/* Photo hero */}
                {displayCoupes[0] && (() => {
                  const c = displayCoupes[0];
                  return (
                    <TouchableOpacity key={c.id} activeOpacity={0.85}
                      onPress={() => setSelectedPhotoIndex(0)}
                      style={{ width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#2C1A06' }}>
                      {c.photo_url
                        ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                      <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>🔥 Top</Text>
                      </View>
                      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || c.barbers?.name || '—'}</Text>
                        <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {/* Photos 2-3 : deux colonnes */}
                {displayCoupes.slice(1, 3).length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {displayCoupes.slice(1, 3).map((c, idx) => {
                      const cellW = (width - 32 - 6) / 2;
                      return (
                        <TouchableOpacity key={c.id} activeOpacity={0.85}
                          onPress={() => setSelectedPhotoIndex(idx + 1)}
                          style={{ width: cellW, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#2C1A06' }}>
                          {c.photo_url
                            ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: '#fff' }}>{c.service || c.barbers?.name || '—'}</Text>
                            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Photos 4+ : trois colonnes */}
                {displayCoupes.slice(3).length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {displayCoupes.slice(3).map((c, idx) => {
                      const cellW = (width - 32 - 12) / 3;
                      return (
                        <TouchableOpacity key={c.id} activeOpacity={0.85}
                          onPress={() => setSelectedPhotoIndex(idx + 3)}
                          style={{ width: cellW, height: cellW, borderRadius: 12, overflow: 'hidden', backgroundColor: '#2C1A06' }}>
                          {c.photo_url
                            ? <Image source={{ uri: c.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24, opacity: 0.15 }}>✂</Text></View>}
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 8, fontWeight: '600', color: '#fff' }}>{c.service || c.barbers?.name || '—'}</Text>
                            <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>♥ {c.likes || 0}</Text>
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

        {/* ── AVIS ── */}
        {activeTab === 'Avis' && (
          <View>
            {/* NOTE GLOBALE */}
            <BlurView intensity={60} tint="light" style={styles.ratingCard}>
              <Text style={styles.ratingNum}>{salon?.rating ? Number(salon.rating).toFixed(1) : '—'}</Text>
              <View style={styles.ratingStarsRow}>
                {[1,2,3,4,5].map(s => (
                  <Text key={s} style={[styles.ratingStar, s <= Math.round(salon?.rating) && styles.ratingStarActive]}>★</Text>
                ))}
              </View>
              <Text style={styles.ratingCount}>{salon?.total_reviews || 0} avis clients</Text>
            </BlurView>

            {/* FILTRE PAR Coiffeuse */}
            {barbers.length > 1 && (
              <View style={styles.filterRow}>
                <TouchableOpacity
                  style={[styles.filterBtn, filterBarberId === null && styles.filterBtnActive]}
                  onPress={() => setFilterBarberId(null)}>
                  <Text style={[styles.filterBtnText, filterBarberId === null && styles.filterBtnTextActive]}>Tous</Text>
                </TouchableOpacity>
                {barbers.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.filterBtn, filterBarberId === b.id && styles.filterBtnActive]}
                    onPress={() => setFilterBarberId(filterBarberId === b.id ? null : b.id)}>
                    <Text style={[styles.filterBtnText, filterBarberId === b.id && styles.filterBtnTextActive]}>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* LISTE DES AVIS */}
            {!reviewsLoaded ? (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Chargement…</Text>
              </BlurView>
            ) : displayReviews.length === 0 ? (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun avis pour l'instant</Text>
              </BlurView>
            ) : displayReviews.map(avis => {
              const clientName = avis.clients?.name || 'Client anonyme';
              const barberName = avis.barbers?.name;
              const date = new Date(avis.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
              return (
                <BlurView key={avis.id} intensity={55} tint="light" style={styles.avisCard}>
                  <View style={styles.avisTop}>
                    <View style={styles.avisAv}>
                      <Text style={styles.avisAvText}>{clientName[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.avisInfo}>
                      <Text style={styles.avisName}>{clientName}</Text>
                      <Text style={styles.avisDate}>
                        {date}{barberName ? ` · ${barberName}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.avisNote}>{'★'.repeat(avis.rating)}</Text>
                  </View>
                  {avis.comment ? <Text style={styles.avisComment}>{avis.comment}</Text> : null}
                </BlurView>
              );
            })}
          </View>
        )}

        {/* ── BOUTIQUE — désactivée V1, réactiver en V2 ── */}
        {false && activeTab === 'Boutique' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>🛍 Boutique</Text>
              <Text style={styles.secSub}>{shopProducts.length} produit{shopProducts.length !== 1 ? 's' : ''}</Text>
            </View>
            {shopProducts.length === 0 ? (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun produit disponible</Text>
              </BlurView>
            ) : shopProducts.map((p) => (
              <BlurView key={p.id} intensity={55} tint="light" style={styles.shopCard}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.shopImg} />
                ) : (
                  <View style={styles.shopImgPlaceholder}>
                    <Text style={{ fontSize: 26 }}>🛍</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopName}>{p.name}</Text>
                  {!!p.description && (
                    <Text style={styles.shopDesc} numberOfLines={2}>{p.description}</Text>
                  )}
                  <View style={styles.shopBottom}>
                    <Text style={styles.shopPrice}>{parseFloat(p.price).toFixed(2)} €</Text>
                    <TouchableOpacity
                      style={styles.shopOrderBtn}
                      onPress={() => Alert.alert(
                        "Commander",
                        `Vous souhaitez commander "${p.name}" (${parseFloat(p.price).toFixed(2)} €) ?\n\nLe salon vous contactera pour finaliser la commande.`,
                        [{ text: 'Annuler', style: 'cancel' }, { text: 'Commander', style: 'default' }]
                      )}>
                      <Text style={styles.shopOrderBtnText}>Commander</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </BlurView>
            ))}
          </View>
        )}

      </ScrollView>

      <PhotoViewer
        visible={selectedPhotoIndex !== null}
        photos={displayCoupes}
        initialIndex={selectedPhotoIndex ?? 0}
        onClose={() => setSelectedPhotoIndex(null)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 400, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  hero: { height: 220, position: 'relative' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2C1A06', alignItems: 'center', justifyContent: 'center' },
  heroBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroBgEmoji: { fontSize: 70, opacity: 0.08 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroDots: { position: 'absolute', bottom: 88, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  heroDotActive: { backgroundColor: '#fff', width: 14 },
  heroExpandBtn: { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  heroExpandText: { fontSize: 18, color: '#fff', fontWeight: '700' },
  backBtn: { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backBtnText: { fontSize: 18, color: '#fff' },
  heroContent: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  heroLogo: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroLogoText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  heroName: { fontSize: 19, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroAddr: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  heroBadgeText: { fontSize: 9, fontWeight: '600' },

  scoresRow: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)' },
  scoreCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  scoreCellBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.5)' },
  scoreNum: { fontSize: 16, fontWeight: '800', color: '#A8852A' },
  scoreLbl: { fontSize: 9, color: 'rgba(28,28,30,0.55)', marginTop: 2 },

  tabs: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 9, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  tabActive: { color: '#A8852A' },
  tabLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, backgroundColor: '#A8852A', borderRadius: 1 },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  secTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },
  secSub: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },

  infoCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 16, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  infoTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  infoSub: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  infoDesc: { fontSize: 13, color: 'rgba(28,28,30,0.65)', lineHeight: 20 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  dayLabel: { fontSize: 13, color: 'rgba(28,28,30,0.6)' },
  dayHours: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  dayClosed: { color: 'rgba(192,57,43,0.6)' },
  accessRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  accessIcon: { fontSize: 16, width: 24 },
  accessText: { flex: 1, fontSize: 13, color: 'rgba(28,28,30,0.7)', lineHeight: 18 },

  barberCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 14 },
  barberTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  barberAv: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(168,133,42,0.18)', borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  barberAvImg: { width: 50, height: 50 },
  barberAvText: { fontSize: 16, fontWeight: '800', color: '#A8852A' },
  barberInfo: { flex: 1 },
  barberName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  barberSpec: { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  barberNote: { fontSize: 12, color: '#A8852A', marginTop: 3 },
  barberWait: { alignItems: 'flex-end', gap: 4 },
  waitBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 0.5 },
  waitText: { fontSize: 12, fontWeight: '700' },
  barberClients: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  miniQueue: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  miniSlots: { flexDirection: 'row', gap: 4, flex: 1 },
  miniSlot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(28,28,30,0.08)' },
  miniSlotFull: { backgroundColor: '#A8852A' },
  miniQueueLabel: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  barberActions: { flexDirection: 'row', gap: 8 },
  btnJoin: { flex: 2, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12, padding: 11, alignItems: 'center' },
  btnJoinText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  btnProfile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 12, padding: 11, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  btnProfileText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.7)' },

  catLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  prestCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  prestLeft: { flex: 1 },
  prestName: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  prestDur: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 3 },
  prestDesc: { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginTop: 2 },
  prestPrix: { fontSize: 16, fontWeight: '800', color: '#A8852A' },

  ratingCard: { marginHorizontal: 16, marginTop: 10, borderRadius: 16, overflow: 'hidden', padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  ratingNum: { fontSize: 44, fontWeight: '800', color: '#A8852A', lineHeight: 48 },
  ratingStars: { fontSize: 20, color: '#A8852A', marginTop: 4 },
  ratingStarsRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  ratingStar: { fontSize: 20, color: 'rgba(28,28,30,0.15)' },
  ratingStarActive: { color: '#A8852A' },
  ratingCount: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  filterBtnActive: { backgroundColor: 'rgba(168,133,42,0.12)', borderColor: 'rgba(168,133,42,0.4)' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  filterBtnTextActive: { color: '#A8852A' },
  avisCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 15, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  avisTop: { flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 8 },
  avisAv: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avisAvText: { fontSize: 12, fontWeight: '700', color: '#A8852A' },
  avisInfo: { flex: 1 },
  avisName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  avisDate: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 1 },
  avisNote: { fontSize: 13, color: '#A8852A' },
  avisComment: { fontSize: 12, color: 'rgba(28,28,30,0.65)', lineHeight: 18 },

  barberPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  barberPillActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  barberPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.6)' },
  barberPillTextActive: { color: '#fff' },

  bookGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bookCell: { width: '31%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: '#2C1A06', position: 'relative' },
  bookCellStats: { position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', gap: 3 },
  bookCellStatText: { fontSize: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1 },
  bookCellBarber: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  bookCellBarberText: { fontSize: 8, color: '#fff', fontWeight: '600' },

  photoModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  photoModalClose: { position: 'absolute', top: 50, left: 20, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  photoModalInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40 },
  photoModalClient: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  photoModalAvatar: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(168,133,42,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoModalStats: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  photoModalStat: { flex: 1, alignItems: 'center' },
  photoModalStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  photoModalStatVal: { fontSize: 13, fontWeight: '700', color: '#fff' },
  photoDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 8 },
  photoDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  photoDotActive: { backgroundColor: '#fff', width: 16 },
  photoModalSwipe: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },

  shopCard: { marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  shopImg: { width: 80, height: 80, borderRadius: 12 },
  shopImgPlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center' },
  shopName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  shopDesc: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 4 },
  shopBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  shopPrice: { fontSize: 18, fontWeight: '800', color: '#A8852A' },
  shopOrderBtn: { backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  shopOrderBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

