import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

function isoDateStr(date) {
  return date.toISOString().split('T')[0];
}

function buildWeekDays() {
  const days = [];
  const today = new Date();
  const dow = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
  for (let i = -1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      day: dow[d.getDay()],
      num: String(d.getDate()).padStart(2, '0'),
      date: isoDateStr(d),
      today: i === 0,
    });
  }
  return days;
}

export default function AgendaScreen({ navigation }) {
  const DAYS = buildWeekDays();
  const todayStr = isoDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barberId, setBarberId] = useState(null);
  const [summary, setSummary] = useState({ total: 0, free: 0, inProgress: 0 });

  useEffect(() => {
    async function loadBarber() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('coiffeuses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.id) setBarberId(data.id);
    }
    loadBarber();
  }, []);

  const loadAppointments = useCallback(async (date) => {
    if (!barberId) return;
    setLoading(true);
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('barber_id', barberId)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .order('scheduled_at', { ascending: true });

    const appts = data || [];
    setAppointments(appts);
    setSummary({
      total: appts.length,
      free: 0,
      inProgress: appts.filter(a => a.status === 'confirmed' || a.status === 'pending').length,
    });
    setLoading(false);
  }, [barberId]);

  useEffect(() => {
    if (barberId) loadAppointments(selectedDate);
  }, [barberId, selectedDate]);

  function statusColor(s) {
    if (s === 'confirmed') return '#7C3D8F';
    if (s === 'pending') return '#A8852A';
    if (s === 'done') return 'rgba(28,28,30,0.3)';
    if (s === 'cancelled' || s === 'no_show') return '#C0392B';
    return 'rgba(28,28,30,0.15)';
  }

  function statusLabel(s) {
    if (s === 'confirmed') return '✓ Confirmé';
    if (s === 'pending') return '⏳ En attente';
    if (s === 'done') return '✓ Terminé';
    if (s === 'cancelled') return '✕ Annulé';
    if (s === 'no_show') return '✕ No-show';
    return '';
  }

  function formatTime(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function initials(name) {
    return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agenda</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('BookAppointment', { barberId, isBarber: true })}>
            <Text style={styles.addBtnText}>+ RDV</Text>
          </TouchableOpacity>
        </View>

        {/* CALENDRIER STRIP */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.calContent}>
          {DAYS.map((d) => (
            <TouchableOpacity key={d.date}
              onPress={() => setSelectedDate(d.date)}
              style={[styles.calDay,
                selectedDate === d.date && styles.calDayActive,
                d.today && selectedDate !== d.date && styles.calDayToday]}>
              <Text style={[styles.calDayLabel,
                selectedDate === d.date && styles.calDayLabelActive]}>
                {d.day}
              </Text>
              <Text style={[styles.calDayNum,
                selectedDate === d.date && styles.calDayNumActive]}>
                {d.num}
              </Text>
              {d.today && (
                <View style={styles.calDots}>
                  <View style={[styles.calDot, selectedDate === d.date && styles.calDotActive]} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* RÉSUMÉ DU JOUR */}
        <View style={styles.daySummary}>
          {[
            { num: String(summary.total), lbl: 'RDV', color: '#A8852A' },
            { num: String(summary.inProgress), lbl: 'Actifs', color: '#7C3D8F' },
          ].map((s) => (
            <BlurView key={s.lbl} intensity={55} tint="light" style={styles.summaryCard}>
              <Text style={[styles.summaryNum, { color: s.color }]}>{s.num}</Text>
              <Text style={styles.summaryLbl}>{s.lbl}</Text>
            </BlurView>
          ))}
        </View>

        {/* LISTE RDV */}
        {!loading && appointments.length === 0 ? (
          <BlurView intensity={45} tint="light" style={styles.emptyCard}>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>📅</Text>
            <Text style={styles.emptyTitle}>Aucun RDV ce jour</Text>
            <Text style={styles.emptySub}>Appuie sur "+ RDV" pour en créer un</Text>
          </BlurView>
        ) : (
          <View style={styles.timeline}>
            {appointments.map((appt, index) => (
              <View key={appt.id} style={styles.tlRow}>
                <Text style={styles.tlTime}>{formatTime(appt.scheduled_at)}</Text>

                <View style={styles.tlDotCol}>
                  <View style={[styles.tlDot, { backgroundColor: statusColor(appt.status) }]} />
                  {index < appointments.length - 1 && <View style={styles.tlLine} />}
                </View>

                <View style={styles.tlContent}>
                  <BlurView intensity={60} tint="light"
                    style={[styles.tlEvent, { borderColor: statusColor(appt.status) + '40' }]}>
                    <View style={styles.tlEventTop}>
                      <View style={styles.tlClientAv}>
                        <Text style={styles.tlClientAvText}>{initials(appt.client_name)}</Text>
                      </View>
                      <View style={styles.tlEventInfo}>
                        <Text style={styles.tlClientName}>{appt.client_name || 'Client'}</Text>
                        <Text style={styles.tlService}>
                          {appt.service || '—'} · {appt.duration} min
                        </Text>
                      </View>
                      <Text style={[styles.tlStatus, { color: statusColor(appt.status) }]}>
                        {statusLabel(appt.status)}
                      </Text>
                    </View>
                    {appt.notes ? (
                      <Text style={styles.tlNotes}>{appt.notes}</Text>
                    ) : null}
                    <View style={styles.tlActions}>
                      {appt.status === 'pending' && (
                        <TouchableOpacity
                          style={[styles.tlActionBtn, { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.3)' }]}
                          onPress={async () => {
                            await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appt.id);
                            loadAppointments(selectedDate);
                          }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3D8F' }}>✓ Confirmer</Text>
                        </TouchableOpacity>
                      )}
                      {(appt.status === 'confirmed' || appt.status === 'pending') && (
                        <TouchableOpacity
                          style={[styles.tlActionBtn, { backgroundColor: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.2)' }]}
                          onPress={async () => {
                            await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id);
                            loadAppointments(selectedDate);
                          }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#C0392B' }}>✕ Annuler</Text>
                        </TouchableOpacity>
                      )}
                      {appt.status === 'confirmed' && (
                        <TouchableOpacity
                          style={[styles.tlActionBtn, { backgroundColor: 'rgba(168,133,42,0.1)', borderColor: 'rgba(168,133,42,0.25)' }]}
                          onPress={async () => {
                            await supabase.from('appointments').update({ status: 'done' }).eq('id', appt.id);
                            loadAppointments(selectedDate);
                          }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#A8852A' }}>✂ Terminer</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </BlurView>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* TAB BAR */}
      <CoiffeuseTabBar active="Agenda" navigation={navigation} />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 350, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 16, color: '#1C1C1E' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.6 },
  addBtn: { backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  calContent: { paddingHorizontal: 16, gap: 6, paddingBottom: 12 },
  calDay: { width: 52, borderRadius: 14, padding: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  calDayActive: { backgroundColor: '#A8852A', borderColor: '#A8852A' },
  calDayToday: { borderColor: 'rgba(168,133,42,0.4)', borderWidth: 1.5 },
  calDayLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.3 },
  calDayLabelActive: { color: 'rgba(255,255,255,0.7)' },
  calDayNum: { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginTop: 2 },
  calDayNumActive: { color: '#fff' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 4 },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(168,133,42,0.5)' },
  calDotActive: { backgroundColor: 'rgba(255,255,255,0.7)' },

  daySummary: { paddingHorizontal: 16, flexDirection: 'row', gap: 6, marginBottom: 12 },
  summaryCard: { flex: 1, borderRadius: 13, overflow: 'hidden', padding: 9, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  summaryNum: { fontSize: 18, fontWeight: '800' },
  summaryLbl: { fontSize: 9, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  emptyCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  emptySub: { fontSize: 12, color: 'rgba(28,28,30,0.45)', textAlign: 'center' },
  emptyText: { textAlign: 'center', padding: 32, fontSize: 13, color: 'rgba(28,28,30,0.4)' },

  timeline: { paddingHorizontal: 16 },
  tlRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  tlTime: { width: 38, fontSize: 11, fontWeight: '500', color: 'rgba(28,28,30,0.45)', paddingTop: 12, textAlign: 'right' },
  tlDotCol: { width: 12, alignItems: 'center', paddingTop: 12 },
  tlDot: { width: 10, height: 10, borderRadius: 5 },
  tlLine: { width: 1, flex: 1, minHeight: 12, backgroundColor: 'rgba(28,28,30,0.08)', marginTop: 2 },
  tlContent: { flex: 1, paddingBottom: 10 },
  tlEvent: { borderRadius: 14, overflow: 'hidden', padding: 11, borderWidth: 0.5 },
  tlEventTop: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 8 },
  tlClientAv: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(168,133,42,0.15)', borderWidth: 1, borderColor: 'rgba(168,133,42,0.3)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tlClientAvText: { fontSize: 11, fontWeight: '700', color: '#A8852A' },
  tlEventInfo: { flex: 1 },
  tlClientName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  tlService: { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  tlStatus: { fontSize: 10, fontWeight: '600', flexShrink: 0 },
  tlNotes: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginBottom: 8, fontStyle: 'italic' },
  tlActions: { flexDirection: 'row', gap: 6 },
  tlActionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 0.5 },

});

