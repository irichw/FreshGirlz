import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Alert, RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { colors } from './colors';

const STATUS_CONFIG = {
  pending:   { label: 'En attente',  color: '#E67E22', bg: 'rgba(230,126,34,0.1)',  emoji: '⏳' },
  confirmed: { label: 'Confirmé',    color: colors.success, bg: 'rgba(46,158,91,0.1)', emoji: '✅' },
  done:      { label: 'Terminé',     color: colors.textMuted, bg: 'rgba(28,28,30,0.06)', emoji: '✓' },
  cancelled: { label: 'Annulé',      color: colors.error, bg: 'rgba(192,57,43,0.1)', emoji: '✕' },
  no_show:   { label: 'Absent(e)',   color: colors.error, bg: 'rgba(192,57,43,0.1)', emoji: '👻' },
};

const TABS = ['À venir', 'Passés'];

export default function AppointmentsScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { loadAppointments(); }, []);

  async function loadAppointments() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clienteRow } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!clienteRow) return;

      const { data } = await supabase
        .from('appointments')
        .select(`
          id, date_debut, date_fin, statut, notes, prix_final,
          prestations(nom, categorie, emoji),
          coiffeuses(id, name, avatar_url, adresse)
        `)
        .eq('cliente_id', clienteRow.id)
        .order('date_debut', { ascending: false });

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
  }, []);

  async function cancelAppointment(id) {
    Alert.alert(
      'Annuler ce rendez-vous ?',
      "Cette action est irréversible.",
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('appointments').update({ statut: 'cancelled' }).eq('id', id);
            loadAppointments();
          },
        },
      ]
    );
  }

  const now = new Date();
  const upcoming = appointments.filter(a =>
    ['pending', 'confirmed'].includes(a.statut) && new Date(a.date_debut) >= now
  );
  const past = appointments.filter(a =>
    a.statut === 'done' || a.statut === 'cancelled' || a.statut === 'no_show' ||
    (['pending', 'confirmed'].includes(a.statut) && new Date(a.date_debut) < now)
  );
  const displayed = activeTab === 0 ? upcoming : past;

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Mes Rendez-vous</Text>
        <View style={styles.tabRow}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {t}
              </Text>
              {i === 0 && upcoming.length > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{upcoming.length}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {loading && (
          <View style={styles.empty}><Text style={styles.emptyText}>Chargement...</Text></View>
        )}

        {!loading && displayed.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{activeTab === 0 ? '📅' : '🗂️'}</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 0 ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
            </Text>
            {activeTab === 0 && (
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => navigation.navigate('Home')}>
                <Text style={styles.bookBtnText}>Trouver une coiffeuse →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {displayed.map(appt => {
          const sc = STATUS_CONFIG[appt.statut] || STATUS_CONFIG.pending;
          const canCancel = ['pending', 'confirmed'].includes(appt.statut) && new Date(appt.date_debut) > now;
          return (
            <BlurView key={appt.id} intensity={55} tint="light" style={styles.card}>
              {/* Date */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{formatDate(appt.date_debut)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.color }]}>
                    {sc.emoji} {sc.label}
                  </Text>
                </View>
              </View>

              {/* Heure + prestation */}
              <View style={styles.cardBody}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeText}>{formatTime(appt.date_debut)}</Text>
                  {appt.date_fin && (
                    <Text style={styles.timeEnd}>→ {formatTime(appt.date_fin)}</Text>
                  )}
                </View>
                <View style={styles.prestBlock}>
                  <Text style={styles.prestNom}>
                    {appt.prestations?.emoji || '💆'} {appt.prestations?.nom || 'Prestation'}
                  </Text>
                  {appt.coiffeuses?.name && (
                    <Text style={styles.prestCoiff}>avec {appt.coiffeuses.name}</Text>
                  )}
                  {appt.coiffeuses?.adresse && (
                    <Text style={styles.prestAddr} numberOfLines={1}>📍 {appt.coiffeuses.adresse}</Text>
                  )}
                </View>
              </View>

              {/* Prix */}
              {appt.prix_final > 0 && (
                <Text style={styles.prix}>{appt.prix_final} €</Text>
              )}

              {/* Notes */}
              {appt.notes && (
                <Text style={styles.notes} numberOfLines={2}>{appt.notes}</Text>
              )}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => appt.coiffeuses?.id && navigation.navigate('CoiffeusePublic', { id: appt.coiffeuses.id })}>
                  <Text style={styles.viewBtnText}>Voir la coiffeuse</Text>
                </TouchableOpacity>
                {canCancel && (
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => cancelAppointment(appt.id)}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: { padding: 20, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark, marginBottom: 16 },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 14, padding: 3, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.dark },
  badge: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  list: { padding: 20, paddingTop: 0 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMuted, marginBottom: 20 },
  emptyText: { fontSize: 15, color: colors.textMuted },
  bookBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  card: { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: 14, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardDate: { fontSize: 13, fontWeight: '700', color: colors.dark, textTransform: 'capitalize' },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  cardBody: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  timeBlock: { alignItems: 'center', minWidth: 60 },
  timeText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  timeEnd: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  prestBlock: { flex: 1, gap: 3 },
  prestNom: { fontSize: 15, fontWeight: '700', color: colors.dark },
  prestCoiff: { fontSize: 12, color: colors.textMuted },
  prestAddr: { fontSize: 11, color: colors.textMuted },

  prix: { fontSize: 16, fontWeight: '800', color: colors.secondary, marginBottom: 6 },
  notes: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  viewBtn: { flex: 1, backgroundColor: colors.primaryLight, borderRadius: 12, padding: 10, alignItems: 'center' },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  cancelBtn: { backgroundColor: 'rgba(192,57,43,0.1)', borderRadius: 12, padding: 10, alignItems: 'center', paddingHorizontal: 16 },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.error },
});

