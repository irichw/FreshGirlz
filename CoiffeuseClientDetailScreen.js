import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, Alert, Linking
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { getFreshLevel } from './freshScore';
import FreshScoreRing from './FreshScoreRing';

export default function CoiffeuseClientDetailScreen({ route, navigation }) {
  const { client: initialClient, barberId, barberName } = route.params;

  const [client, setClient] = useState(initialClient);
  const [allCuts, setAllCuts] = useState([]);
  const [cutsHere, setCutsHere] = useState([]);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const clientId = initialClient?.id;
    if (!clientId) { setLoading(false); return; }

    const [
      { data: fullClient },
      { data: allCutsData },
      { data: cutsHereData },
      { data: reviewData },
    ] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('queue').select('id, service, updated_at, barber_id')
        .eq('client_id', clientId).eq('status', 'done')
        .order('updated_at', { ascending: false }),
      supabase.from('queue').select('id, service, updated_at')
        .eq('client_id', clientId).eq('barber_id', barberId).eq('status', 'done')
        .order('updated_at', { ascending: false }),
      supabase.from('reviews').select('*')
        .eq('client_id', clientId).eq('barber_id', barberId).maybeSingle(),
    ]);

    if (fullClient) setClient(fullClient);
    setAllCuts(allCutsData || []);
    setCutsHere(cutsHereData || []);
    setReview(reviewData);
    setLoading(false);
  }

  // ── Stats calculées ──────────────────────────────────────────────
  const totalCuts = allCuts.length;
  const cutsHereCount = cutsHere.length;
  const lastVisitAll = allCuts[0]?.updated_at;
  const lastVisitHere = cutsHere[0]?.updated_at;
  const firstVisitHere = cutsHere.length ? cutsHere[cutsHere.length - 1].updated_at : null;
  const loyaltyRate = totalCuts > 0 ? Math.round((cutsHereCount / totalCuts) * 100) : 0;

  function calcFrequency() {
    if (allCuts.length < 2) return null;
    const dates = allCuts.map(c => new Date(c.updated_at)).sort((a, b) => b - a);
    let totalDays = 0;
    for (let i = 0; i < dates.length - 1; i++) {
      totalDays += (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
    }
    return Math.round(totalDays / (dates.length - 1));
  }
  const freqDays = calcFrequency();

  function favoriteService() {
    if (!cutsHere.length) return null;
    const counts = {};
    cutsHere.forEach(c => { if (c.service) counts[c.service] = (counts[c.service] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  const favService = favoriteService();

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateShort(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  const level = getFreshLevel(client?.fresh_score || 0);
  const initials = client?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  // ── Actions marketing ────────────────────────────────────────────
  async function sendReminder() {
    const { data: tokenRow } = await supabase
      .from('clientes').select('push_token').eq('id', client.id).maybeSingle();
    if (!tokenRow?.push_token) {
      Alert.alert('Pas de token push', 'Ce client n\'a pas activé les notifications.');
      return;
    }
    Alert.alert(
      'Envoyer un rappel',
      `Envoyer un rappel de coupe à ${client.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: async () => {
          await supabase.from('notifications').insert({
            recipient_user_id: client.user_id,
            type: 'reminder',
            title: `C'est l'heure de te couper ! ✂`,
            body: `${barberName} pense à toi — viens te rafraîchir !`,
            read: false,
          });
          Alert.alert('Rappel envoyé ✓');
        }},
      ]
    );
  }

  async function requestReview() {
    if (review) { Alert.alert('Déjà noté', `${client.name} a déjà laissé un avis.`); return; }
    Alert.alert(
      'Demander un avis',
      `Envoyer une demande d'avis à ${client.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: async () => {
          await supabase.from('notifications').insert({
            recipient_user_id: client.user_id,
            type: 'review_request',
            title: `Comment s'est passée ta coupe ? ⭐`,
            body: `Laisse un avis à ${barberName} — ça l'aide beaucoup !`,
            read: false,
          });
          Alert.alert('Demande envoyée ✓');
        }},
      ]
    );
  }

  function createOffer() {
    Alert.alert(
      '🎁 Créer une offre',
      'Fonctionnalité à venir — les offres personnalisées seront disponibles prochainement.',
      [{ text: 'OK' }]
    );
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.wallpaper} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} /><View style={s.blob2} /><View style={s.blob3} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnText}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Fiche client</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* HERO */}
        <BlurView intensity={60} tint="light" style={s.heroCard}>
          <View style={s.av}>
            {client?.avatar_url
              ? <Image source={{ uri: client.avatar_url }} style={{ width: 64, height: 64, borderRadius: 18 }} resizeMode="cover" />
              : <Text style={s.avText}>{initials}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{client?.name || '—'}</Text>
            <Text style={s.heroSub}>
              Client depuis {client?.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}
            </Text>
            <View style={s.heroTags}>
              {client?.hair_type && <View style={s.chip}><Text style={s.chipText}>{client.hair_type}</Text></View>}
              {client?.face_shape && <View style={s.chip}><Text style={s.chipText}>{client.face_shape}</Text></View>}
              {loyaltyRate >= 50 && <View style={[s.chip, s.chipGold]}><Text style={[s.chipText, { color: '#A8852A' }]}>⭐ Fidèle</Text></View>}
              {loyaltyRate === 100 && <View style={[s.chip, s.chipGold]}><Text style={[s.chipText, { color: '#A8852A' }]}>💎 Exclusif</Text></View>}
            </View>
          </View>
          <View style={s.heroScore}>
            <FreshScoreRing score={client?.fresh_score || 0} color={level.color} size={44} />
          </View>
        </BlurView>

        {/* STATS GRID */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>📊 Statistiques</Text>
        </View>
        <View style={s.statsGrid}>
          {[
            { label: 'Coupes total', value: totalCuts, color: '#1C1C1E', sub: 'tous coiffeuses' },
            { label: 'Coupes ici', value: cutsHereCount, color: '#7C3D8F', sub: `chez ${barberName?.split(' ')[0]}` },
            { label: 'Fidélité', value: `${loyaltyRate}%`, color: loyaltyRate >= 70 ? '#A8852A' : '#1C1C1E', sub: 'coupes ici / total' },
            { label: 'Fréquence', value: freqDays ? `~${freqDays}j` : '—', color: '#0071E3', sub: 'entre chaque coupe' },
            { label: 'Dernière visite', value: lastVisitHere ? fmtDateShort(lastVisitHere) : '—', color: '#1C1C1E', sub: 'chez toi' },
            { label: 'Première visite', value: firstVisitHere ? fmtDateShort(firstVisitHere) : '—', color: '#1C1C1E', sub: 'chez toi' },
          ].map((stat, i) => (
            <BlurView key={stat.label} intensity={55} tint="light"
              style={[s.statCard, i % 3 !== 2 && { marginRight: 6 }]}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statSub}>{stat.sub}</Text>
            </BlurView>
          ))}
        </View>

        {/* SERVICE FAVORI */}
        {favService && (
          <BlurView intensity={55} tint="light" style={s.favServiceCard}>
            <Text style={{ fontSize: 20 }}>✂</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.favServiceTitle}>Service favori chez toi</Text>
              <Text style={s.favServiceValue}>{favService}</Text>
            </View>
            <View style={[s.chip, s.chipGreen]}>
              <Text style={[s.chipText, { color: '#7C3D8F' }]}>{cutsHere.filter(c => c.service === favService).length}×</Text>
            </View>
          </BlurView>
        )}

        {/* PROFIL CAPILLAIRE */}
        {(client?.hair_type || client?.face_shape || client?.preferences?.length) && (
          <View>
            <View style={s.secRow}>
              <Text style={s.secTitle}>💈 Profil capillaire</Text>
            </View>
            <BlurView intensity={55} tint="light" style={s.profileCard}>
              {client?.hair_type && (
                <View style={s.profileRow}>
                  <Text style={s.profileLabel}>Type de cheveux</Text>
                  <Text style={s.profileValue}>{client.hair_type}</Text>
                </View>
              )}
              {client?.face_shape && (
                <View style={s.profileRow}>
                  <Text style={s.profileLabel}>Forme du visage</Text>
                  <Text style={s.profileValue}>{client.face_shape}</Text>
                </View>
              )}
              {client?.preferences?.length > 0 && (
                <View style={[s.profileRow, { borderBottomWidth: 0, flexWrap: 'wrap', gap: 5 }]}>
                  <Text style={[s.profileLabel, { width: '100%', marginBottom: 4 }]}>Préférences</Text>
                  {client.preferences.map(p => (
                    <View key={p} style={s.chip}><Text style={s.chipText}>{p}</Text></View>
                  ))}
                </View>
              )}
            </BlurView>
          </View>
        )}

        {/* HISTORIQUE ICI */}
        {cutsHere.length > 0 && (
          <View>
            <View style={s.secRow}>
              <Text style={s.secTitle}>🗓 Historique chez toi</Text>
              <Text style={s.secSub}>{cutsHere.length} visites</Text>
            </View>
            {cutsHere.slice(0, 5).map((cut, i) => (
              <BlurView key={cut.id} intensity={50} tint="light" style={s.cutCard}>
                <View style={[s.cutDot, i === 0 && s.cutDotActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cutService}>{cut.service || 'Coupe'}</Text>
                  <Text style={s.cutDate}>{fmtDate(cut.updated_at)}</Text>
                </View>
                {i === 0 && (
                  <View style={s.cutBadge}><Text style={s.cutBadgeText}>Dernière</Text></View>
                )}
              </BlurView>
            ))}
          </View>
        )}

        {/* AVIS LAISSÉ */}
        {review && (
          <View>
            <View style={s.secRow}>
              <Text style={s.secTitle}>⭐ Avis laissé</Text>
            </View>
            <BlurView intensity={55} tint="light" style={s.reviewCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 18, color: '#A8852A' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(28,28,30,0.4)' }}>{fmtDate(review.created_at)}</Text>
              </View>
              {review.comment && <Text style={s.reviewText}>"{review.comment}"</Text>}
            </BlurView>
          </View>
        )}

        {/* ACTIONS MARKETING */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>📣 Actions marketing</Text>
        </View>
        <View style={s.actionsGrid}>
          <TouchableOpacity style={[s.actionBtn, s.actionBlue]} onPress={sendReminder}>
            <Text style={s.actionIcon}>📲</Text>
            <Text style={[s.actionTitle, { color: '#0071E3' }]}>Rappel push</Text>
            <Text style={s.actionSub}>Notifier de se couper</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.actionBtn, s.actionGold]} onPress={requestReview}>
            <Text style={s.actionIcon}>⭐</Text>
            <Text style={[s.actionTitle, { color: '#A8852A' }]}>
              {review ? 'Déjà noté' : 'Demander un avis'}
            </Text>
            <Text style={s.actionSub}>{review ? `${review.rating}/5 étoiles` : 'Boost ta visibilité'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.actionBtn, s.actionGreen]} onPress={createOffer}>
            <Text style={s.actionIcon}>🎁</Text>
            <Text style={[s.actionTitle, { color: '#7C3D8F' }]}>Créer une offre</Text>
            <Text style={s.actionSub}>Promo personnalisée</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.actionBtn, s.actionDark]}
            onPress={() => navigation.navigate('PublicProfile', { client: { id: client.id } })}>
            <Text style={s.actionIcon}>👤</Text>
            <Text style={[s.actionTitle, { color: '#1C1C1E' }]}>Voir profil</Text>
            <Text style={s.actionSub}>Book & FreshScore</Text>
          </TouchableOpacity>
        </View>

        {/* INSIGHT */}
        {freqDays && (
          <BlurView intensity={50} tint="light" style={s.insightCard}>
            <Text style={s.insightIcon}>💡</Text>
            <Text style={s.insightText}>
              {client?.name?.split(' ')[0]} se coupe tous les ~{freqDays} jours.
              {lastVisitAll && (() => {
                const daysSince = Math.round((Date.now() - new Date(lastVisitAll)) / (1000 * 60 * 60 * 24));
                if (daysSince >= freqDays * 0.85) return ` Il est temps de l'inviter — ça fait ${daysSince} jours !`;
                return ` Prochaine coupe dans ~${Math.max(0, freqDays - daysSince)} jours.`;
              })()}
            </Text>
          </BlurView>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0FAEE' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.15)' },
  blob2: { position: 'absolute', top: 350, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(168,133,42,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,113,227,0.1)' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },

  heroCard: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  av: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(168,133,42,0.12)', borderWidth: 2, borderColor: 'rgba(168,133,42,0.3)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avText: { fontSize: 20, fontWeight: '800', color: '#A8852A' },
  heroName: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  heroSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2, marginBottom: 6 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  heroScore: { flexShrink: 0 },

  chip: { backgroundColor: 'rgba(28,28,30,0.07)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  chipText: { fontSize: 10, color: 'rgba(28,28,30,0.6)', fontWeight: '600' },
  chipGold: { backgroundColor: 'rgba(168,133,42,0.1)', borderColor: 'rgba(168,133,42,0.25)' },
  chipGreen: { backgroundColor: 'rgba(124,61,143,0.1)', borderColor: 'rgba(124,61,143,0.25)' },

  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  secSub: { fontSize: 12, color: 'rgba(28,28,30,0.4)' },

  statsGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  statCard: { width: '31%', borderRadius: 14, overflow: 'hidden', padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#1C1C1E', marginTop: 2 },
  statSub: { fontSize: 9, color: 'rgba(28,28,30,0.4)', marginTop: 1 },

  favServiceCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  favServiceTitle: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginBottom: 2 },
  favServiceValue: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },

  profileCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  profileLabel: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  profileValue: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },

  cutCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 12, overflow: 'hidden', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  cutDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,28,30,0.2)', flexShrink: 0 },
  cutDotActive: { backgroundColor: '#7C3D8F' },
  cutService: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  cutDate: { fontSize: 11, color: 'rgba(28,28,30,0.45)', marginTop: 1 },
  cutBadge: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.25)' },
  cutBadgeText: { fontSize: 9, color: '#7C3D8F', fontWeight: '700' },

  reviewCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  reviewText: { fontSize: 13, color: 'rgba(28,28,30,0.65)', lineHeight: 19, fontStyle: 'italic' },

  actionsGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  actionBtn: { width: '47.5%', borderRadius: 16, padding: 13, borderWidth: 0.5 },
  actionBlue: { backgroundColor: 'rgba(0,113,227,0.08)', borderColor: 'rgba(0,113,227,0.2)' },
  actionGold: { backgroundColor: 'rgba(168,133,42,0.08)', borderColor: 'rgba(168,133,42,0.22)' },
  actionGreen: { backgroundColor: 'rgba(124,61,143,0.08)', borderColor: 'rgba(124,61,143,0.2)' },
  actionDark: { backgroundColor: 'rgba(28,28,30,0.05)', borderColor: 'rgba(28,28,30,0.12)' },
  actionIcon: { fontSize: 22, marginBottom: 5 },
  actionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  actionSub: { fontSize: 10, color: 'rgba(28,28,30,0.45)', lineHeight: 14 },

  insightCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)', backgroundColor: 'rgba(0,113,227,0.04)' },
  insightIcon: { fontSize: 18 },
  insightText: { flex: 1, fontSize: 12, color: 'rgba(28,28,30,0.65)', lineHeight: 18 },
});

