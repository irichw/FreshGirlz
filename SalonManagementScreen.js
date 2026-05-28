import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Switch, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { isWithinHours, todayDow } from './utils/hours';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const PLANS = {
  free: { label: 'Gratuit', color: '#1C1C1E', bg: 'rgba(28,28,30,0.08)', border: 'rgba(28,28,30,0.2)' },
  pro: { label: 'Pro', color: '#0071E3', bg: 'rgba(0,113,227,0.1)', border: 'rgba(0,113,227,0.3)' },
  premium: { label: 'Premium', color: '#A8852A', bg: 'rgba(168,133,42,0.12)', border: 'rgba(168,133,42,0.3)' },
};

export default function SalonManagementScreen({ navigation, route }) {
  const { salonId } = route.params;

  const [salon, setSalon] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [hours, setHours] = useState([]);
  const [invites, setInvites] = useState([]);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [salonPhotos, setSalonPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showBarberModal, setShowBarberModal] = useState(false);
  const [showSalonModal, setShowSalonModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showRenameCatModal, setShowRenameCatModal] = useState(false);
  const [showHoursModal, setShowHoursModal] = useState(false);
  const [editingHoursDayIndex, setEditingHoursDayIndex] = useState(null);
  const [editOpenTime, setEditOpenTime] = useState('09:00');
  const [editCloseTime, setEditCloseTime] = useState('19:00');
  const [renamingCat, setRenamingCat] = useState(null);
  const [renameCatName, setRenameCatName] = useState('');
  const [editingService, setEditingService] = useState(null);

  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceDuration, setServiceDuration] = useState('30');
  const [servicePrice, setServicePrice] = useState('');

  const [barberName, setBarberName] = useState('');
  const [barberSpecialty, setBarberSpecialty] = useState('');
  const [barberRole, setBarberRole] = useState('barber');

  const [salonName, setSalonName] = useState('');
  const [salonAddress, setSalonAddress] = useState('');
  const [salonPostalCode, setSalonPostalCode] = useState('');
  const [salonCity, setSalonCity] = useState('');
  const [salonDesc, setSalonDesc] = useState('');
  const [salonPhone, setSalonPhone] = useState('');
  const [salonInstagram, setSalonInstagram] = useState('');

  const [transport, setTransport] = useState('');
  const [parking, setParking] = useState('');
  const [pmr, setPmr] = useState(false);
  const [pmrDesc, setPmrDesc] = useState('');
  const [accessNotes, setAccessNotes] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadInvites() {
    const { data } = await supabase
      .from('salon_invites')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    setInvites(data || []);
  }

  function makeCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async function generateInviteCode() {
    setGeneratingInvite(true);
    try {
      const { data: barberMe } = await supabase
        .from('coiffeuses')
        .select('id')
        .eq('salon_id', salonId)
        .eq('role', 'manager')
        .maybeSingle();

      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error } = await supabase.from('salon_invites').insert({
        salon_id: salonId,
        code: makeCode(),
        created_by: barberMe?.id || null,
        expires_at: expires.toISOString(),
      });
      if (error) throw error;
      await loadInvites();
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function revokeInvite(id) {
    await supabase.from('salon_invites').update({ is_used: true }).eq('id', id);
    await loadInvites();
  }

  async function loadAll() {
    const [salonRes, servicesRes, barbersRes, hoursRes, catsRes, photosRes] = await Promise.all([
      supabase.from('salons').select('*').eq('id', salonId).single(),
      supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name'),
      supabase.from('coiffeuses').select('*').eq('salon_id', salonId),
      supabase.from('opening_hours').select('*').eq('salon_id', salonId).order('day_of_week'),
      supabase.from('service_categories').select('*').eq('salon_id', salonId).order('position'),
      supabase.from('salon_photos').select('*').eq('salon_id', salonId).order('position'),
    ]);
    if (photosRes.data) setSalonPhotos(photosRes.data);

    if (salonRes.data) {
      const s = salonRes.data;
      console.log('[SalonManagement] salon id:', s.id, '| description:', s.description);

      // Sync is_open avec les horaires du jour
      let computedOpen = s.is_open ?? false;
      if (s.id && hoursRes.data) {
        const todayRow = hoursRes.data.find(h => h.day_of_week === todayDow());
        if (todayRow) {
          const withinHours = isWithinHours(todayRow);
          if (withinHours !== computedOpen) {
            await supabase.from('salons').update({ is_open: withinHours }).eq('id', s.id);
            computedOpen = withinHours;
          }
        }
      }

      setSalon({ ...s, is_open: computedOpen });
      setSalonName(s.name || '');
      setSalonAddress(s.address || '');
      setSalonPostalCode(s.postal_code || '');
      setSalonCity(s.city || '');
      setSalonDesc(s.description || '');
      setSalonPhone(s.phone || '');
      setSalonInstagram(s.instagram || '');
      setTransport(s.transport || '');
      setParking(s.parking || '');
      setPmr(s.pmr || false);
      setPmrDesc(s.pmr_description || '');
      setAccessNotes(s.access_notes || '');
    }
    if (servicesRes.data) {
      console.log('[SalonManagement] services:', servicesRes.data.length);
      setServices(servicesRes.data);
    }
    if (catsRes.data) {
      console.log('[SalonManagement] categories:', catsRes.data.length, catsRes.data);
      setCategories(catsRes.data);
    }
    if (barbersRes.data) setcoiffeuses(barbersRes.data);
    await loadInvites();
    // Fusionne les lignes DB avec les défauts pour les 7 jours
    const dbHours = hoursRes.data || [];
    setHours(DAYS_FULL.map((_, i) => {
      const dbRow = dbHours.find(h => h.day_of_week === i);
      return dbRow || {
        salon_id: salonId,
        day_of_week: i,
        open_time: '09:00',
        close_time: '19:00',
        is_closed: i === 6,
      };
    }));
    setLoading(false);
  }

  async function pickAndUploadPhoto() {
    if (salonPhotos.length >= 5) { Alert.alert('Limite', '5 photos maximum.'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission refusée', "L'accès à la galerie est requis."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop().split('?')[0] || 'jpg';
      const position = salonPhotos.length;
      const fileName = `salon_${salonId}_${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadErr } = await supabase.storage
        .from('Photos')
        .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(fileName);
      const { data: inserted } = await supabase.from('salon_photos').insert({
        salon_id: salonId,
        photo_url: publicUrl,
        position,
      }).select().single();
      if (position === 0) await supabase.from('salons').update({ photo_url: publicUrl }).eq('id', salonId);
      if (inserted) setSalonPhotos(prev => [...prev, inserted]);
    } catch (err) {
      Alert.alert('Erreur upload', err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removeSalonPhoto(photo) {
    Alert.alert('Supprimer', 'Supprimer cette photo ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('salon_photos').delete().eq('id', photo.id);
        const updated = salonPhotos.filter(p => p.id !== photo.id);
        setSalonPhotos(updated);
        if (photo.position === 0 && updated.length > 0) {
          await supabase.from('salons').update({ photo_url: updated[0].photo_url }).eq('id', salonId);
        }
      }},
    ]);
  }

  async function toggleOption(field, value) {
    setSalon(prev => ({ ...prev, [field]: value }));
    await supabase.from('salons').update({ [field]: value }).eq('id', salonId);
  }

  function toggleBookingDay(dayIndex) {
    const current = salon?.booking_days || [0,1,2,3,4,5];
    const updated = current.includes(dayIndex)
      ? current.filter(d => d !== dayIndex)
      : [...current, dayIndex].sort();
    setSalon(prev => ({ ...prev, booking_days: updated }));
    supabase.from('salons').update({ booking_days: updated }).eq('id', salonId);
  }

  async function toggleDayClosed(dayIndex) {
    const snapshot = hours;
    const updated = hours.map(h =>
      h.day_of_week === dayIndex ? { ...h, is_closed: !h.is_closed } : h
    );
    setHours(updated);
    const day = updated.find(h => h.day_of_week === dayIndex);

    const payload = {
      salon_id: salonId,
      day_of_week: day.day_of_week,
      open_time: day.open_time || '09:00',
      close_time: day.close_time || '19:00',
      is_closed: day.is_closed,
    };
    if (day.id) payload.id = day.id;

    const { data, error } = await supabase
      .from('opening_hours')
      .upsert(payload, { onConflict: 'salon_id,day_of_week' })
      .select()
      .single();

    if (error) {
      console.log('[toggleDayClosed] error:', JSON.stringify(error));
      Alert.alert('Erreur sauvegarde', error.message);
      setHours(snapshot);
    } else if (data && !day.id) {
      setHours(prev => prev.map(h =>
        h.day_of_week === dayIndex ? { ...h, id: data.id } : h
      ));
    }
  }

  function openEditHours(dayIndex, h) {
    setEditingHoursDayIndex(dayIndex);
    setEditOpenTime(h.open_time?.slice(0, 5) || '09:00');
    setEditCloseTime(h.close_time?.slice(0, 5) || '19:00');
    setShowHoursModal(true);
  }

  async function saveHours() {
    if (editingHoursDayIndex === null) return;
    const updated = hours.map(h =>
      h.day_of_week === editingHoursDayIndex
        ? { ...h, open_time: editOpenTime, close_time: editCloseTime }
        : h
    );
    const day = updated.find(h => h.day_of_week === editingHoursDayIndex);

    const payload = {
      salon_id: salonId,
      day_of_week: editingHoursDayIndex,
      open_time: editOpenTime,
      close_time: editCloseTime,
      is_closed: day.is_closed ?? false,
    };
    if (day.id) payload.id = day.id;

    const { data, error } = await supabase
      .from('opening_hours')
      .upsert(payload, { onConflict: 'salon_id,day_of_week' })
      .select()
      .single();

    if (error) {
      console.log('[saveHours] error:', JSON.stringify(error));
      Alert.alert('Erreur sauvegarde', error.message);
      return;
    }

    setHours(updated.map(h =>
      h.day_of_week === editingHoursDayIndex ? { ...h, id: data.id } : h
    ));
    setShowHoursModal(false);
  }

  function openAddService() {
    setEditingService(null);
    setServiceName(''); setServiceDesc(''); setServiceDuration('30'); setServicePrice('');
    setShowServiceModal(true);
  }

  function openEditService(s) {
    setEditingService(s);
    setServiceName(s.name); setServiceDesc(s.description || '');
    setServiceDuration(String(s.duration_minutes)); setServicePrice(String(s.price));
    setShowServiceModal(true);
  }

  async function saveService() {
    if (!serviceName || !servicePrice) { alert('Nom et prix requis'); return; }
    const payload = {
      salon_id: salonId,
      name: serviceName,
      description: serviceDesc,
      duration_minutes: parseInt(serviceDuration) || 30,
      price: parseFloat(servicePrice) || 0,
      is_active: true,
    };
    if (editingService) {
      await supabase.from('services').update(payload).eq('id', editingService.id);
    } else {
      await supabase.from('services').insert(payload);
    }
    setShowServiceModal(false);
    loadAll();
  }

  async function deleteService(id) {
    if (Platform.OS === 'web') {
      if (!window.confirm('Supprimer cette prestation ?')) return;
    } else {
      Alert.alert('Supprimer', 'Supprimer cette prestation ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.from('services').update({ is_active: false }).eq('id', id);
          loadAll();
        }},
      ]);
      return;
    }
    await supabase.from('services').update({ is_active: false }).eq('id', id);
    loadAll();
  }

  async function renameCat() {
    if (!renameCatName.trim()) return;
    await supabase.from('service_categories').update({ name: renameCatName.trim() }).eq('id', renamingCat.id);
    setCategories(prev => prev.map(c => c.id === renamingCat.id ? { ...c, name: renameCatName.trim() } : c));
    setShowRenameCatModal(false);
    setRenamingCat(null);
  }

  async function addBarber() {
    if (!barberName) { alert('Nom requis'); return; }
    const { error } = await supabase.from('coiffeuses').insert({
      salon_id: salonId,
      name: barberName,
      specialty: barberSpecialty,
      role: barberRole,
      rating: 5.0,
    });
    if (error) {
      Alert.alert('Erreur ajout Coiffeuse', error.message);
      return;
    }
    setBarberName(''); setBarberSpecialty(''); setBarberRole('barber');
    setShowBarberModal(false);
    loadAll();
  }

  async function removeBarber(id) {
    if (Platform.OS === 'web') {
      if (!window.confirm('Retirer ce Coiffeuse ?')) return;
      await supabase.from('coiffeuses').delete().eq('id', id);
      loadAll();
    } else {
      Alert.alert('Retirer', 'Retirer ce Coiffeuse du salon ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: async () => {
          await supabase.from('coiffeuses').delete().eq('id', id);
          loadAll();
        }},
      ]);
    }
  }

  async function saveSalonInfo() {
    await supabase.from('salons').update({
      name: salonName,
      address: salonAddress,
      postal_code: salonPostalCode,
      city: salonCity,
      description: salonDesc,
      phone: salonPhone,
      instagram: salonInstagram,
    }).eq('id', salonId);
    setSalon(prev => ({ ...prev, name: salonName, address: salonAddress, postal_code: salonPostalCode, city: salonCity, description: salonDesc, phone: salonPhone, instagram: salonInstagram }));
    setShowSalonModal(false);
  }

  async function saveAll() {
    setSaving(true);
    await supabase.from('salons').update({
      name: salonName,
      address: salonAddress,
      postal_code: salonPostalCode,
      city: salonCity,
      description: salonDesc,
      phone: salonPhone,
      instagram: salonInstagram,
      transport,
      parking,
      pmr,
      pmr_description: pmrDesc,
      access_notes: accessNotes,
    }).eq('id', salonId);
    setSaving(false);
    navigation.goBack();
  }

  async function saveAccessInfo() {
    await supabase.from('salons').update({
      transport,
      parking,
      pmr,
      pmr_description: pmrDesc,
      access_notes: accessNotes,
    }).eq('id', salonId);
    setSalon(prev => ({ ...prev, transport, parking, pmr, pmr_description: pmrDesc, access_notes: accessNotes }));
    setShowAccessModal(false);
  }

  const plan = PLANS[salon?.subscription_plan || 'free'];

  if (loading) return (
    <SafeAreaView style={styles.safe}>
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
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestion du salon</Text>
          <Text style={styles.headerSub}>{salon?.name}</Text>
        </View>
        <View style={[styles.openBadge, { backgroundColor: salon?.is_open ? 'rgba(124,61,143,0.12)' : 'rgba(192,57,43,0.1)' }]}>
          <Text style={[styles.openBadgeText, { color: salon?.is_open ? '#7C3D8F' : '#C0392B' }]}>
            {salon?.is_open ? '● Ouvert' : '● Fermé'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 12 }}>

        {/* INFOS SALON */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🏪</Text>
            <Text style={styles.sectionTitle}>Infos du salon</Text>
            <TouchableOpacity onPress={() => setShowSalonModal(true)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionBody}>
            <Row label="Nom" value={salon?.name} />
            <Row label="Adresse" value={salon?.address || '—'} />
            <Row label="Code postal" value={salon?.postal_code || '—'} />
            <Row label="Ville" value={salon?.city || '—'} />
            <Row label="Description" value={salon?.description || '—'} />
            <Row label="Téléphone" value={salon?.phone || '—'} />
            <Row label="Instagram" value={salon?.instagram || '—'} last />
          </View>
        </BlurView>

        {/* PHOTOS */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📸</Text>
            <Text style={styles.sectionTitle}>Photos du salon</Text>
            <TouchableOpacity
              onPress={pickAndUploadPhoto}
              disabled={uploadingPhoto || salonPhotos.length >= 5}
              style={[styles.addBtn, (uploadingPhoto || salonPhotos.length >= 5) && { opacity: 0.4 }]}>
              <Text style={styles.addBtnText}>{uploadingPhoto ? '...' : '+ Ajouter'}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.sectionBody, { paddingBottom: 10 }]}>
            {salonPhotos.length === 0 ? (
              <Text style={styles.emptyText}>Aucune photo · appuie sur + pour en ajouter</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                {salonPhotos.map((p, i) => (
                  <View key={p.id} style={{ position: 'relative' }}>
                    <Image source={{ uri: p.photo_url }} style={{ width: 100, height: 80, borderRadius: 10 }} resizeMode="cover" />
                    {i === 0 && (
                      <View style={{ position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#fff' }}>Principale</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => removeSalonPhoto(p)}
                      style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <Text style={{ fontSize: 10, color: 'rgba(28,28,30,0.35)', marginTop: 8 }}>
              {salonPhotos.length}/5 · la première apparaît en haut de la page salon
            </Text>
          </View>
        </BlurView>

        {/* ACCÈS */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📍</Text>
            <Text style={styles.sectionTitle}>Comment m'y rendre</Text>
            <TouchableOpacity onPress={() => setShowAccessModal(true)} style={styles.editBtn}>
              <Text style={styles.editBtnText}>Modifier</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionBody}>
            <Row label="Transports" value={salon?.transport || '—'} />
            <Row label="Parking" value={salon?.parking || '—'} />
            <Row label="Accès PMR" value={salon?.pmr ? 'Oui' : 'Non'} />
            {salon?.pmr && <Row label="Détails PMR" value={salon?.pmr_description || '—'} />}
            <Row label="Notes" value={salon?.access_notes || '—'} last />
          </View>
        </BlurView>

        {/* HORAIRES */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🕐</Text>
            <Text style={styles.sectionTitle}>Horaires</Text>
          </View>
          <View style={styles.sectionBody}>
            {DAYS_FULL.map((day, i) => {
              const h = hours.find(x => x.day_of_week === i) || { is_closed: i === 6, open_time: '09:00', close_time: '19:00' };
              return (
                <View key={i} style={[styles.hoursRow, i === 6 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.hoursDay}>{day}</Text>
                  {h.is_closed ? (
                    <Text style={[styles.hoursTime, { color: 'rgba(28,28,30,0.3)', flex: 1 }]}>Fermé</Text>
                  ) : (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditHours(i, h)}>
                      <Text style={styles.hoursTime}>
                        {h.open_time?.slice(0,5)} – {h.close_time?.slice(0,5)}
                        <Text style={{ fontSize: 10, color: '#0071E3' }}> ✎</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Switch
                    value={!h.is_closed}
                    onValueChange={() => toggleDayClosed(i)}
                    trackColor={{ false: 'rgba(28,28,30,0.15)', true: '#7C3D8F' }}
                    thumbColor="#fff"
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
              );
            })}
          </View>
        </BlurView>

        {/* PRESTATIONS */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>✂</Text>
            <Text style={styles.sectionTitle}>Prestations</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ServicesManagement', { salonId })}
              style={styles.addBtn}>
              <Text style={styles.addBtnText}>Gérer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionBody}>
            {categories.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.catSectionLabel}>Catégories</Text>
                {categories.map((cat) => (
                  <View key={cat.id} style={styles.catRow}>
                    <Text style={styles.catRowName}>{cat.name}</Text>
                    <Text style={styles.catRowCount}>
                      {services.filter(s => s.category_id === cat.id).length} presta.
                    </Text>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => { setRenamingCat(cat); setRenameCatName(cat.name); setShowRenameCatModal(true); }}>
                      <Text style={{ fontSize: 14 }}>✎</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {services.length === 0 ? (
              <Text style={styles.emptyText}>Aucune prestation</Text>
            ) : services.slice(0, 3).map((s, i) => (
              <View key={s.id} style={[styles.serviceRow, i === Math.min(services.length, 3) - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <Text style={styles.serviceMeta}>{s.duration_minutes} min · {s.price}€</Text>
                </View>
              </View>
            ))}
            {services.length > 3 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ServicesManagement', { salonId })}
                style={{ paddingTop: 8 }}>
                <Text style={{ fontSize: 12, color: '#0071E3', textAlign: 'center' }}>
                  Voir les {services.length - 3} autres →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

        {/* EQUIPE */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>👥</Text>
            <Text style={styles.sectionTitle}>Équipe</Text>
            <TouchableOpacity onPress={() => setShowBarberModal(true)} style={styles.addBtn}>
              <Text style={styles.addBtnText}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionBody}>
            {barbers.map((b, i) => (
              <View key={b.id} style={[styles.barberRow, i === barbers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.barberAv}>
                  <Text style={styles.barberAvText}>{b.name?.[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.barberName}>{b.name}</Text>
                  <View style={[styles.roleBadge, b.role === 'manager' && styles.roleBadgeManager]}>
                    <Text style={[styles.roleText, b.role === 'manager' && styles.roleTextManager]}>
                      {b.role === 'manager' ? 'Gestionnaire' : 'Coiffeuse'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeBarber(b.id)}>
                  <Text style={{ color: '#C0392B', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </BlurView>

        {/* INVITATIONS */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🔑</Text>
            <Text style={styles.sectionTitle}>Codes d'invitation</Text>
            <TouchableOpacity
              onPress={generateInviteCode}
              disabled={generatingInvite}
              style={[styles.addBtn, generatingInvite && { opacity: 0.5 }]}>
              <Text style={styles.addBtnText}>{generatingInvite ? '...' : '+ Générer'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionBody}>
            {invites.length === 0 ? (
              <Text style={styles.emptyText}>Aucun code actif · génère-en un pour inviter un Coiffeuse</Text>
            ) : invites.map((inv, i) => {
              const exp = new Date(inv.expires_at);
              const daysLeft = Math.ceil((exp - Date.now()) / 86400000);
              return (
                <View key={inv.id} style={[styles.inviteRow, i === invites.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.inviteCodeBox}>
                    <Text style={styles.inviteCode}>{inv.code}</Text>
                  </View>
                  <Text style={styles.inviteExpiry}>
                    {daysLeft === 1 ? 'Expire demain' : `Expire dans ${daysLeft}j`}
                  </Text>
                  <TouchableOpacity onPress={() => revokeInvite(inv.id)}>
                    <Text style={{ color: '#C0392B', fontSize: 15 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={styles.inviteHint}>
              Valable 7 jours · un seul usage · partage le code au Coiffeuse lors de son inscription
            </Text>
          </View>
        </BlurView>

        {/* OPTIONS */}
        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚙</Text>
            <Text style={styles.sectionTitle}>Options</Text>
          </View>
          <View style={styles.sectionBody}>
            {[
              { label: 'Réservations', sub: 'Activer les réservations en ligne', field: 'bookings_enabled' },
              { label: 'File d\'attente', sub: 'Activer la file en direct', field: 'is_open' },
              { label: 'Afficher nb coupes', sub: 'Afficher le compteur de coupes réalisées', field: 'show_cuts_count' },
            ].map((opt, i) => (
              <View key={opt.field} style={[styles.optRow, i === 2 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.optLabel}>{opt.label}</Text>
                  <Text style={styles.optSub}>{opt.sub}</Text>
                </View>
                <Switch
                  value={!!salon?.[opt.field]}
                  onValueChange={(v) => toggleOption(opt.field, v)}
                  trackColor={{ false: 'rgba(28,28,30,0.15)', true: '#7C3D8F' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            ))}


            <View style={{ paddingTop: 12 }}>
              <Text style={styles.optLabel}>Jours de réservation</Text>
              <View style={styles.daysRow}>
                {DAYS.map((d, i) => {
                  const active = salon?.booking_days?.includes(i) ?? i < 6;
                  return (
                    <TouchableOpacity key={i}
                      style={[styles.dayBtn, active && styles.dayBtnActive]}
                      onPress={() => toggleBookingDay(i)}>
                      <Text style={[styles.dayBtnText, active && styles.dayBtnTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </BlurView>

        {/* BOUTIQUE — désactivée V1, réactiver en V2 */}
        {false && salon?.shop_enabled && (
          <BlurView intensity={55} tint="light" style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>🛍</Text>
              <Text style={styles.sectionTitle}>Boutique</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ShopManagement', { salonId })}
                style={styles.addBtn}>
                <Text style={styles.addBtnText}>Gérer les produits</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.sectionBody, { paddingVertical: 10 }]}>
              <Text style={{ fontSize: 12, color: 'rgba(28,28,30,0.5)', textAlign: 'center' }}>
                Ajoutez des produits que vos clients pourront commander depuis le salon.
              </Text>
            </View>
          </BlurView>
        )}


      </ScrollView>

      {/* BARRE ENREGISTRER */}
      <BlurView intensity={90} tint="light" style={styles.globalSaveBar}>
        <TouchableOpacity
          style={[styles.globalSaveBtn, saving && { opacity: 0.5 }]}
          onPress={saveAll}
          disabled={saving}>
          <Text style={styles.globalSaveBtnText}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Text>
        </TouchableOpacity>
      </BlurView>

      {/* MODAL INFOS SALON */}
      <Modal visible={showSalonModal} transparent animationType="slide" onRequestClose={() => setShowSalonModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Infos du salon</Text>
              <TouchableOpacity onPress={() => setShowSalonModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <FormField label="Nom" value={salonName} onChange={setSalonName} />
              <FormField label="Adresse" value={salonAddress} onChange={setSalonAddress} placeholder="12 rue de la Paix" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ width: 100 }}>
                  <FormField label="Code postal" value={salonPostalCode} onChange={setSalonPostalCode} placeholder="75001" keyboard="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <FormField label="Ville" value={salonCity} onChange={setSalonCity} placeholder="Paris" />
                </View>
              </View>
              <FormField label="Description" value={salonDesc} onChange={setSalonDesc} multiline />
              <FormField label="Téléphone" value={salonPhone} onChange={setSalonPhone} keyboard="phone-pad" />
              <FormField label="Instagram (@)" value={salonInstagram} onChange={setSalonInstagram} placeholder="@monsalon" />
              <TouchableOpacity style={styles.saveBtn} onPress={saveSalonInfo}>
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL ACCÈS */}
      <Modal visible={showAccessModal} transparent animationType="slide" onRequestClose={() => setShowAccessModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comment m'y rendre</Text>
              <TouchableOpacity onPress={() => setShowAccessModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <FormField label="Transports" value={transport} onChange={setTransport} placeholder="Ex: Métro ligne 13, arrêt Gabriel Péri" multiline />
              <FormField label="Parking" value={parking} onChange={setParking} placeholder="Ex: Parking gratuit rue de Valmy" multiline />
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>Accès PMR</Text>
                <View style={styles.roleRow}>
                  {[true, false].map(v => (
                    <TouchableOpacity key={String(v)}
                      style={[styles.roleBtn, pmr === v && styles.roleBtnActive]}
                      onPress={() => setPmr(v)}>
                      <Text style={[styles.roleBtnText, pmr === v && styles.roleBtnTextActive]}>
                        {v ? 'Oui' : 'Non'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {pmr && <FormField label="Détails PMR" value={pmrDesc} onChange={setPmrDesc} multiline placeholder="Ex: Rampe d'accès disponible" />}
              <FormField label="Notes libres" value={accessNotes} onChange={setAccessNotes} multiline placeholder="Autres informations utiles..." />
              <TouchableOpacity style={styles.saveBtn} onPress={saveAccessInfo}>
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL Coiffeuse */}
      <Modal visible={showBarberModal} transparent animationType="slide" onRequestClose={() => setShowBarberModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un Coiffeuse</Text>
              <TouchableOpacity onPress={() => setShowBarberModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <FormField label="Nom *" value={barberName} onChange={setBarberName} placeholder="Ex: Kevin J." />
              <FormField label="Spécialité" value={barberSpecialty} onChange={setBarberSpecialty} placeholder="Ex: Fade · Design · Barbe" />
              <Text style={styles.fieldLabel}>Rôle</Text>
              <View style={styles.roleRow}>
                {['barber', 'manager'].map(r => (
                  <TouchableOpacity key={r}
                    style={[styles.roleBtn, barberRole === r && styles.roleBtnActive]}
                    onPress={() => setBarberRole(r)}>
                    <Text style={[styles.roleBtnText, barberRole === r && styles.roleBtnTextActive]}>
                      {r === 'manager' ? 'Gestionnaire' : 'Coiffeuse'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={addBarber}>
                <Text style={styles.saveBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL RENOMMER CATÉGORIE */}
      <Modal visible={showRenameCatModal} transparent animationType="slide" onRequestClose={() => setShowRenameCatModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Renommer la catégorie</Text>
              <TouchableOpacity onPress={() => setShowRenameCatModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <FormField label="Nom *" value={renameCatName} onChange={setRenameCatName} placeholder="Ex: Coupe Homme" />
              <TouchableOpacity style={styles.saveBtn} onPress={renameCat}>
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL HORAIRES */}
      <Modal visible={showHoursModal} transparent animationType="slide" onRequestClose={() => setShowHoursModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Horaires — {editingHoursDayIndex !== null ? DAYS_FULL[editingHoursDayIndex] : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowHoursModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <FormField label="Ouverture (HH:MM)" value={editOpenTime} onChange={setEditOpenTime} placeholder="09:00" keyboard="numeric" />
              <FormField label="Fermeture (HH:MM)" value={editCloseTime} onChange={setEditCloseTime} placeholder="19:00" keyboard="numeric" />
              <TouchableOpacity style={styles.saveBtn} onPress={saveHours}>
                <Text style={styles.saveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL SERVICE */}
      <Modal visible={showServiceModal} transparent animationType="slide" onRequestClose={() => setShowServiceModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingService ? 'Modifier' : 'Nouvelle prestation'}</Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <FormField label="Nom *" value={serviceName} onChange={setServiceName} placeholder="Ex: Mid Fade" />
              <FormField label="Description" value={serviceDesc} onChange={setServiceDesc} multiline />
              <FormField label="Durée (min)" value={serviceDuration} onChange={setServiceDuration} keyboard="numeric" />
              <FormField label="Prix (€)" value={servicePrice} onChange={setServicePrice} keyboard="numeric" />
              <TouchableOpacity style={styles.saveBtn} onPress={saveService}>
                <Text style={styles.saveBtnText}>{editingService ? 'Enregistrer' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

function Row({ label, value, last }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function FormField({ label, value, onChange, placeholder, multiline, keyboard }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(28,28,30,0.3)"
        multiline={multiline}
        keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', bottom: 100, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(201,80,122,0.12)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  headerSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 1 },
  openBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  openBadgeText: { fontSize: 11, fontWeight: '600' },
  section: { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
  sectionBody: { padding: 14 },
  editBtn: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)' },
  editBtnText: { fontSize: 11, color: '#A8852A', fontWeight: '600' },
  addBtn: { backgroundColor: 'rgba(0,113,227,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  addBtnText: { fontSize: 11, color: '#0071E3', fontWeight: '600' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 12 },
  infoLabel: { fontSize: 12, color: 'rgba(28,28,30,0.45)', flex: 0.4 },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#1C1C1E', flex: 0.6, textAlign: 'right' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  hoursDay: { fontSize: 12, color: 'rgba(28,28,30,0.5)', width: 80 },
  hoursTime: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 8 },
  serviceName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  serviceMeta: { fontSize: 11, color: '#A8852A', marginTop: 2 },
  emptyText: { fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 8 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 10 },
  inviteCodeBox: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.3)' },
  inviteCode: { fontSize: 16, fontWeight: '800', color: '#7C3D8F', letterSpacing: 3 },
  inviteExpiry: { flex: 1, fontSize: 11, color: 'rgba(28,28,30,0.4)' },
  inviteHint: { fontSize: 11, color: 'rgba(28,28,30,0.35)', textAlign: 'center', marginTop: 8, lineHeight: 16 },
  barberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 10 },
  barberAv: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  barberAvText: { fontSize: 14, fontWeight: '800', color: '#A8852A' },
  barberName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 3 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(28,28,30,0.08)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.15)' },
  roleBadgeManager: { backgroundColor: 'rgba(168,133,42,0.12)', borderColor: 'rgba(168,133,42,0.3)' },
  roleText: { fontSize: 10, color: 'rgba(28,28,30,0.5)', fontWeight: '600' },
  roleTextManager: { color: '#A8852A' },
  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  optLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  optSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)' },
  daysRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  dayBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(28,28,30,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  dayBtnActive: { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.3)' },
  dayBtnText: { fontSize: 10, fontWeight: '600', color: 'rgba(28,28,30,0.4)' },
  dayBtnTextActive: { color: '#7C3D8F' },
  planBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5 },
  planBadgeText: { fontSize: 11, fontWeight: '700' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  planCard: { width: '47%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  planCardLabel: { fontSize: 10, color: 'rgba(28,28,30,0.5)', marginBottom: 3 },
  planCardVal: { fontSize: 14, fontWeight: '800', color: '#1C1C1E' },
  upgradeBtn: { backgroundColor: 'rgba(0,113,227,0.1)', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.25)' },
  upgradeBtnText: { fontSize: 13, fontWeight: '700', color: '#0071E3' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
  modalClose: { fontSize: 14, color: 'rgba(28,28,30,0.4)', padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 12, padding: 12, fontSize: 14, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleBtn: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  roleBtnActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  roleBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.05)', alignItems: 'center', justifyContent: 'center' },
  globalSaveBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, borderTopWidth: 0.5, borderTopColor: 'rgba(28,28,30,0.08)' },
  globalSaveBtn: { backgroundColor: '#1C1C1E', borderRadius: 16, padding: 16, alignItems: 'center' },
  globalSaveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  catSectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 8 },
  catRowName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  catRowCount: { fontSize: 11, color: 'rgba(28,28,30,0.4)' },
});
