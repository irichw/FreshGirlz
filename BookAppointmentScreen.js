import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, Alert, TextInput
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

function buildTimeSlots(date) {
  const slots = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m > 0) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

function buildWeekDays() {
  const days = [];
  const today = new Date();
  const dow = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  for (let i = 0; i <= 13; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const iso = d.toISOString().split('T')[0];
    days.push({ day: dow[d.getDay()], num: String(d.getDate()).padStart(2, '0'), date: iso, today: i === 0 });
  }
  return days;
}

export default function BookAppointmentScreen({ navigation, route }) {
  const { barberId, isBarber } = route.params || {};
  const DAYS = buildWeekDays();

  const [selectedDate, setSelectedDate] = useState(DAYS[0].date);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [service, setService] = useState('');
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState(30);
  const [takenSlots, setTakenSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogue, setCatalogue] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [barberInfo, setBarberInfo] = useState(null);

  useEffect(() => {
    loadBarberInfo();
  }, [barberId]);

  useEffect(() => {
    if (barberId && selectedDate) loadTakenSlots(selectedDate);
  }, [barberId, selectedDate]);

  async function loadBarberInfo() {
    if (!barberId) return;
    const { data } = await supabase
      .from('coiffeuses')
      .select('id, name, salons(id, name)')
      .eq('id', barberId)
      .maybeSingle();
    if (data) setBarberInfo(data);

    // Load catalogue
    const salonId = data?.salons?.id;
    if (salonId) {
      const { data: services } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('name');
      setCatalogue(services || []);
    }

    // If barber side, prefill client as Coiffeuse himself
    if (isBarber) {
      setClientName(data?.name || '');
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase
          .from('clientes')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (client?.name) setClientName(client.name);
      }
    }
  }

  async function loadTakenSlots(date) {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    const { data } = await supabase
      .from('appointments')
      .select('scheduled_at, duration')
      .eq('barber_id', barberId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .in('status', ['pending', 'confirmed']);

    const taken = new Set();
    (data || []).forEach(appt => {
      const start = new Date(appt.scheduled_at);
      const slotCount = Math.ceil((appt.duration || 30) / 30);
      for (let i = 0; i < slotCount; i++) {
        const t = new Date(start.getTime() + i * 30 * 60000);
        const hh = String(t.getHours()).padStart(2, '0');
        const mm = String(t.getMinutes()).padStart(2, '0');
        taken.add(`${hh}:${mm}`);
      }
    });
    setTakenSlots([...taken]);
  }

  async function handleBook() {
    if (!selectedSlot) { Alert.alert('Choix requis', 'Sélectionne un créneau horaire.'); return; }
    if (!clientName.trim()) { Alert.alert('Nom requis', 'Indique le nom du client.'); return; }
    if (!selectedService && !service.trim()) { Alert.alert('Prestation requise', 'Choisis ou saisis une prestation.'); return; }

    setLoading(true);
    const [hh, mm] = selectedSlot.split(':').map(Number);
    const dateObj = new Date(`${selectedDate}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);

    let clientId = null;
    if (!isBarber) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: client } = await supabase.from('clientes').select('id').eq('user_id', user.id).maybeSingle();
        clientId = client?.id || null;
      }
    }

    const serviceLabel = selectedService?.name || service.trim();
    const dur = selectedService?.duration_minutes || duration;

    const { error } = await supabase.from('appointments').insert({
      barber_id: barberId,
      client_id: clientId,
      client_name: clientName.trim(),
      service: serviceLabel,
      scheduled_at: dateObj.toISOString(),
      duration: dur,
      status: isBarber ? 'confirmed' : 'pending',
      notes: notes.trim() || null,
    });

    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert(
        isBarber ? 'RDV créé ✓' : 'Demande envoyée ✓',
        isBarber
          ? `RDV confirmé pour ${clientName} à ${selectedSlot}.`
          : `Ta demande de RDV a été envoyée à ${barberInfo?.name}. Tu seras notifié(e) de la confirmation.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  }

  const slots = buildTimeSlots(selectedDate);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{isBarber ? 'Nouveau RDV' : 'Prendre RDV'}</Text>
            {barberInfo && <Text style={styles.headerSub}>chez {barberInfo.name} · {barberInfo.salons?.name}</Text>}
          </View>
        </View>

        {/* CHOISIR DATE */}
        <Text style={styles.sectionLabel}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 4 }}>
          {DAYS.map((d) => (
            <TouchableOpacity key={d.date}
              onPress={() => { setSelectedDate(d.date); setSelectedSlot(null); }}
              style={[styles.calDay, selectedDate === d.date && styles.calDayActive,
                d.today && selectedDate !== d.date && styles.calDayToday]}>
              <Text style={[styles.calDayLabel, selectedDate === d.date && styles.calDayLabelActive]}>{d.day}</Text>
              <Text style={[styles.calDayNum, selectedDate === d.date && styles.calDayNumActive]}>{d.num}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* CHOISIR CRÉNEAU */}
        <Text style={styles.sectionLabel}>Créneau horaire</Text>
        <View style={styles.slotsGrid}>
          {slots.map(slot => {
            const taken = takenSlots.includes(slot);
            const active = selectedSlot === slot;
            return (
              <TouchableOpacity key={slot}
                disabled={taken}
                onPress={() => setSelectedSlot(slot)}
                style={[styles.slotBtn,
                  active && styles.slotBtnActive,
                  taken && styles.slotBtnTaken]}>
                <Text style={[styles.slotText,
                  active && styles.slotTextActive,
                  taken && styles.slotTextTaken]}>{slot}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* PRESTATION */}
        <Text style={styles.sectionLabel}>Prestation</Text>
        {catalogue.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
            {catalogue.map(s => (
              <TouchableOpacity key={s.id}
                onPress={() => { setSelectedService(s); setService(s.name); setDuration(s.duration_minutes); }}
                style={[styles.serviceChip, selectedService?.id === s.id && styles.serviceChipActive]}>
                <Text style={[styles.serviceChipText, selectedService?.id === s.id && styles.serviceChipTextActive]}>
                  {s.name}
                </Text>
                <Text style={[styles.serviceChipSub, selectedService?.id === s.id && { color: 'rgba(255,255,255,0.7)' }]}>
                  {s.duration_minutes} min · {s.price}€
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <BlurView intensity={50} tint="light" style={[styles.inputCard, { marginHorizontal: 16 }]}>
            <TextInput
              style={styles.input}
              placeholder="Ex: Dégradé + barbe..."
              placeholderTextColor="rgba(28,28,30,0.35)"
              value={service}
              onChangeText={setService}
            />
          </BlurView>
        )}

        {/* NOM CLIENT */}
        <Text style={styles.sectionLabel}>Nom du client</Text>
        <BlurView intensity={50} tint="light" style={[styles.inputCard, { marginHorizontal: 16 }]}>
          <TextInput
            style={styles.input}
            placeholder="Prénom Nom"
            placeholderTextColor="rgba(28,28,30,0.35)"
            value={clientName}
            onChangeText={setClientName}
          />
        </BlurView>

        {/* NOTES */}
        <Text style={styles.sectionLabel}>Notes (optionnel)</Text>
        <BlurView intensity={50} tint="light" style={[styles.inputCard, { marginHorizontal: 16 }]}>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Précisions sur la coupe, allergie..."
            placeholderTextColor="rgba(28,28,30,0.35)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </BlurView>

        {/* RÉSUMÉ */}
        {selectedSlot && (
          <BlurView intensity={60} tint="light" style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Récapitulatif</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date & heure</Text>
              <Text style={styles.summaryVal}>{selectedDate} à {selectedSlot}</Text>
            </View>
            {(selectedService || service) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Prestation</Text>
                <Text style={styles.summaryVal}>{selectedService?.name || service}</Text>
              </View>
            )}
            {clientName ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Client</Text>
                <Text style={styles.summaryVal}>{clientName}</Text>
              </View>
            ) : null}
          </BlurView>
        )}

      </ScrollView>

      {/* CTA FIXE */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.ctaBtn, (!selectedSlot || loading) && { opacity: 0.5 }]}
          onPress={handleBook}
          disabled={!selectedSlot || loading}
          activeOpacity={0.85}>
          <Text style={styles.ctaBtnText}>
            {loading ? 'Réservation...' : isBarber ? '✓ Créer le RDV' : '📅 Envoyer la demande'}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -50, right: -50, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(168,133,42,0.16)' },
  blob2: { position: 'absolute', bottom: 100, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, paddingTop: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', flexShrink: 0 },
  backBtnText: { fontSize: 16, color: '#1C1C1E' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8, marginTop: 16 },

  calDay: { width: 52, borderRadius: 14, padding: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  calDayActive: { backgroundColor: '#A8852A', borderColor: '#A8852A' },
  calDayToday: { borderColor: 'rgba(168,133,42,0.4)', borderWidth: 1.5 },
  calDayLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase' },
  calDayLabelActive: { color: 'rgba(255,255,255,0.7)' },
  calDayNum: { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginTop: 2 },
  calDayNumActive: { color: '#fff' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 7 },
  slotBtn: { width: '22%', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  slotBtnActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  slotBtnTaken: { backgroundColor: 'rgba(28,28,30,0.06)', borderColor: 'rgba(28,28,30,0.08)' },
  slotText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  slotTextActive: { color: '#fff' },
  slotTextTaken: { color: 'rgba(28,28,30,0.25)', textDecorationLine: 'line-through' },

  serviceChip: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', minWidth: 100 },
  serviceChipActive: { backgroundColor: '#A8852A', borderColor: '#A8852A' },
  serviceChipText: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },
  serviceChipTextActive: { color: '#fff' },
  serviceChipSub: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 2 },

  inputCard: { borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  input: { padding: 13, fontSize: 14, color: '#1C1C1E' },

  summaryCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.25)' },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  summaryVal: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },

  ctaWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: 'rgba(255,250,238,0.92)' },
  ctaBtn: { backgroundColor: '#A8852A', borderRadius: 16, padding: 16, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

