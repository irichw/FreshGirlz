import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Alert, RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { colors } from './colors';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

const STATUS_CFG = {
  pending:   { label: 'En attente', color: '#E67E22', bg: 'rgba(230,126,34,0.1)', emoji: '⏳' },
  confirmed: { label: 'Confirmé',   color: colors.success, bg: 'rgba(46,158,91,0.1)', emoji: '✅' },
  done:      { label: 'Terminé',    color: colors.textMuted, bg: 'rgba(28,28,30,0.06)', emoji: '✓' },
  cancelled: { label: 'Annulé',     color: colors.error, bg: 'rgba(192,57,43,0.1)', emoji: '✕' },
};

const FILTER_TABS = ['Tous', 'En attente', 'Confirmés', 'Terminés'];
const FILTER_MAP = { 'Tous': null, 'En attente': 'pending', 'Confirmés': 'confirmed', 'Terminés': 'done' };

export default function CoiffeuseAgendaScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const [coiffeuseId, setCoiffeuseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Tous');

  useEffect(() => { loadCoiffeuse(); }, []);
  useEffect(() => { if (coiffeuseId) loadAppointments(); }, [coiffeuseId, activeFilter]);

  async function loadCoiffeuse() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('coiffeuses').select('id').eq('user_id', user.id).maybeSingle();
    setCoiffeuseId(data?.id);
  }

  async function loadAppointments() {
    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id, date_debut, date_fin, statut, notes, prix_final,
          prestations(nom, emoji, duree_min),
          clientes(name, avatar_url)
        `)
        .eq('coiffeuse_id', coiffeuseId)
        .order('date_debut', { ascending: false });

      const filterStatus = FILTER_MAP[activeFilter];
      if (filterStatus) query = query.eq('statut', filterStatus);

      const { data } = await query.limit(50);
      setAppointments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  }, [coiffeuseId, activeFilter]);

  async function updateStatus(id, status) {
    const label = status === 'confirmed' ? 'confirmer' : status === 'cancelled' ? 'annuler' : 'marquer terminé';
    Alert.alert(`Veux-tu ${label} ce RDV ?`, '', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        onPress: async () => {
          await supabase.from('appointments').update({ statut: status }).eq('id', id);
          loadAppointments();
        },
      },
    ]);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function formatTime(d) {
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // Grouper par date
  const grouped = appointments.reduce((acc, a) => {
    const key = new Date(a.date_debut).toDateString();
    if (!acc[key]) acc[key] = { date: a.date_debut, items: [] };
    acc[key].items.push(a);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
      </View>

      {/* FILTRES */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, activeFilter === t && styles.filterChipActive]}
            onPress={() => setActiveFilter(t)}>
            <Text style={[styles.filterText, activeFilter === t && styles.filterTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {loading && <View style={styles.empty}><Text style={styles.emptyText}>Chargement...</Text></View>}

        {!loading && Object.values(grouped).length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>Aucun rendez-vous</Text>
          </View>
        )}

        {!loading && Object.values(grouped).map(group => (
          <View key={group.date}>
            <Text style={styles.dateHeader}>{formatDate(group.date)}</Text>
            {group.items.map(appt => {
              const sc = STATUS_CFG[appt.statut] || STATUS_CFG.pending;
              return (
                <BlurView key={appt.id} intensity={50} tint="light" style={styles.apptCard}>
                  <View style={styles.timeCol}>
                    <Text style={styles.timeText}>{formatTime(appt.date_debut)}</Text>
                    {appt.date_fin && <Text style={styles.timeEnd}>{formatTime(appt.date_fin)}</Text>}
                  </View>

                  <View style={styles.apptInfo}>
                    <View style={styles.apptRow}>
                      <Text style={styles.clientName}>{appt.clientes?.name || 'Cliente'}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusText, { color: sc.color }]}>{sc.emoji} {sc.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.prestText}>
                      {appt.prestations?.emoji || '💆'} {appt.prestations?.nom || 'Prestation'}
                    </Text>
                    {appt.notes && (
                      <Text style={styles.notesText} numberOfLines={1}>{appt.notes}</Text>
                    )}
                    {appt.prix_final > 0 && (
                      <Text style={styles.prixText}>{appt.prix_final} €</Text>
                    )}

                    {/* Actions selon statut */}
                    {appt.statut === 'pending' && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.btnConfirm} onPress={() => updateStatus(appt.id, 'confirmed')}>
                          <Text style={styles.btnConfirmText}>✓ Confirmer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.btnDecline} onPress={() => updateStatus(appt.id, 'cancelled')}>
                          <Text style={styles.btnDeclineText}>✕ Refuser</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {appt.statut === 'confirmed' && (
                      <View style={styles.actions}>
                        <TouchableOpacity style={styles.btnDone} onPress={() => updateStatus(appt.id, 'done')}>
                          <Text style={styles.btnDoneText}>✓ Marquer terminé</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </BlurView>
              );
            })}
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CoiffeuseTabBar active="Agenda" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 16 },

  filterRow: { marginBottom: 8 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.08)' },
  filterChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },

  list: { padding: 20, paddingTop: 8 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
  emptyText: { fontSize: 15, color: colors.textMuted },

  dateHeader: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'capitalize', marginBottom: 8, marginTop: 8 },

  apptCard: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight, padding: 14, marginBottom: 10, gap: 12 },
  timeCol: { alignItems: 'center', minWidth: 52 },
  timeText: { fontSize: 16, fontWeight: '800', color: colors.primary },
  timeEnd: { fontSize: 10, color: colors.textMuted },
  apptInfo: { flex: 1, gap: 4 },
  apptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  prestText: { fontSize: 12, color: colors.textMuted },
  notesText: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  prixText: { fontSize: 14, fontWeight: '800', color: colors.secondary },

  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btnConfirm: { flex: 1, backgroundColor: 'rgba(46,158,91,0.12)', borderRadius: 10, padding: 8, alignItems: 'center' },
  btnConfirmText: { fontSize: 12, fontWeight: '700', color: colors.success },
  btnDecline: { backgroundColor: 'rgba(192,57,43,0.1)', borderRadius: 10, padding: 8, alignItems: 'center', paddingHorizontal: 14 },
  btnDeclineText: { fontSize: 12, fontWeight: '700', color: colors.error },
  btnDone: { flex: 1, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 8, alignItems: 'center' },
  btnDoneText: { fontSize: 12, fontWeight: '700', color: colors.primary },
});

