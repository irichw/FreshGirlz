import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { haversineKm } from './utils/geo';
import { isWithinHours, todayDow } from './utils/hours';

export default function NearbyAvailableScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let loc = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(loc);
        }
      } catch (e) {}
      await fetchAvailablecoiffeuses(loc);
    })();
  }, []);

  async function fetchAvailablecoiffeuses(loc) {
    const { data: allCandidates } = await supabase
      .from('coiffeuses')
      .select('*, salons!inner(id, name, address, city, latitude, longitude, is_open)')
      .eq('is_available', true);

    if (!allCandidates || allCandidates.length === 0) {
      setcoiffeuses([]);
      setLoading(false);
      return;
    }

    const salonIds = [...new Set(allCandidates.map(b => b.salons?.id).filter(Boolean))];
    const { data: todayHours } = salonIds.length
      ? await supabase.from('opening_hours').select('salon_id, is_closed, open_time, close_time').in('salon_id', salonIds).eq('day_of_week', todayDow())
      : { data: [] };

    const hoursMap = {};
    (todayHours || []).forEach(h => { hoursMap[h.salon_id] = h; });

    const candidates = allCandidates.filter(b => {
      const h = hoursMap[b.salons?.id];
      return h ? isWithinHours(h) : true;
    });

    if (!candidates || candidates.length === 0) {
      setcoiffeuses([]);
      setLoading(false);
      return;
    }

    const { data: busy } = await supabase
      .from('queue')
      .select('barber_id')
      .in('status', ['active', 'walkin'])
      .in('barber_id', candidates.map(b => b.id));

    const busySet = new Set(busy?.map(q => q.barber_id) ?? []);
    let available = candidates.filter(b => !busySet.has(b.id));

    if (loc) {
      available = available
        .filter(b => {
          if (!b.salons?.latitude || !b.salons?.longitude) return false;
          return haversineKm(loc.latitude, loc.longitude, b.salons.latitude, b.salons.longitude) <= 10;
        })
        .map(b => ({
          ...b,
          _distance: haversineKm(loc.latitude, loc.longitude, b.salons.latitude, b.salons.longitude),
        }))
        .sort((a, b) => a._distance - b._distance);
    }

    setcoiffeuses(available);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Disponibles maintenant</Text>
          <Text style={styles.headerSub}>⚡ 0 en attente · Accès immédiat</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#A8852A" />
        </View>
      ) : barbers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <BlurView intensity={55} tint="light" style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>⚡</Text>
            <Text style={styles.emptyTitle}>Aucun Coiffeuse disponible</Text>
            <Text style={styles.emptySub}>
              {userLocation
                ? 'Pas de Coiffeuse libre dans un rayon de 10 km pour le moment.'
                : 'Aucun Coiffeuse libre en ce moment.'}
            </Text>
          </BlurView>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.resultCount}>
            {barbers.length} Coiffeuse{barbers.length > 1 ? 's' : ''} disponible{barbers.length > 1 ? 's' : ''}
            {userLocation ? ' à 10 km' : ''}
          </Text>
          {barbers.map(b => (
            <BlurView key={b.id} intensity={55} tint="light" style={styles.card}>
              {/* Photo */}
              <View style={styles.photoWrap}>
                {b.photo_url ? (
                  <Image source={{ uri: b.photo_url }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoInitial}>{b.name?.charAt(0)}</Text>
                  </View>
                )}
                <View style={styles.availableDot} />
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name}>{b.name}</Text>
                {b.specialty ? <Text style={styles.specialty}>{b.specialty}</Text> : null}
                <Text style={styles.salon}>{b.salons?.name}</Text>
                {b._distance != null && (
                  <Text style={styles.distance}>{b._distance.toFixed(1)} km</Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('JoinQueue', { barber: b })}>
                  <Text style={styles.btnPrimaryText}>Rejoindre</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('BarberProfile', { barber: b })}>
                  <Text style={styles.btnSecondaryText}>Voir profil</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E8F4FF' },
  blob1: { position: 'absolute', top: -50, left: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(80,160,255,0.22)' },
  blob2: { position: 'absolute', top: 100, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(60,200,120,0.18)' },
  blob3: { position: 'absolute', bottom: 200, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(200,100,255,0.12)' },

  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { flex: 1, padding: 20, justifyContent: 'center' },
  emptyCard: { borderRadius: 20, overflow: 'hidden', padding: 28, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginBottom: 8 },
  emptySub: { fontSize: 13, color: 'rgba(28,28,30,0.5)', textAlign: 'center', lineHeight: 20 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  resultCount: { fontSize: 13, color: 'rgba(28,28,30,0.45)', fontWeight: '600', marginBottom: 10 },

  card: { borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', gap: 10 },

  photoWrap: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: '#331a00', alignItems: 'center', justifyContent: 'center' },
  photoInitial: { fontSize: 20, fontWeight: '800', color: '#A8852A' },
  availableDot: { position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: '#7C3D8F', borderWidth: 1.5, borderColor: '#fff' },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  specialty: { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  salon: { fontSize: 11, color: '#A8852A', fontWeight: '600', marginTop: 2 },
  distance: { fontSize: 10, color: 'rgba(28,28,30,0.4)', marginTop: 1 },

  actions: { gap: 6 },
  btnPrimary: { backgroundColor: 'rgba(124,61,143,0.18)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(124,61,143,0.4)', alignItems: 'center' },
  btnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#7C3D8F' },
  btnSecondary: { backgroundColor: 'rgba(28,28,30,0.07)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.15)', alignItems: 'center' },
  btnSecondaryText: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },
});

