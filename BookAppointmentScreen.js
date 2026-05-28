import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, Alert, TextInput,
  Modal, Image, FlatList, ActivityIndicator, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtDur(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}
function fmtPrice(svc) {
  if (!svc) return '';
  const min = svc.price_min ?? svc.price;
  const max = svc.price_max;
  const type = svc.price_type || 'fixed';
  if (!min && min !== 0) return '';
  if (type === 'range' && max) return `${min}–${max}€`;
  if (type === 'from')         return `à partir de ${min}€`;
  return `${min}€`;
}
function localIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getMonthWeeks(year, month) {
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const weeks    = [];
  let week       = Array(startDow).fill(null);
  for (let day = 1; day <= last.getDate(); day++) {
    week.push(localIso(new Date(year, month, day)));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

const DOW   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9h → 18h
const REF_TABS = [
  { key: 'inspirations', label: '🔥 Inspirations' },
  { key: 'likes',        label: '♥ Likes' },
  { key: 'book',         label: '📚 Mon book' },
  { key: 'library',      label: '📷 Bibliothèque' },
];

// ════════════════════════════════════════════════════════════════════════════
export default function BookAppointmentScreen({ navigation, route }) {
  const { barberId: paramBarberId, isBarber } = route.params || {};

  const today    = new Date();
  const todayStr = localIso(today);

  const [resolvedBarberId, setResolvedBarberId] = useState(paramBarberId || null);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [service, setService]           = useState('');
  const [clientName, setClientName]     = useState('');
  const [notes, setNotes]               = useState('');
  const [duration, setDuration]         = useState(60);
  const [takenHours, setTakenHours]     = useState([]);
  const [unavailableDays, setUnavailableDays] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [catalogue, setCatalogue]       = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [barberInfo, setBarberInfo]     = useState(null);
  const [myClientId, setMyClientId]     = useState(null);

  // ── référence de coupe
  const [referenceUri, setReferenceUri]         = useState(null);   // URI affichée
  const [referenceIsLocal, setReferenceIsLocal] = useState(false);  // true = besoin d'upload
  const [refModalVisible, setRefModalVisible]   = useState(false);
  const [refTab, setRefTab]                     = useState('inspirations');
  const [refPhotos, setRefPhotos]               = useState([]);
  const [refLoading, setRefLoading]             = useState(false);

  useEffect(() => { loadBarberInfo(); }, []);

  useEffect(() => {
    if (resolvedBarberId) loadUnavailableDays(calYear, calMonth);
  }, [resolvedBarberId, calYear, calMonth]);

  useEffect(() => {
    if (resolvedBarberId && selectedDate) loadTakenHours(selectedDate);
  }, [resolvedBarberId, selectedDate]);

  useEffect(() => {
    if (refModalVisible && myClientId && refTab !== 'library') {
      loadRefPhotos(refTab);
    }
  }, [refModalVisible, refTab, myClientId]);

  // ── chargement coiffeuse & catalogue ──────────────────────────────────────
  async function loadBarberInfo() {
    let bid = paramBarberId;
    if (!bid && isBarber) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: coif } = await supabase
        .from('coiffeuses').select('id').eq('user_id', user.id).maybeSingle();
      bid = coif?.id;
      if (bid) setResolvedBarberId(bid);
    }
    if (!bid) return;

    const { data } = await supabase
      .from('coiffeuses')
      .select('id, name, user_id, salon_id, salons(id, name)')
      .eq('id', bid).maybeSingle();
    if (data) setBarberInfo(data);

    const salonId = data?.salon_id || data?.salons?.id;
    if (salonId) {
      const { data: svcs } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, price_type, price_min, price_max')
        .eq('salon_id', salonId).order('name');
      setCatalogue(svcs || []);
    }

    // Côté cliente : auto-remplir nom + charger clientId
    if (!isBarber) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase
          .from('clientes').select('id, name').eq('user_id', user.id).maybeSingle();
        if (client?.name) setClientName(client.name);
        if (client?.id)   setMyClientId(client.id);
      }
    }
  }

  // ── jours indisponibles ───────────────────────────────────────────────────
  async function loadUnavailableDays(year, month) {
    const start = localIso(new Date(year, month, 1));
    const end   = localIso(new Date(year, month + 1, 0));
    const { data } = await supabase
      .from('unavailable_days')
      .select('date')
      .eq('coiffeuse_id', resolvedBarberId)
      .gte('date', start)
      .lte('date', end);
    setUnavailableDays((data || []).map(r => r.date));
  }

  // ── heures déjà prises ────────────────────────────────────────────────────
  async function loadTakenHours(date) {
    if (!resolvedBarberId) return;
    const { data } = await supabase
      .from('appointments')
      .select('scheduled_at, duration')
      .eq('coiffeuse_id', resolvedBarberId)
      .gte('scheduled_at', new Date(date + 'T00:00:00').toISOString())
      .lte('scheduled_at', new Date(date + 'T23:59:59.999').toISOString())
      .in('status', ['pending', 'confirmed']);

    const taken = new Set();
    (data || []).forEach(appt => {
      const start  = new Date(appt.scheduled_at);
      const startH = start.getHours() + start.getMinutes() / 60;
      const endH   = startH + (appt.duration || 60) / 60;
      for (let h = 9; h <= 18; h++) {
        if (startH < h + 1 && endH > h) taken.add(h);
      }
    });
    setTakenHours([...taken]);
  }

  // ── navigation mois ───────────────────────────────────────────────────────
  function navigateMonth(delta) {
    let m = calMonth + delta, y = calYear;
    if (m < 0)  { m = 11; y--; }
    if (m > 11) { m = 0;  y++; }
    setCalMonth(m); setCalYear(y);
  }

  function selectDate(d) {
    if (!d) return;
    setSelectedDate(d);
    setSelectedSlot(null);
  }

  // ── référence : chargement photos selon l'onglet ──────────────────────────
  async function loadRefPhotos(tab) {
    if (!myClientId) return;
    setRefLoading(true);
    setRefPhotos([]);
    try {
      if (tab === 'inspirations') {
        const { data } = await supabase
          .from('coupe_inspirations')
          .select('coupes(id, photo_url, service)')
          .eq('client_id', myClientId)
          .limit(40);
        setRefPhotos((data || []).map(r => r.coupes).filter(c => c?.photo_url));
      } else if (tab === 'likes') {
        const { data } = await supabase
          .from('coupe_likes')
          .select('coupes(id, photo_url, service)')
          .eq('client_id', myClientId)
          .limit(40);
        setRefPhotos((data || []).map(r => r.coupes).filter(c => c?.photo_url));
      } else if (tab === 'book') {
        const { data } = await supabase
          .from('book_photos')
          .select('id, photo_url, service')
          .eq('client_id', myClientId)
          .order('created_at', { ascending: false })
          .limit(40);
        setRefPhotos((data || []).filter(p => p?.photo_url));
      }
    } finally {
      setRefLoading(false);
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorise l\'accès à la bibliothèque dans les réglages.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setRefModalVisible(false);
      // Légère pause pour laisser le modal se fermer avant de mettre à jour l'image
      setTimeout(() => {
        setReferenceUri(uri);
        setReferenceIsLocal(true);
      }, 150);
    }
  }

  function selectRefPhoto(photo) {
    setReferenceUri(photo.photo_url);
    setReferenceIsLocal(false);
    setRefModalVisible(false);
  }

  async function uploadReferencePhoto() {
    if (!referenceUri || !referenceIsLocal) return referenceUri;
    try {
      const ext      = referenceUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
      const filename = `references/${Date.now()}.${ext}`;
      const resp     = await fetch(referenceUri);
      const blob     = await resp.blob();
      const { data, error } = await supabase.storage
        .from('book-photos')
        .upload(filename, blob, { contentType: `image/${ext}`, upsert: false });
      if (error) { console.warn('Upload ref:', error.message); return null; }
      const { data: urlData } = supabase.storage.from('book-photos').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch (e) {
      console.warn('Upload ref exception:', e.message);
      return null;
    }
  }

  // ── création RDV ──────────────────────────────────────────────────────────
  async function handleBook() {
    if (selectedSlot === null) {
      Alert.alert('Heure requise', 'Sélectionne un créneau horaire.'); return;
    }
    if (isBarber && !clientName.trim()) {
      Alert.alert('Nom requis', 'Indique le nom du/de la cliente.'); return;
    }
    const bid = resolvedBarberId;
    if (!bid) {
      Alert.alert('Erreur', 'Coiffeuse non identifiée.'); return;
    }

    setLoading(true);

    const timeStr      = `${String(selectedSlot).padStart(2, '0')}:00`;
    const scheduled_at = new Date(`${selectedDate}T${timeStr}:00`).toISOString();

    let clientId           = null;
    let resolvedClientName = clientName.trim() || 'Cliente';

    if (!isBarber) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase
          .from('clientes').select('id, name').eq('user_id', user.id).maybeSingle();
        clientId = client?.id || null;
        if (client?.name) resolvedClientName = client.name;
      }
      if (!clientId) {
        setLoading(false);
        Alert.alert('Profil introuvable', 'Ton profil cliente est introuvable. Reconnecte-toi et réessaie.');
        return;
      }
    }

    // Upload référence si locale (depuis bibliothèque)
    let referenceUrl = null;
    if (referenceUri) {
      referenceUrl = await uploadReferencePhoto();
    }

    const serviceLabel = selectedService?.name || service.trim() || '—';
    const dur          = selectedService?.duration_minutes || duration;

    const { data: inserted, error } = await supabase.from('appointments').insert({
      coiffeuse_id:  bid,
      cliente_id:    clientId,
      client_name:   resolvedClientName,
      service:       serviceLabel,
      scheduled_at,
      time:          timeStr,
      duration:      dur,
      status:        isBarber ? 'confirmed' : 'pending',
      notes:         notes.trim() || null,
      reference_url: referenceUrl,
    }).select('id').single();

    setLoading(false);

    if (error) {
      Alert.alert('Erreur lors de la réservation', `${error.message}\nCode: ${error.code || '—'}`);
    } else {
      if (!isBarber) {
        // Notifie la coiffeuse
        const { data: barberUser } = await supabase
          .from('coiffeuses').select('user_id').eq('id', bid).maybeSingle();
        if (barberUser?.user_id) {
          const { error: notifErr } = await supabase.from('notifications').insert({
            recipient_user_id: barberUser.user_id,
            type:  'new_appointment',
            title: 'Nouveau rendez-vous 📅',
            body:  `${resolvedClientName} a demandé un RDV le ${selectedDate} à ${timeStr}`,
            data:  JSON.stringify({ screen: 'Agenda', appointment_id: inserted?.id }),
            read:  false,
          });
          if (notifErr) console.warn('Notification coiffeuse échouée:', notifErr.message);
        }
      }
      navigation.goBack();
    }
  }

  // ── rendu ─────────────────────────────────────────────────────────────────
  const weeks = getMonthWeeks(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth, 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    .replace(/^./, c => c.toUpperCase());

  const CELL_SIZE = (SCREEN_W - 40) / 3 - 4;

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={st.wallpaper}>
        <View style={st.blob1} /><View style={st.blob2} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}>

        {/* ── HEADER ── */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Text style={st.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>{isBarber ? 'Nouveau RDV' : 'Prendre RDV'}</Text>
            {barberInfo && (
              <Text style={st.headerSub}>
                {barberInfo.name}{barberInfo.salons?.name ? ` · ${barberInfo.salons.name}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* ── CALENDRIER ── */}
        <View style={st.calWrap}>
          <View style={st.calNav}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={st.navBtn}>
              <Text style={st.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={st.calMonthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => navigateMonth(+1)} style={st.navBtn}>
              <Text style={st.navArrow}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={st.calHeaderRow}>
            {DOW.map(d => <Text key={d} style={st.calHeaderTxt}>{d}</Text>)}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi} style={st.calRow}>
              {week.map((d, di) => {
                if (!d) return <View key={di} style={st.calCell} />;
                const isPast     = d < todayStr;
                const isUnavail  = unavailableDays.includes(d);
                const isSelected = d === selectedDate;
                const isToday    = d === todayStr;
                const disabled   = isPast || isUnavail;
                const num        = parseInt(d.split('-')[2], 10);
                return (
                  <TouchableOpacity key={d}
                    disabled={disabled}
                    onPress={() => selectDate(d)}
                    style={[
                      st.calCell,
                      isSelected && st.calCellActive,
                      isToday    && !isSelected && st.calCellToday,
                      isUnavail  && st.calCellUnavail,
                      isPast     && !isUnavail && st.calCellPast,
                    ]}>
                    <Text style={[
                      st.calNum,
                      isSelected && st.calNumActive,
                      isToday    && !isSelected && st.calNumToday,
                      isUnavail  && st.calNumUnavail,
                      isPast     && !isUnavail && st.calNumPast,
                    ]}>{num}</Text>
                    {isUnavail && <Text style={st.calUnavailLine}>✕</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* ── LÉGENDE ── */}
        <View style={st.legend}>
          {[
            { bg: '#7C3D8F',                   label: 'Sélectionné' },
            { bg: 'rgba(192,57,43,0.18)',       label: 'Indisponible' },
            { bg: 'rgba(28,28,30,0.1)',         label: 'Passé' },
          ].map(({ bg, label }) => (
            <View key={label} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: bg }]} />
              <Text style={st.legendTxt}>{label}</Text>
            </View>
          ))}
        </View>

        {/* ── CRÉNEAUX HORAIRES ── */}
        <Text style={st.sectionLabel}>Heure du rendez-vous</Text>
        {unavailableDays.includes(selectedDate) ? (
          <View style={st.unavailNotice}>
            <Text style={st.unavailNoticeTxt}>🔒 La coiffeuse est indisponible ce jour</Text>
          </View>
        ) : (
          <View style={st.hoursGrid}>
            {HOURS.map(h => {
              const taken  = takenHours.includes(h);
              const active = selectedSlot === h;
              return (
                <TouchableOpacity key={h}
                  disabled={taken}
                  onPress={() => setSelectedSlot(h)}
                  style={[st.hourBtn, active && st.hourBtnActive, taken && st.hourBtnTaken]}>
                  <Text style={[st.hourTxt, active && st.hourTxtActive, taken && st.hourTxtTaken]}>
                    {String(h).padStart(2,'0')}h
                  </Text>
                  {taken && <Text style={st.hourTakenSub}>pris</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── PRESTATION ── */}
        <Text style={st.sectionLabel}>Prestation</Text>
        {catalogue.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
            {catalogue.map(svc => (
              <TouchableOpacity key={svc.id}
                onPress={() => {
                  setSelectedService(svc);
                  setService(svc.name);
                  setDuration(svc.duration_minutes || 60);
                }}
                style={[st.serviceChip, selectedService?.id === svc.id && st.serviceChipActive]}>
                <Text style={[st.serviceChipTxt, selectedService?.id === svc.id && st.serviceChipTxtActive]}>
                  {svc.name}
                </Text>
                <Text style={[st.serviceChipSub, selectedService?.id === svc.id && { color: 'rgba(255,255,255,0.7)' }]}>
                  {fmtDur(svc.duration_minutes)}{fmtPrice(svc) ? ` · ${fmtPrice(svc)}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[st.inputCard, { marginHorizontal: 16 }]}>
            <TextInput style={st.input}
              placeholder="Ex: Knotless braids, Locks..."
              placeholderTextColor="rgba(28,28,30,0.35)"
              value={service} onChangeText={setService} />
          </View>
        )}

        {/* ── DURÉE ── */}
        {!selectedService && (
          <>
            <Text style={st.sectionLabel}>Durée estimée</Text>
            <View style={st.durationRow}>
              {[30, 60, 90, 120, 180, 240, 300, 360].map(d => (
                <TouchableOpacity key={d} onPress={() => setDuration(d)}
                  style={[st.durationBtn, duration === d && st.durationBtnActive]}>
                  <Text style={[st.durationTxt, duration === d && st.durationTxtActive]}>
                    {fmtDur(d)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── NOM (coiffeuse seulement) ── */}
        {isBarber && (
          <>
            <Text style={st.sectionLabel}>Nom de la cliente</Text>
            <View style={[st.inputCard, { marginHorizontal: 16 }]}>
              <TextInput style={st.input}
                placeholder="Prénom Nom"
                placeholderTextColor="rgba(28,28,30,0.35)"
                value={clientName} onChangeText={setClientName} />
            </View>
          </>
        )}

        {/* ── NOTES ── */}
        <Text style={st.sectionLabel}>Notes (optionnel)</Text>
        <View style={[st.inputCard, { marginHorizontal: 16 }]}>
          <TextInput style={[st.input, { minHeight: 60 }]}
            placeholder="Précisions sur la coupe, couleur souhaitée..."
            placeholderTextColor="rgba(28,28,30,0.35)"
            value={notes} onChangeText={setNotes} multiline />
        </View>

        {/* ── RÉFÉRENCE DE COUPE ── */}
        <Text style={st.sectionLabel}>Référence de coupe (optionnel)</Text>
        <View style={{ marginHorizontal: 16 }}>
          {referenceUri ? (
            <View style={st.refPreviewWrap}>
              <Image source={{ uri: referenceUri }} style={st.refPreviewImg} resizeMode="cover" />
              <View style={st.refPreviewOverlay}>
                <TouchableOpacity style={st.refChangeBtn} onPress={() => setRefModalVisible(true)}>
                  <Text style={st.refChangeBtnTxt}>Changer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.refRemoveBtn} onPress={() => { setReferenceUri(null); setReferenceIsLocal(false); }}>
                  <Text style={st.refRemoveBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={st.refLabel}>
                <Text style={st.refLabelTxt}>📎 Référence ajoutée</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={st.refAddBtn} onPress={() => setRefModalVisible(true)}>
              <Text style={st.refAddIcon}>📎</Text>
              <Text style={st.refAddTxt}>Ajouter une référence</Text>
              <Text style={st.refAddSub}>Inspirations · Likes · Book · Bibliothèque</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── RÉCAPITULATIF ── */}
        {selectedSlot !== null && (
          <View style={st.summaryCard}>
            <Text style={st.summaryTitle}>Récapitulatif</Text>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Date</Text>
              <Text style={st.summaryVal}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase())}
              </Text>
            </View>
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Heure</Text>
              <Text style={st.summaryVal}>{String(selectedSlot).padStart(2,'0')}h00</Text>
            </View>
            {(selectedService || service) && (
              <View style={st.summaryRow}>
                <Text style={st.summaryLabel}>Prestation</Text>
                <Text style={st.summaryVal}>{selectedService ? selectedService.name : service}</Text>
              </View>
            )}
            <View style={st.summaryRow}>
              <Text style={st.summaryLabel}>Durée</Text>
              <Text style={st.summaryVal}>
                {selectedService ? fmtDur(selectedService.duration_minutes) : fmtDur(duration)}
              </Text>
            </View>
            {referenceUri && (
              <View style={st.summaryRow}>
                <Text style={st.summaryLabel}>Référence</Text>
                <Text style={st.summaryVal}>📎 Photo jointe</Text>
              </View>
            )}
            {isBarber && clientName ? (
              <View style={st.summaryRow}>
                <Text style={st.summaryLabel}>Cliente</Text>
                <Text style={st.summaryVal}>{clientName}</Text>
              </View>
            ) : null}
          </View>
        )}

      </ScrollView>

      {/* ── CTA ── */}
      <View style={st.ctaWrap}>
        <TouchableOpacity
          style={[st.ctaBtn, (selectedSlot === null || loading || unavailableDays.includes(selectedDate)) && { opacity: 0.5 }]}
          onPress={handleBook}
          disabled={selectedSlot === null || loading || unavailableDays.includes(selectedDate)}
          activeOpacity={0.85}>
          <Text style={st.ctaBtnText}>
            {loading ? 'Enregistrement...' : isBarber ? '✓ Créer le RDV' : '📅 Envoyer la demande'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ MODAL RÉFÉRENCE ══ */}
      <Modal
        visible={refModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRefModalVisible(false)}>
        <SafeAreaView style={st.refModal}>
          <View style={st.refModalHeader}>
            <Text style={st.refModalTitle}>Choisir une référence</Text>
            <TouchableOpacity onPress={() => setRefModalVisible(false)} style={st.refModalClose}>
              <Text style={st.refModalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Onglets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10, alignItems: 'center' }}>
            {REF_TABS.map(tab => (
              <TouchableOpacity key={tab.key}
                style={[st.refTabBtn, refTab === tab.key && st.refTabBtnActive]}
                onPress={() => setRefTab(tab.key)}>
                <Text style={[st.refTabTxt, refTab === tab.key && st.refTabTxtActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Contenu */}
          {refTab === 'library' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 8 }}>
                Ouvrir la bibliothèque
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.5)', textAlign: 'center', marginBottom: 24 }}>
                Sélectionne une photo depuis ton appareil
              </Text>
              <TouchableOpacity style={st.refLibBtn} onPress={pickFromLibrary}>
                <Text style={st.refLibBtnTxt}>Choisir une photo</Text>
              </TouchableOpacity>
            </View>
          ) : refLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#7C3D8F" />
            </View>
          ) : refPhotos.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>
                {refTab === 'inspirations' ? '🔥' : refTab === 'likes' ? '♥' : '📚'}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 }}>
                Aucune photo ici
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center' }}>
                {refTab === 'inspirations' ? 'Sauvegarde des inspirations depuis le feed' :
                 refTab === 'likes' ? 'Aime des coupes depuis le feed' :
                 'Ajoute des photos à ton book depuis ton profil'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={refPhotos}
              keyExtractor={item => String(item.id)}
              numColumns={3}
              contentContainerStyle={{ padding: 4, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectRefPhoto(item)}
                  style={{ width: CELL_SIZE, height: CELL_SIZE, margin: 2, borderRadius: 10, overflow: 'hidden', backgroundColor: '#2C1A06' }}>
                  <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  {item.service && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 3 }}>
                      <Text style={{ fontSize: 8, color: '#fff', fontWeight: '600' }} numberOfLines={1}>{item.service}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  safe:      { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1:     { position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(168,133,42,0.16)' },
  blob2:     { position: 'absolute', bottom: 100, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  header:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, paddingTop: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', flexShrink: 0 },
  backBtnText:  { fontSize: 16, color: '#1C1C1E' },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSub:    { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  calWrap:       { marginHorizontal: 16, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.95)', padding: 14 },
  calNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn:        { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  navArrow:      { fontSize: 26, color: '#1C1C1E', lineHeight: 30 },
  calMonthLabel: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  calHeaderRow:  { flexDirection: 'row', marginBottom: 6 },
  calHeaderTxt:  { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.35)', textTransform: 'uppercase', letterSpacing: 0.3 },
  calRow:        { flexDirection: 'row', marginBottom: 2 },
  calCell:       { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, minHeight: 38, justifyContent: 'center' },
  calCellActive: { backgroundColor: '#7C3D8F' },
  calCellToday:  { backgroundColor: 'rgba(124,61,143,0.1)' },
  calCellUnavail:{ backgroundColor: 'rgba(192,57,43,0.06)' },
  calCellPast:   { opacity: 0.3 },
  calNum:        { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  calNumActive:  { color: '#fff', fontWeight: '800' },
  calNumToday:   { color: '#7C3D8F', fontWeight: '800' },
  calNumUnavail: { color: '#C0392B', textDecorationLine: 'line-through', opacity: 0.6 },
  calNumPast:    { color: 'rgba(28,28,30,0.3)' },
  calUnavailLine:{ fontSize: 8, color: '#C0392B', lineHeight: 10 },

  legend:      { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 6, marginBottom: 2 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendTxt:   { fontSize: 10, color: 'rgba(28,28,30,0.45)', fontWeight: '500' },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 10, marginTop: 18 },

  unavailNotice:    { marginHorizontal: 16, backgroundColor: 'rgba(192,57,43,0.07)', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.18)' },
  unavailNoticeTxt: { fontSize: 13, color: '#C0392B', fontWeight: '600', textAlign: 'center' },

  hoursGrid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
  hourBtn:        { width: '18%', borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.95)' },
  hourBtnActive:  { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  hourBtnTaken:   { backgroundColor: 'rgba(28,28,30,0.04)', borderColor: 'rgba(28,28,30,0.07)' },
  hourTxt:        { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  hourTxtActive:  { color: '#fff' },
  hourTxtTaken:   { color: 'rgba(28,28,30,0.22)', textDecorationLine: 'line-through' },
  hourTakenSub:   { fontSize: 8, color: 'rgba(28,28,30,0.25)', marginTop: 2 },

  serviceChip:          { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', minWidth: 110 },
  serviceChipActive:    { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  serviceChipTxt:       { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },
  serviceChipTxtActive: { color: '#fff' },
  serviceChipSub:       { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 2 },

  durationRow:       { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 7 },
  durationBtn:       { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  durationBtnActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  durationTxt:       { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  durationTxtActive: { color: '#fff' },

  inputCard: { borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 0.5, borderColor: 'rgba(200,200,220,0.6)' },
  input:     { padding: 13, fontSize: 14, color: '#1C1C1E' },

  // Référence
  refAddBtn:     { borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(124,61,143,0.25)', borderStyle: 'dashed', padding: 18, alignItems: 'center', backgroundColor: 'rgba(124,61,143,0.04)' },
  refAddIcon:    { fontSize: 24, marginBottom: 6 },
  refAddTxt:     { fontSize: 14, fontWeight: '700', color: '#7C3D8F', marginBottom: 3 },
  refAddSub:     { fontSize: 11, color: 'rgba(28,28,30,0.4)' },
  refPreviewWrap:    { borderRadius: 14, overflow: 'hidden', height: 180 },
  refPreviewImg:     { width: '100%', height: '100%' },
  refPreviewOverlay: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  refChangeBtn:      { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refChangeBtnTxt:   { fontSize: 12, color: '#fff', fontWeight: '600' },
  refRemoveBtn:      { backgroundColor: 'rgba(192,57,43,0.75)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  refRemoveBtnTxt:   { fontSize: 12, color: '#fff', fontWeight: '700' },
  refLabel:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 6 },
  refLabelTxt:       { fontSize: 11, color: '#fff', fontWeight: '600', textAlign: 'center' },

  summaryCard:  { marginHorizontal: 16, marginTop: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', padding: 14, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)' },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(28,28,30,0.06)' },
  summaryLabel: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  summaryVal:   { fontSize: 12, fontWeight: '600', color: '#1C1C1E', maxWidth: '65%', textAlign: 'right' },

  ctaWrap:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: 'rgba(250,244,248,0.96)' },
  ctaBtn:     { backgroundColor: '#7C3D8F', borderRadius: 16, padding: 16, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Modal référence
  refModal:       { flex: 1, backgroundColor: '#FAF4F8' },
  refModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  refModalTitle:  { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  refModalClose:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center' },
  refModalCloseTxt: { fontSize: 13, color: '#1C1C1E' },
  refTabBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  refTabBtnActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  refTabTxt:       { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.55)' },
  refTabTxtActive: { color: '#fff' },
  refLibBtn:       { backgroundColor: '#7C3D8F', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  refLibBtnTxt:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
