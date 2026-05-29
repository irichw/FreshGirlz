import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image,
  Dimensions, Alert, Platform,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SPECIALITES } from './colors';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import PhotoViewer from './PhotoViewer';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

const { width } = Dimensions.get('window');

export default function CoiffeuseSalonScreen({ navigation }) {
  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hours, setHours] = useState([]);
  const [coupes, setCoupes] = useState([]);
  const [bookPhotos, setBookPhotos] = useState([]);
  const [clients, setClients] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [currentBarber, setCurrentBarber] = useState(null);
  const [cutsCount, setCutsCount] = useState(0);
  const [activeTab, setActiveTab] = useState('Infos');
  const [loading, setLoading] = useState(true);

  const [shopProducts, setShopProducts] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [bookTab, setBookTab] = useState('public');
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [prestations, setPrestations] = useState([]);
  const [showPrestForm, setShowPrestForm] = useState(false);
  const [prestForm, setPrestForm] = useState({ nom: '', categorie: 'tresses', emoji: '💆', prix_min: '', prix_max: '', duree_min: '', description: '' });

  const [clientSearch, setClientSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [salonPhotos, setSalonPhotos] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isIndependante, setIsIndependante] = useState(false);
  const [indepServices, setIndepServices] = useState([]);

  const isFirstMount = useRef(true);

  useEffect(() => {
    loadSalonData();
  }, []);

  useFocusEffect(useCallback(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    loadSalonData();
  }, []));

  async function loadSalonData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: barberData } = await supabase
        .from('coiffeuses')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!barberData) return;

      setCurrentBarber(barberData);

      // Profil indépendante — pas de salon, données personnelles uniquement
      if (barberData.profile_type === 'independante') {
        setIsIndependante(true);
        const [svcRes, bookRes, prestRes] = await Promise.all([
          supabase.from('services').select('*').eq('coiffeuse_id', barberData.id).eq('is_active', true).order('name'),
          supabase.from('book_photos').select('id, photo_url, is_private, created_at').eq('coiffeuse_id', barberData.id).order('created_at', { ascending: false }),
          supabase.from('prestations').select('id, nom, categorie, emoji, prix_min, prix_max, duree_min, description').eq('coiffeuse_id', barberData.id).order('categorie'),
        ]);
        if (svcRes.data) setIndepServices(svcRes.data);
        if (bookRes.data) setBookPhotos(bookRes.data);
        if (prestRes.data) setPrestations(prestRes.data);
        setLoading(false);
        return;
      }

      const salonId = barberData.salon_id;

      const [salonRes, barbersRes, servicesRes, catsRes, hoursRes, coupesRes, cutsRes, photosRes, bookPhotosRes, prestRes] = await Promise.all([
        supabase.from('salons').select('*').eq('id', salonId).single(),
        supabase.from('coiffeuses').select('*').eq('salon_id', salonId),
        supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name'),
        supabase.from('service_categories').select('*').eq('salon_id', salonId).order('position'),
        supabase.from('opening_hours').select('*').eq('salon_id', salonId).order('day_of_week'),
        supabase.from('coupes').select('*, coiffeuses(name), clientes(id, name, avatar_url)').eq('salon_id', salonId).order('created_at', { ascending: false }),
        supabase.from('queue').select('id', { count: 'exact' }).eq('barber_id', barberData.id).eq('status', 'done'),
        supabase.from('salon_photos').select('*').eq('salon_id', salonId).order('position'),
        supabase.from('book_photos').select('id, photo_url, is_private, created_at').eq('coiffeuse_id', barberData.id).order('created_at', { ascending: false }),
        supabase.from('prestations').select('id, nom, categorie, emoji, prix_min, prix_max, duree_min, description').eq('coiffeuse_id', barberData.id).order('categorie'),
      ]);

      // Charger les avis du salon (tous les coiffeuses du salon)
      const allBarberIds = (barbersRes.data || []).map(b => b.id);
      if (allBarberIds.length) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at, barber_id, coiffeuses(name), clientes(name)')
          .in('barber_id', allBarberIds)
          .order('created_at', { ascending: false })
          .limit(50);
        if (reviewsData) setReviews(reviewsData);
      }
      if (photosRes.data) setSalonPhotos(photosRes.data);
      if (bookPhotosRes.data) setBookPhotos(bookPhotosRes.data);
      if (prestRes.data) setPrestations(prestRes.data);

      if (salonRes.data) {
        setSalon(salonRes.data);
        if (salonRes.data.shop_enabled) {
          const { data: productsData } = await supabase
            .from('shop_products')
            .select('*')
            .eq('salon_id', salonId)
            .order('created_at', { ascending: false });
          setShopProducts(productsData || []);
        }
      }
      if (barbersRes.data) setBarbers(barbersRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (catsRes.data) setCategories(catsRes.data);
      if (hoursRes.data) setHours(hoursRes.data);
      if (coupesRes.data) setCoupes(coupesRes.data);
      if (cutsRes.count !== null) setCutsCount(cutsRes.count);

      const salonBarberIds = (barbersRes.data || []).map(b => b.id);

      if (salonBarberIds.length) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const { data: apptData } = await supabase
          .from('appointments')
          .select('id, date, time, status, coiffeuse_id, cliente_id, services(name, price)')
          .in('coiffeuse_id', salonBarberIds)
          .neq('status', 'cancelled')
          .gte('date', sixMonthsAgo.toISOString().slice(0, 10))
          .order('date', { ascending: true });
        if (apptData) setAppointments(apptData);
      }

      if (salonBarberIds.length) {
        const { data: queueDoneData } = await supabase
          .from('queue')
          .select('client_id, barber_id, updated_at')
          .in('barber_id', salonBarberIds)
          .eq('status', 'done')
          .order('updated_at', { ascending: false })
          .limit(200);

        if (queueDoneData?.length) {
          const seen = new Set();
          const uniqueIds = [];
          const lastCutById = {};
          const barberIdsById = {};
          const reservationsCountById = {};
          for (const row of queueDoneData) {
            if (!row.client_id) continue;
            reservationsCountById[row.client_id] = (reservationsCountById[row.client_id] || 0) + 1;
            if (!seen.has(row.client_id)) {
              seen.add(row.client_id);
              uniqueIds.push(row.client_id);
              lastCutById[row.client_id] = row.updated_at;
              barberIdsById[row.client_id] = new Set();
            }
            if (row.barber_id) barberIdsById[row.client_id].add(row.barber_id);
          }
          const { data: clientRows } = await supabase
            .from('clientes').select('id, name, avatar_url, fresh_score, user_id').in('id', uniqueIds);
          if (clientRows) {
            const ordered = uniqueIds
              .map(id => clientRows.find(c => c.id === id))
              .filter(Boolean)
              .map(c => ({
                ...c,
                lastCut: lastCutById[c.id],
                barberIds: barberIdsById[c.id],
                reservationsCount: reservationsCountById[c.id] || 0,
              }));
            setClients(ordered);
          }
        }
      }
    } catch (error) {
      console.log('Erreur:', error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleCoupePrivacy(coupe) {
    const newVal = !coupe.is_private;
    await supabase.from('coupes').update({ is_private: newVal }).eq('id', coupe.id);
    setCoupes(prev => prev.map(c => c.id === coupe.id ? { ...c, is_private: newVal } : c));
  }

  async function deleteCoupe(coupe) {
    const { error } = await supabase.from('coupes').delete().eq('id', coupe.id);
    if (error) {
      Alert.alert('Erreur suppression', error.message);
      return;
    }
    // Supprimer le fichier dans Storage (extraire le chemin après le bucket)
    const storageBase = '/storage/v1/object/public/photos-coupes/';
    const rawPath = coupe.photo_url?.includes(storageBase)
      ? coupe.photo_url.split(storageBase)[1]?.split('?')[0]
      : coupe.photo_url?.split('/photos-coupes/')?.[1]?.split('?')?.[0];
    if (rawPath) await supabase.storage.from('photos-coupes').remove([rawPath]);
    setCoupes(prev => prev.filter(c => c.id !== coupe.id));
  }

  function confirmDelete(coupe) {
    if (Platform.OS === 'web') {
      if (window.confirm('Supprimer cette photo définitivement ?')) deleteCoupe(coupe);
    } else {
      Alert.alert('Supprimer', 'Supprimer cette photo définitivement ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteCoupe(coupe) },
      ]);
    }
  }

  function showPhotoOptions() {
    if (Platform.OS === 'web') {
      pickAndUploadPhoto('library');
      return;
    }
    Alert.alert('Ajouter une photo', '', [
      { text: 'Bibliothèque photos', onPress: () => pickAndUploadPhoto('library') },
      { text: 'Appareil photo', onPress: () => pickAndUploadPhoto('camera') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  async function pickAndUploadPhoto(source) {
    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Autorise l'accès à l'appareil photo dans les réglages.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Autorise l'accès à ta bibliothèque photo dans les réglages.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
    }

    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('base64 manquant');

      const fileName = `${currentBarber.id}/${Date.now()}.jpeg`;
      const byteArray = Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from('book-photos')
        .upload(fileName, byteArray, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('book-photos')
        .getPublicUrl(fileName);

      const { data: newPhoto, error: insertError } = await supabase
        .from('book_photos')
        .insert({ coiffeuse_id: currentBarber.id, photo_url: publicUrl, is_private: bookTab === 'private' })
        .select('id, photo_url, is_private, created_at')
        .single();

      if (insertError) throw insertError;

      setBookPhotos(prev => [newPhoto, ...prev]);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'importer la photo.");
      console.log('Upload error:', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteBookPhoto(photo) {
    const { error } = await supabase.from('book_photos').delete().eq('id', photo.id);
    if (error) { Alert.alert('Erreur suppression', error.message); return; }
    const storageBase = '/storage/v1/object/public/book-photos/';
    const rawPath = photo.photo_url?.includes(storageBase)
      ? photo.photo_url.split(storageBase)[1]?.split('?')[0]
      : photo.photo_url?.split('/book-photos/')?.[1]?.split('?')?.[0];
    if (rawPath) await supabase.storage.from('book-photos').remove([rawPath]);
    setBookPhotos(prev => prev.filter(p => p.id !== photo.id));
  }

  async function savePrest() {
    if (!prestForm.nom.trim()) { Alert.alert('Erreur', 'Le nom est requis.'); return; }
    try {
      const { data: newPrest, error } = await supabase.from('prestations').insert({
        coiffeuse_id: currentBarber.id,
        nom: prestForm.nom.trim(),
        categorie: prestForm.categorie,
        emoji: prestForm.emoji,
        prix_min: parseInt(prestForm.prix_min) || 0,
        prix_max: parseInt(prestForm.prix_max) || parseInt(prestForm.prix_min) || 0,
        duree_min: parseInt(prestForm.duree_min) || 0,
        description: prestForm.description.trim() || null,
      }).select('id, nom, categorie, emoji, prix_min, prix_max, duree_min, description').single();
      if (error) throw error;
      setPrestations(prev => [...prev, newPrest]);
      setShowPrestForm(false);
      setPrestForm({ nom: '', categorie: 'tresses', emoji: '💆', prix_min: '', prix_max: '', duree_min: '', description: '' });
    } catch (e) { Alert.alert('Erreur', e.message); }
  }

  function deletePrest(prestId) {
    Alert.alert('Supprimer cette prestation ?', '', [
      { text: 'Non', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('prestations').delete().eq('id', prestId);
        setPrestations(prev => prev.filter(p => p.id !== prestId));
      }},
    ]);
  }

  async function toggleBookPhotoPrivacy(photo) {
    const newVal = !photo.is_private;
    await supabase.from('book_photos').update({ is_private: newVal }).eq('id', photo.id);
    setBookPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_private: newVal } : p));
  }

  function confirmDeleteBookPhoto(photo) {
    if (Platform.OS === 'web') {
      if (window.confirm('Supprimer cette photo définitivement ?')) deleteBookPhoto(photo);
    } else {
      Alert.alert('Supprimer', 'Supprimer cette photo définitivement ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteBookPhoto(photo) },
      ]);
    }
  }

  const publicBookPhotos = bookPhotos.filter(p => !p.is_private);
  const privateBookPhotos = bookPhotos.filter(p => p.is_private);
  const displayBookPhotos = bookTab === 'public' ? publicBookPhotos : privateBookPhotos;


  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      {isIndependante && !loading && (
        <IndependanteProfileView
          barber={currentBarber}
          services={indepServices}
          prestations={prestations}
          bookPhotos={bookPhotos}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onAddBookPhoto={showPhotoOptions}
          onDeleteBookPhoto={confirmDeleteBookPhoto}
          uploading={uploading}
          navigation={navigation}
        />
      )}
      {!isIndependante && !salon && !loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
          <Text style={{ fontSize: 32 }}>🏪</Text>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' }}>
            Salon introuvable
          </Text>
          <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.5)', textAlign: 'center', lineHeight: 20 }}>
            Ton profil n'est pas encore lié à un salon.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(192,57,43,0.1)', borderRadius: 12, padding: 12, marginTop: 8 }}
            onPress={async () => { await supabase.auth.signOut(); }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#C0392B' }}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      )}
      {salon && <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

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
                    <Image key={i} source={{ uri }} style={{ width, height: 200 }} resizeMode="cover" />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.heroBg}>
                  <Text style={styles.heroBgEmoji}>✂</Text>
                </View>
              )}
              <View style={styles.heroOverlay} />
              {heroPhotos.length > 1 && (
                <View style={styles.heroDots}>
                  {heroPhotos.map((_, i) => (
                    <View key={i} style={[styles.heroDot, heroIndex === i && styles.heroDotActive]} />
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={styles.gearBtnTop}
                onPress={() => {
                  const isManager = currentBarber?.role === 'manager';
                  const options = [
                    ...(isManager ? [{ text: 'Gérer le salon', onPress: () => navigation.navigate('SalonManagement', { salonId: salon?.id }) }] : []),
                    { text: 'Déconnexion', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); } },
                    { text: 'Annuler', style: 'cancel' },
                  ];
                  Alert.alert('Paramètres', null, options);
                }}>
                <Text style={{ fontSize: 18, color: '#fff' }}>{'⚙'}</Text>
              </TouchableOpacity>
              <View style={styles.heroContent}>
                <View style={styles.heroLogo}>
                  <Text style={styles.heroLogoText}>
                    {salon?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'AM'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroName}>{salon?.name || 'Mon Salon'}</Text>
                  <Text style={styles.heroAddr}>{salon?.address} · {salon?.city}</Text>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>{salon?.is_open ? '● Ouvert' : '● Fermé'}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })()}

        {/* SCORES */}
        <BlurView intensity={50} tint="light" style={styles.scoresRow}>
          {[
            { num: salon?.rating || '—', lbl: '★ Note' },
            { num: salon?.total_reviews || '—', lbl: 'Avis' },
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BlurView intensity={40} tint="light" style={[styles.tabs, { paddingHorizontal: 4 }]}>
            {['Infos', 'Catalogue', 'Avis', 'Clients', 'Activité', 'Boutique'].map((t) => (
              <TouchableOpacity key={t} style={styles.tab} onPress={() => { setActiveTab(t); setEditMode(false); }}>
                <Text style={[styles.tabText, activeTab === t && styles.tabActive]}>{t}</Text>
                {activeTab === t && <View style={styles.tabLine} />}
              </TouchableOpacity>
            ))}
          </BlurView>
        </ScrollView>

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

            {(currentBarber?.intervention_zone || salon?.intervention_zone) ? (
              <BlurView intensity={60} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>📍 Zone d'intervention</Text>
                <Text style={styles.infoValue}>{currentBarber?.intervention_zone || salon?.intervention_zone}</Text>
              </BlurView>
            ) : null}

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

            {(salon?.phone || salon?.instagram || salon?.tiktok) ? (
              <BlurView intensity={60} tint="light" style={styles.infoCard}>
                {salon?.phone ? (
                  <>
                    <Text style={styles.infoTitle}>📞 Téléphone</Text>
                    <Text style={[styles.infoValue, { marginBottom: 12 }]}>{salon.phone}</Text>
                  </>
                ) : null}
                {(salon?.instagram || salon?.tiktok) ? (
                  <>
                    <Text style={styles.infoTitle}>🌐 Réseaux sociaux</Text>
                    {salon?.instagram ? (
                      <View style={styles.socialRow}>
                        <View style={[styles.socialIcon, { backgroundColor: 'rgba(193,53,132,0.12)' }]}>
                          <Text style={{ fontSize: 14 }}>📸</Text>
                        </View>
                        <Text style={styles.socialHandle}>@{salon.instagram}</Text>
                        <Text style={styles.socialLabel}>Instagram</Text>
                      </View>
                    ) : null}
                    {salon?.tiktok ? (
                      <View style={styles.socialRow}>
                        <View style={[styles.socialIcon, { backgroundColor: 'rgba(0,0,0,0.07)' }]}>
                          <Text style={{ fontSize: 14 }}>🎵</Text>
                        </View>
                        <Text style={styles.socialHandle}>@{salon.tiktok}</Text>
                        <Text style={styles.socialLabel}>TikTok</Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </BlurView>
            ) : null}
          </View>
        )}


        {/* ── CATALOGUE ── */}
        {activeTab === 'Catalogue' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>💈 Prestations</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.secSub}>{services.length} au total</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => navigation.navigate('ServicesManagement', { salonId: salon?.id })}>
                  <Text style={styles.editBtnText}>{'⚙'} Gérer</Text>
                </TouchableOpacity>
              </View>
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

            {/* ── MES PRESTATIONS (table prestations, par coiffeuse) ── */}
            <View style={[styles.secRow, { marginTop: 16 }]}>
              <Text style={styles.secTitle}>💆 Mes Prestations</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => { setShowPrestForm(v => !v); }}>
                <Text style={styles.editBtnText}>{showPrestForm ? '✕ Fermer' : '+ Ajouter'}</Text>
              </TouchableOpacity>
            </View>

            {showPrestForm && (
              <BlurView intensity={55} tint="light" style={styles.prestFormCard}>
                <Text style={styles.prestFormTitle}>Nouvelle prestation</Text>

                <Text style={styles.formLabel}>Nom *</Text>
                <TextInput style={styles.formInput} value={prestForm.nom}
                  onChangeText={v => setPrestForm(f => ({ ...f, nom: v }))}
                  placeholder="Ex : Box braids" placeholderTextColor="rgba(28,28,30,0.35)" />

                <Text style={styles.formLabel}>Catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                  {SPECIALITES.map(s => (
                    <TouchableOpacity key={s.id}
                      style={[styles.catChip, prestForm.categorie === s.id && styles.catChipActive]}
                      onPress={() => setPrestForm(f => ({ ...f, categorie: s.id, emoji: s.emoji }))}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.7)' }}>{s.emoji} {s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Prix min (€)</Text>
                    <TextInput style={styles.formInput} value={prestForm.prix_min}
                      onChangeText={v => setPrestForm(f => ({ ...f, prix_min: v }))}
                      placeholder="0" placeholderTextColor="rgba(28,28,30,0.35)" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Prix max (€)</Text>
                    <TextInput style={styles.formInput} value={prestForm.prix_max}
                      onChangeText={v => setPrestForm(f => ({ ...f, prix_max: v }))}
                      placeholder="0" placeholderTextColor="rgba(28,28,30,0.35)" keyboardType="numeric" />
                  </View>
                </View>

                <Text style={styles.formLabel}>Durée (min)</Text>
                <TextInput style={styles.formInput} value={prestForm.duree_min}
                  onChangeText={v => setPrestForm(f => ({ ...f, duree_min: v }))}
                  placeholder="Ex : 120" placeholderTextColor="rgba(28,28,30,0.35)" keyboardType="numeric" />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput style={[styles.formInput, { minHeight: 70, textAlignVertical: 'top' }]}
                  value={prestForm.description}
                  onChangeText={v => setPrestForm(f => ({ ...f, description: v }))}
                  placeholder="Décris la prestation..." placeholderTextColor="rgba(28,28,30,0.35)"
                  multiline numberOfLines={3} />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(28,28,30,0.07)', borderRadius: 12, padding: 11, alignItems: 'center' }}
                    onPress={() => setShowPrestForm(false)}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(28,28,30,0.5)' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 2, backgroundColor: '#A8852A', borderRadius: 12, padding: 11, alignItems: 'center' }}
                    onPress={savePrest}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            )}

            {prestations.length === 0 && !showPrestForm ? (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucune prestation personnelle</Text>
              </BlurView>
            ) : prestations.map(p => (
              <BlurView key={p.id} intensity={50} tint="light" style={styles.prestItemCard}>
                <View style={styles.prestItemIcon}>
                  <Text style={{ fontSize: 20 }}>{p.emoji || '💆'}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1C1E' }}>{p.nom}</Text>
                  {p.description ? <Text style={{ fontSize: 12, color: 'rgba(28,28,30,0.5)' }} numberOfLines={1}>{p.description}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {p.duree_min > 0 && <Text style={{ fontSize: 11, color: 'rgba(28,28,30,0.5)' }}>⏱ {p.duree_min}min</Text>}
                    {p.prix_min > 0 && (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#A8852A' }}>
                        {p.prix_min === p.prix_max ? `${p.prix_min}€` : `${p.prix_min}–${p.prix_max}€`}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => deletePrest(p.id)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 18 }}>🗑</Text>
                </TouchableOpacity>
              </BlurView>
            ))}
          </View>
        )}

        {/* ── AVIS ── */}
        {activeTab === 'Avis' && (
          <View>
            <BlurView intensity={60} tint="light" style={styles.ratingCard}>
              <Text style={styles.ratingNum}>{salon?.rating ? Number(salon.rating).toFixed(1) : '—'}</Text>
              <Text style={styles.ratingStars}>{'★'.repeat(Math.round(salon?.rating || 0))}{'☆'.repeat(5 - Math.round(salon?.rating || 0))}</Text>
              <Text style={styles.ratingCount}>{salon?.total_reviews || reviews.length || '0'} avis clients</Text>
            </BlurView>
            {reviews.length === 0 ? (
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { alignItems: 'center' }]}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun avis pour l'instant</Text>
              </BlurView>
            ) : reviews.map(r => (
              <BlurView key={r.id} intensity={55} tint="light" style={[styles.infoCard, { gap: 6 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#A8852A' }}>
                        {(r.clients?.name || 'C')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#1C1C1E' }}>{r.clients?.name || 'Client'}</Text>
                      <Text style={{ fontSize: 11, color: 'rgba(28,28,30,0.4)' }}>{r.barbers?.name}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: '#A8852A', fontWeight: '700' }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </Text>
                </View>
                {r.comment ? (
                  <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.7)', lineHeight: 19 }}>{r.comment}</Text>
                ) : null}
                <Text style={{ fontSize: 10, color: 'rgba(28,28,30,0.35)' }}>
                  {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </BlurView>
            ))}
          </View>
        )}

        {/* ── ACTIVITÉ ── */}
        {activeTab === 'Activité' && (() => {
          const totalCA = appointments.reduce((sum, a) => sum + (a.services?.price || 0), 0);
          const avgCA = appointments.length > 0 ? Math.round(totalCA / appointments.length) : 0;

          const serviceMap = {};
          appointments.forEach(a => {
            const name = a.services?.name || 'Autre';
            serviceMap[name] = (serviceMap[name] || 0) + 1;
          });
          const topServices = Object.entries(serviceMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const totalAppts = appointments.length;

          const now = new Date();
          const monthlyMap = {};
          const monthLabels = {};
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            monthlyMap[key] = 0;
            monthLabels[key] = d.toLocaleDateString('fr-FR', { month: 'short' });
          }
          appointments.forEach(a => {
            if (!a.date) return;
            const key = a.date.slice(0, 7);
            if (key in monthlyMap) monthlyMap[key] += a.services?.price || 0;
          });
          const monthlyData = Object.entries(monthlyMap);
          const maxMonthCA = Math.max(...monthlyData.map(([, v]) => v), 1);

          return (
            <View>
              {/* KPIs */}
              <BlurView intensity={55} tint="light" style={[styles.infoCard, { flexDirection: 'row', gap: 0 }]}>
                {[
                  { val: `${totalCA}€`, lbl: 'CA 6 mois' },
                  { val: totalAppts, lbl: 'RDV' },
                  { val: `${avgCA}€`, lbl: 'Moy / RDV' },
                ].map((k, i) => (
                  <View key={k.lbl} style={[styles.kpiCell, i < 2 && { borderRightWidth: 0.5, borderRightColor: 'rgba(28,28,30,0.1)' }]}>
                    <Text style={styles.kpiVal}>{k.val}</Text>
                    <Text style={styles.kpiLbl}>{k.lbl}</Text>
                  </View>
                ))}
              </BlurView>

              {/* Évolution mensuelle */}
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>📈 Chiffre d'affaires — 6 mois</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80, marginTop: 8 }}>
                  {monthlyData.map(([key, val]) => {
                    const barH = Math.max(4, Math.round((val / maxMonthCA) * 70));
                    return (
                      <View key={key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 8, color: '#A8852A', fontWeight: '700' }}>{val > 0 ? `${val}€` : ''}</Text>
                        <View style={{ width: '100%', height: barH, borderRadius: 5, backgroundColor: val > 0 ? '#A8852A' : 'rgba(168,133,42,0.15)' }} />
                        <Text style={{ fontSize: 8, color: 'rgba(28,28,30,0.45)', textTransform: 'capitalize' }}>{monthLabels[key]}</Text>
                      </View>
                    );
                  })}
                </View>
              </BlurView>

              {/* Répartition prestations */}
              <BlurView intensity={55} tint="light" style={styles.infoCard}>
                <Text style={styles.infoTitle}>💈 Top prestations</Text>
                {topServices.length === 0 ? (
                  <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucun RDV enregistré</Text>
                ) : topServices.map(([name, count]) => {
                  const pct = Math.round((count / totalAppts) * 100);
                  return (
                    <View key={name} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1C1C1E' }}>{name}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#A8852A' }}>{count} RDV · {pct}%</Text>
                      </View>
                      <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(168,133,42,0.15)' }}>
                        <View style={{ height: 5, borderRadius: 3, backgroundColor: '#A8852A', width: `${pct}%` }} />
                      </View>
                    </View>
                  );
                })}
              </BlurView>
            </View>
          );
        })()}

        {/* ── CLIENTS ── */}
        {activeTab === 'Clients' && (() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

          const upcomingByClient = {};
          appointments.forEach(a => {
            if (a.date >= todayStr && a.cliente_id) {
              const ex = upcomingByClient[a.cliente_id];
              if (!ex || a.date < ex.date || (a.date === ex.date && (a.time || '') < (ex.time || ''))) {
                upcomingByClient[a.cliente_id] = a;
              }
            }
          });

          function fmtNextAppt(appt) {
            if (!appt) return null;
            let label;
            if (appt.date === todayStr) label = "Aujourd'hui";
            else if (appt.date === tomorrowStr) label = 'Demain';
            else label = new Date(appt.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
            return appt.time ? `${label} à ${appt.time.slice(0, 5)}` : label;
          }

          const searchLower = clientSearch.toLowerCase();
          const visibleClients = clients
            .filter(c => {
              if (searchLower && !c.name?.toLowerCase().includes(searchLower)) return false;
              const count = c.reservationsCount || 0;
              if (clientFilter === 'new') return count < 3;
              if (clientFilter === 'loyal') return count >= 3;
              return true;
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

          return (
            <View style={{ paddingBottom: 16 }}>
              {/* Barre de recherche */}
              <View style={styles.clientSearchWrap}>
                <BlurView intensity={60} tint="light" style={styles.clientSearchBar}>
                  <Text style={{ fontSize: 15, color: 'rgba(28,28,30,0.28)' }}>🔍</Text>
                  <TextInput
                    style={styles.clientSearchInput}
                    placeholder="Rechercher une cliente..."
                    placeholderTextColor="rgba(28,28,30,0.35)"
                    value={clientSearch}
                    onChangeText={setClientSearch}
                  />
                  {clientSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setClientSearch('')}>
                      <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.3)' }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </BlurView>
              </View>

              {/* Filtres */}
              <View style={styles.clientFilterRow}>
                {[
                  { key: 'all', label: 'Toutes' },
                  { key: 'new', label: 'Nouvelles' },
                  { key: 'loyal', label: 'Fidèles' },
                ].map(f => (
                  <TouchableOpacity key={f.key}
                    style={[styles.clientFilterBtn, clientFilter === f.key && styles.clientFilterBtnActive]}
                    onPress={() => setClientFilter(f.key)}>
                    <Text style={[styles.clientFilterText, clientFilter === f.key && styles.clientFilterTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Liste */}
              <BlurView intensity={50} tint="light" style={styles.clientListCard}>
                {visibleClients.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)' }}>Aucune cliente</Text>
                  </View>
                ) : visibleClients.map((client, idx) => {
                  const count = client.reservationsCount || 0;
                  const isLoyal = count >= 3;
                  const isVip = count >= 5;
                  const nextAppt = upcomingByClient[client.id];
                  const nextLabel = fmtNextAppt(nextAppt);
                  return (
                    <TouchableOpacity key={client.id} activeOpacity={0.7}
                      style={[styles.clientCardRow, idx > 0 && styles.clientCardSep]}
                      onPress={() => navigation.navigate('PublicProfile', { client })}>
                      <View style={styles.clientCardAv}>
                        {client.avatar_url ? (
                          <Image source={{ uri: client.avatar_url }}
                            style={{ width: 52, height: 52, borderRadius: 26 }} resizeMode="cover" />
                        ) : (
                          <View style={styles.clientCardAvFallback}>
                            <Text style={styles.clientCardAvInitial}>{client.name?.[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.clientCardName}>{client.name}</Text>
                          {isVip && (
                            <View style={styles.vipBadge}>
                              <Text style={styles.vipBadgeText}>♥ VIP</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.clientCardSub}>
                          {isLoyal ? 'Fidèle' : 'Nouvelle'}{' · '}{count} réservation{count > 1 ? 's' : ''}
                        </Text>
                        {nextLabel ? (
                          <Text style={styles.clientCardNext}>Prochain RDV : {nextLabel}</Text>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 20, color: 'rgba(28,28,30,0.2)', marginLeft: 4 }}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </BlurView>
            </View>
          );
        })()}

        {/* ── BOUTIQUE ── */}
        {activeTab === 'Boutique' && (
          <View>
            <View style={styles.secRow}>
              <Text style={styles.secTitle}>🛍 Boutique</Text>
              <TouchableOpacity
                style={styles.manageShopBtn}
                onPress={() => navigation.navigate('ShopManagement', { salonId: salon?.id })}>
                <Text style={styles.manageShopBtnText}>Gérer les produits</Text>
              </TouchableOpacity>
            </View>

            {shopProducts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ fontSize: 36, marginBottom: 10 }}>🛍</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 }}>Aucun produit</Text>
                <TouchableOpacity
                  style={styles.addFirstProductBtn}
                  onPress={() => navigation.navigate('ShopManagement', { salonId: salon?.id })}>
                  <Text style={styles.addFirstProductBtnText}>+ Ajouter un produit</Text>
                </TouchableOpacity>
              </View>
            ) : shopProducts.map((p) => (
              <BlurView key={p.id} intensity={55} tint="light" style={styles.shopProductCard}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.shopProductImg} />
                ) : (
                  <View style={styles.shopProductImgPlaceholder}>
                    <Text style={{ fontSize: 22 }}>🛍</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopProductName}>{p.name}</Text>
                  {!!p.description && (
                    <Text style={styles.shopProductDesc} numberOfLines={1}>{p.description}</Text>
                  )}
                  <Text style={styles.shopProductPrice}>{parseFloat(p.price).toFixed(2)} €</Text>
                </View>
                <View style={[styles.shopAvailBadge, !p.is_available && styles.shopUnavailBadge]}>
                  <Text style={[styles.shopAvailText, !p.is_available && styles.shopUnavailText]}>
                    {p.is_available ? 'Dispo' : 'Indispo'}
                  </Text>
                </View>
              </BlurView>
            ))}
          </View>
        )}

      </ScrollView>}

      {activeTab === 'Clients' && (
        <TouchableOpacity
          style={styles.clientFab}
          activeOpacity={0.88}
          onPress={() => Alert.alert('Ajouter une cliente', 'Fonctionnalité à venir')}>
          <Text style={styles.clientFabText}>+ Cliente</Text>
        </TouchableOpacity>
      )}

      <PhotoViewer
        visible={selectedPhotoIndex !== null}
        photos={displayBookPhotos}
        initialIndex={selectedPhotoIndex ?? 0}
        onClose={() => setSelectedPhotoIndex(null)}
      />

      {/* TAB BAR */}
      <CoiffeuseTabBar active="BarberSalon" navigation={navigation} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 400, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  hero: { height: 200, position: 'relative' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2C1A06', alignItems: 'center', justifyContent: 'center' },
  heroBgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroBgEmoji: { fontSize: 70, opacity: 0.08 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.55)' },
  heroDots: { position: 'absolute', bottom: 80, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  heroDotActive: { backgroundColor: '#fff', width: 14 },
  gearBtnTop: { position: 'absolute', top: 14, right: 14, width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  heroContent: { position: 'absolute', bottom: 14, left: 14, right: 60, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  heroLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroLogoText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  heroName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroAddr: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroBadge: { backgroundColor: 'rgba(124,61,143,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  heroBadgeText: { fontSize: 9, color: '#7EE8A2', fontWeight: '600' },

  scoresRow: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)' },
  scoreCell: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  scoreCellBorder: { borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.5)' },
  scoreNum: { fontSize: 14, fontWeight: '800', color: '#A8852A' },
  scoreLbl: { fontSize: 9, color: 'rgba(28,28,30,0.55)', marginTop: 2 },

  tabs: { flexDirection: 'row', overflow: 'hidden', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)', marginBottom: 4, minWidth: '100%' },
  tab: { paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', position: 'relative' },
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
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayLabel: { fontSize: 13, color: 'rgba(28,28,30,0.6)' },
  dayHours: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  dayClosed: { color: 'rgba(192,57,43,0.6)' },
  accessRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  accessIcon: { fontSize: 16, width: 24 },
  accessText: { flex: 1, fontSize: 13, color: 'rgba(28,28,30,0.7)', lineHeight: 18 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  socialIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  socialHandle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  socialLabel: { fontSize: 11, color: 'rgba(28,28,30,0.4)' },

  kpiCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  kpiVal: { fontSize: 18, fontWeight: '800', color: '#A8852A' },
  kpiLbl: { fontSize: 10, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  teamCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  teamAv: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(168,133,42,0.15)', borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  teamAvImg: { width: 46, height: 46 },
  teamAvText: { fontSize: 14, fontWeight: '800', color: '#A8852A' },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  teamSpec: { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  teamNote: { fontSize: 11, color: '#A8852A', marginTop: 2 },
  teamBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  teamBadgeText: { fontSize: 10, fontWeight: '600' },

  editBtn: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.28)' },
  editBtnText: { fontSize: 12, color: '#A8852A', fontWeight: '600' },
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
  ratingCount: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 4 },

  barberPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  barberPillActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  barberPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.6)' },
  barberPillTextActive: { color: '#fff' },

  importBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  importBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  bookTabsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 10 },
  bookTabBtn: { flex: 1, padding: 9, borderRadius: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)', backgroundColor: 'rgba(255,255,255,0.5)' },
  bookTabBtnActive: { backgroundColor: 'rgba(28,28,30,0.88)', borderColor: 'rgba(28,28,30,0.88)' },
  bookTabText: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  bookTabTextActive: { color: '#fff' },

  bookGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bookCell: { width: '31%', aspectRatio: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: '#3A1A06', position: 'relative' },
  bookCellStats: { position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', gap: 3 },
  bookCellStatText: { fontSize: 8, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 4, paddingVertical: 1 },
  bookCellBarber: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 },
  bookCellBarberText: { fontSize: 8, color: '#fff', fontWeight: '600' },
  bookCellOptionLeft: { position: 'absolute', top: 5, left: 5, width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(0,113,227,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  bookCellOptionRight: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(192,57,43,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },

  clientSearchWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  clientSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  clientSearchInput: { flex: 1, fontSize: 14, color: '#1C1C1E' },
  clientFilterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  clientFilterBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(28,28,30,0.15)', backgroundColor: 'rgba(255,255,255,0.5)' },
  clientFilterBtnActive: { backgroundColor: '#fff', borderColor: '#7C3D8F' },
  clientFilterText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.55)' },
  clientFilterTextActive: { color: '#7C3D8F', fontWeight: '700' },
  clientListCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  clientCardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 14 },
  clientCardSep: { borderTopWidth: 0.5, borderTopColor: 'rgba(28,28,30,0.07)' },
  clientCardAv: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', flexShrink: 0 },
  clientCardAvFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center' },
  clientCardAvInitial: { fontSize: 20, fontWeight: '800', color: '#A8852A' },
  clientCardName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  clientCardSub: { fontSize: 12, color: 'rgba(28,28,30,0.5)' },
  clientCardNext: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  vipBadge: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.25)' },
  vipBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3D8F' },
  clientFab: { position: 'absolute', bottom: 82, right: 20, backgroundColor: '#7C3D8F', borderRadius: 28, paddingHorizontal: 20, paddingVertical: 14, shadowColor: '#7C3D8F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.38, shadowRadius: 16, elevation: 12 },
  clientFabText: { fontSize: 14, fontWeight: '800', color: '#fff' },

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

  manageShopBtn: { backgroundColor: 'rgba(0,113,227,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  manageShopBtnText: { fontSize: 11, color: '#0071E3', fontWeight: '600' },
  addFirstProductBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  addFirstProductBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  shopProductCard: { marginHorizontal: 16, marginBottom: 8, borderRadius: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  shopProductImg: { width: 60, height: 60, borderRadius: 11 },
  shopProductImgPlaceholder: { width: 60, height: 60, borderRadius: 11, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center' },
  shopProductName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  shopProductDesc: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 3 },
  shopProductPrice: { fontSize: 15, fontWeight: '800', color: '#A8852A', marginTop: 4 },
  shopAvailBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(124,61,143,0.12)', borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  shopAvailText: { fontSize: 10, fontWeight: '600', color: '#7C3D8F' },
  shopUnavailBadge: { backgroundColor: 'rgba(192,57,43,0.1)', borderColor: 'rgba(192,57,43,0.25)' },
  shopUnavailText: { color: '#C0392B' },

  // ── Prestations form ──
  prestFormCard: { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 16, marginBottom: 14, gap: 2 },
  prestFormTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E', marginBottom: 10 },
  formLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 10 },
  formInput: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 11, padding: 11, fontSize: 14, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  catChipActive: { backgroundColor: 'rgba(168,133,42,0.12)', borderColor: 'rgba(168,133,42,0.3)' },
  prestItemCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 15, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 13, marginBottom: 8, gap: 12 },
  prestItemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(168,133,42,0.12)', justifyContent: 'center', alignItems: 'center' },

  // ── Tab bar ──
  tabBarOuter:    { position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 18 },
  tabBarInner:    { borderRadius: 22, overflow: 'hidden', flexDirection: 'row', height: 54, alignItems: 'center', paddingHorizontal: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)' },
  tabItem:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill:        { alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 16, overflow: 'hidden', alignSelf: 'stretch', marginHorizontal: 3 },
  tabPillActive:  { backgroundColor: 'rgba(28,28,30,0.1)' },
  tabPillBlur:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tabImg:         { width: 22, height: 22, resizeMode: 'contain' },
  tabIcon:        { fontSize: 17 },
  tabLabel:       { fontSize: 10, fontWeight: '500', color: 'rgba(28,28,30,0.4)' },
  tabLabelActive: { color: '#1C1C1E', fontWeight: '700' },
  tabAvatar:      { width: 24, height: 24, borderRadius: 12 },
});

// ─── Vue profil indépendante ──────────────────────────────────────────────────

const INDEP_TABS = ['Infos', 'Prestations', 'Book'];

function IndependanteProfileView({ barber, services, prestations, bookPhotos, activeTab, setActiveTab, onAddBookPhoto, onDeleteBookPhoto, uploading, navigation }) {
  const specInfos = SPECIALITES.filter(sp => (barber?.specialites || []).includes(sp.id));
  const workModeLabels = { recoit: '🏠 Reçoit chez elle', domicile: '🚗 Se déplace chez toi', deplace: '📍 Se déplace partout' };

  function fmtSvcPrice(svc) {
    if (!svc.price_min && svc.price_min !== 0) return 'Sur devis';
    if (svc.price_type === 'range' && svc.price_max) return `${svc.price_min} – ${svc.price_max} €`;
    if (svc.price_type === 'from') return `À partir de ${svc.price_min} €`;
    if (svc.price_min === 0) return 'Gratuit';
    return `${svc.price_min} €`;
  }

  function fmtDur(min) {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* Header profil */}
      <View style={ip.header}>
        <View style={ip.avatarWrap}>
          {barber?.avatar_url
            ? <Image source={{ uri: barber.avatar_url }} style={ip.avatar} />
            : <View style={ip.avatarPlaceholder}><Text style={{ fontSize: 36 }}>💅</Text></View>}
        </View>
        <Text style={ip.name}>{barber?.nom_pro || barber?.name}</Text>
        {barber?.ville ? <Text style={ip.ville}>📍 {barber.ville}{barber?.intervention_zone ? `  ·  ${barber.intervention_zone}` : ''}</Text> : null}
        <View style={ip.statsRow}>
          <View style={ip.stat}><Text style={ip.statVal}>{services.length + prestations.length}</Text><Text style={ip.statLabel}>Prestations</Text></View>
          <View style={ip.statDiv} />
          <View style={ip.stat}><Text style={ip.statVal}>{bookPhotos.length}</Text><Text style={ip.statLabel}>Photos</Text></View>
          <View style={ip.statDiv} />
          <View style={ip.stat}><Text style={ip.statVal}>{barber?.rating ? barber.rating.toFixed(1) : '—'}</Text><Text style={ip.statLabel}>Note</Text></View>
        </View>
      </View>

      {/* Onglets */}
      <View style={ip.tabs}>
        {INDEP_TABS.map(t => (
          <TouchableOpacity key={t} style={[ip.tab, activeTab === t && ip.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[ip.tabTxt, activeTab === t && ip.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Onglet Infos */}
      {activeTab === 'Infos' && (
        <View style={ip.section}>
          {specInfos.length > 0 && (
            <BlurView intensity={55} tint="light" style={ip.card}>
              <Text style={ip.cardTitle}>Spécialités</Text>
              <View style={ip.chips}>
                {specInfos.map(sp => (
                  <View key={sp.id} style={[ip.chip, { borderColor: sp.color, backgroundColor: sp.color + '18' }]}>
                    <Text style={ip.chipEmoji}>{sp.emoji}</Text>
                    <Text style={[ip.chipTxt, { color: sp.color }]}>{sp.label}</Text>
                  </View>
                ))}
              </View>
            </BlurView>
          )}
          {(barber?.work_modes || []).length > 0 && (
            <BlurView intensity={55} tint="light" style={ip.card}>
              <Text style={ip.cardTitle}>Modes de travail</Text>
              <View style={{ gap: 8 }}>
                {(barber.work_modes || []).map(m => (
                  <Text key={m} style={ip.modeTxt}>{workModeLabels[m] || m}</Text>
                ))}
              </View>
            </BlurView>
          )}
          {barber?.instagram && (
            <BlurView intensity={55} tint="light" style={ip.card}>
              <Text style={ip.cardTitle}>Instagram</Text>
              <Text style={ip.modeTxt}>@{barber.instagram}</Text>
            </BlurView>
          )}
        </View>
      )}

      {/* Onglet Prestations */}
      {activeTab === 'Prestations' && (
        <View style={ip.section}>
          {(services.length === 0 && prestations.length === 0) && (
            <View style={ip.emptyWrap}>
              <Text style={ip.emptyIcon}>✂️</Text>
              <Text style={ip.emptyTxt}>Aucune prestation pour l'instant</Text>
            </View>
          )}
          {services.map(svc => (
            <BlurView key={svc.id} intensity={45} tint="light" style={ip.svcCard}>
              <View style={{ flex: 1 }}>
                <Text style={ip.svcName}>{svc.name}</Text>
                {svc.description ? <Text style={ip.svcDesc}>{svc.description}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={ip.svcPrice}>{fmtSvcPrice(svc)}</Text>
                {svc.duration_minutes ? <Text style={ip.svcDur}>{fmtDur(svc.duration_minutes)}</Text> : null}
              </View>
            </BlurView>
          ))}
        </View>
      )}

      {/* Onglet Book */}
      {activeTab === 'Book' && (
        <View style={ip.section}>
          <View style={ip.bookGrid}>
            {bookPhotos.map((photo, i) => (
              <TouchableOpacity key={photo.id} style={ip.bookItem} onLongPress={() => onDeleteBookPhoto(photo)}>
                <Image source={{ uri: photo.photo_url }} style={ip.bookImg} resizeMode="cover" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={ip.bookAdd} onPress={onAddBookPhoto} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#7C3D8F" /> : <><Text style={ip.bookAddIcon}>+</Text><Text style={ip.bookAddTxt}>Ajouter</Text></>}
            </TouchableOpacity>
          </View>
          {bookPhotos.length === 0 && (
            <Text style={ip.emptyTxt}>Appuie sur + pour ajouter tes premières photos</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const ip = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, paddingHorizontal: 20 },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#7C3D8F', padding: 2, marginBottom: 12 },
  avatar: { width: '100%', height: '100%', borderRadius: 44 },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: 44, backgroundColor: 'rgba(124,61,143,0.1)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  ville: { fontSize: 13, color: 'rgba(28,28,30,0.5)', marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  statLabel: { fontSize: 10, color: 'rgba(28,28,30,0.45)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDiv: { width: 1, height: 28, backgroundColor: 'rgba(28,28,30,0.12)' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 14, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  tabTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.4)' },
  tabTxtActive: { color: '#1C1C1E', fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  card: { borderRadius: 16, overflow: 'hidden', padding: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', gap: 10 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.45)', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, borderWidth: 1, gap: 5 },
  chipEmoji: { fontSize: 14 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  modeTxt: { fontSize: 14, color: '#1C1C1E', fontWeight: '500' },
  svcCard: { borderRadius: 14, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', gap: 12 },
  svcName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  svcDesc: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  svcPrice: { fontSize: 14, fontWeight: '800', color: '#7C3D8F' },
  svcDur: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookItem: { width: '31%', aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden' },
  bookImg: { width: '100%', height: '100%' },
  bookAdd: { width: '31%', aspectRatio: 4 / 5, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(124,61,143,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bookAddIcon: { fontSize: 22, color: '#7C3D8F', fontWeight: '700' },
  bookAddTxt: { fontSize: 11, color: '#7C3D8F', fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 36 },
  emptyTxt: { fontSize: 14, color: 'rgba(28,28,30,0.4)', textAlign: 'center' },
});
