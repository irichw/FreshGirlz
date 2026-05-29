import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image, RefreshControl, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { colors } from './colors';

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmé',   color: '#2E9E5B', bg: 'rgba(46,158,91,0.12)'  },
  pending:   { label: 'En attente', color: '#D4A843', bg: 'rgba(212,168,67,0.12)' },
  cancelled: { label: 'Annulé',     color: '#C0392B', bg: 'rgba(192,57,43,0.12)'  },
  completed: { label: 'Terminé',    color: '#7C3D8F', bg: 'rgba(124,61,143,0.12)' },
};

const TABS = ['À venir', 'Passés'];

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

export default function ReservationsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('À venir');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientId, setClientId] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAppointments();
    }, [activeTab])
  );

  useEffect(() => {
    loadAppointments();
  }, [activeTab]);

  async function loadAppointments(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); setRefreshing(false); return; }

    const { data: client } = await supabase
      .from('clientes').select('id').eq('user_id', session.user.id).maybeSingle();
    if (!client) { setLoading(false); setRefreshing(false); return; }
    setClientId(client.id);

    const now = new Date().toISOString();
    let query = supabase
      .from('appointments')
      .select(`
        id, date_debut, time, service, duration, status, statut, notes, prix_final,
        coiffeuse_id,
        coiffeuses:coiffeuse_id(id, name, nom_pro, photo_url, avatar_url,
          salons:salon_id(name, city, address))
      `)
      .eq('cliente_id', client.id);

    if (activeTab === 'À venir') {
      query = query
        .gte('date_debut', now)
        .in('status', ['confirmed', 'pending'])
        .order('date_debut', { ascending: true });
    } else {
      query = query
        .lt('date_debut', now)
        .order('date_debut', { ascending: false });
    }

    const { data } = await query.limit(30);
    setAppointments(data || []);
    setLoading(false);
    setRefreshing(false);
  }

  function RdvCard({ item }) {
    const coiff = item.coiffeuses;
    const rawStatus = item.status || item.statut || 'pending';
    const cfg = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.pending;
    const dateStr = fmtDate(item.date_debut);
    const timeStr = fmtTime(item.time || item.date_debut?.slice(11, 16));
    const salonName = coiff?.salons?.name;
    const coiffName = coiff?.nom_pro || coiff?.name || 'Coiffeuse';
    const photo = coiff?.photo_url || coiff?.avatar_url;

    return (
      <TouchableOpacity activeOpacity={0.88}
        onPress={() => navigation.navigate('BarberProfile', { barber: coiff || { id: item.coiffeuse_id } })}>
        <BlurView intensity={55} tint="light" style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardPhotoWrap}>
              {photo
                ? <Image source={{ uri: photo }} style={s.cardPhoto} resizeMode="cover" />
                : (
                  <View style={[s.cardPhoto, s.cardPhotoFallback]}>
                    <Text style={{ fontSize: 20 }}>✂️</Text>
                  </View>
                )}
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardCoiff} numberOfLines={1}>{coiffName}</Text>
              {salonName && <Text style={s.cardSalon} numberOfLines={1}>{salonName}</Text>}
              <Text style={s.cardService} numberOfLines={1}>{item.service || 'Prestation'}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
              <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          <View style={s.cardFooter}>
            <View style={s.footerItem}>
              <Text style={s.footerIcon}>📅</Text>
              <Text style={s.footerTxt}>{dateStr}</Text>
            </View>
            {timeStr && (
              <View style={s.footerItem}>
                <Text style={s.footerIcon}>🕐</Text>
                <Text style={s.footerTxt}>{timeStr}</Text>
              </View>
            )}
            {item.duration > 0 && (
              <View style={s.footerItem}>
                <Text style={s.footerIcon}>⏱</Text>
                <Text style={s.footerTxt}>{Math.floor(item.duration / 60) > 0 ? `${Math.floor(item.duration / 60)}h` : ''}{item.duration % 60 > 0 ? `${item.duration % 60}min` : ''}</Text>
              </View>
            )}
            {item.prix_final > 0 && (
              <View style={s.footerItem}>
                <Text style={s.footerIcon}>💶</Text>
                <Text style={s.footerTxt}>{item.prix_final}€</Text>
              </View>
            )}
          </View>

          {activeTab === 'À venir' && rawStatus === 'confirmed' && (
            <TouchableOpacity style={s.reserverBtn}
              onPress={() => navigation.navigate('BookAppointment', { barberId: item.coiffeuse_id })}>
              <Text style={s.reserverTxt}>Modifier / Annuler</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} />
        <View style={s.blob2} />
        <View style={s.blob3} />
      </View>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Réservations</Text>
      </View>

      {/* Onglets */}
      <View style={s.tabsRow}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab} style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : appointments.length === 0 ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTitle}>
            {activeTab === 'À venir' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
          </Text>
          <Text style={s.emptyDesc}>
            {activeTab === 'À venir' ? "Réserve avec une coiffeuse depuis l'accueil" : ''}
          </Text>
          {activeTab === 'À venir' && (
            <TouchableOpacity style={s.ctaBtn} onPress={() => navigation.navigate('Explorer')}>
              <Text style={s.ctaTxt}>Trouver une coiffeuse</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <RdvCard item={item} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAppointments(true)}
              colors={[colors.primary]} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(124,61,143,0.09)' },
  blob2: { position: 'absolute', top: 200, left: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(201,80,122,0.07)' },
  blob3: { position: 'absolute', bottom: 100, right: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(212,168,67,0.08)' },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },

  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  tab: {
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.88)',
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTxtActive: { color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },

  card: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)',
    padding: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cardPhotoWrap: {},
  cardPhoto: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.primary },
  cardPhotoFallback: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardCoiff: { fontSize: 15, fontWeight: '700', color: colors.dark },
  cardSalon: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  cardService: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  statusPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusTxt: { fontSize: 11, fontWeight: '700' },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, borderTopWidth: 0.5, borderTopColor: 'rgba(28,28,30,0.08)', paddingTop: 10 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerIcon: { fontSize: 12 },
  footerTxt: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  reserverBtn: {
    marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.primary,
    padding: 9, alignItems: 'center',
  },
  reserverTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.dark, textAlign: 'center', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  ctaBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 13 },
  ctaTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
