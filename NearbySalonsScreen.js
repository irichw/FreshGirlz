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

const RADIUS_KM = 20;

export default function NearbySalonsScreen({ navigation }) {
  const [salons, setSalons] = useState([]);
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
      } catch (_) {}
      await fetchNearbySalons(loc);
    })();
  }, []);

  async function fetchNearbySalons(loc) {
    const { data: allSalons } = await supabase
      .from('salons')
      .select('*')
      .order('rating', { ascending: false });

    if (!allSalons) { setLoading(false); return; }

    const salonIds = allSalons.map(s => s.id);
    const { data: todayHours } = await supabase
      .from('opening_hours')
      .select('salon_id, is_closed, open_time, close_time')
      .in('salon_id', salonIds)
      .eq('day_of_week', todayDow());

    const hoursMap = {};
    (todayHours || []).forEach(h => { hoursMap[h.salon_id] = h; });

    let result = allSalons.map(s => {
      const h = hoursMap[s.id];
      const isOpen = h ? isWithinHours(h) : true;
      const dist = loc && s.latitude && s.longitude
        ? haversineKm(loc.latitude, loc.longitude, s.latitude, s.longitude)
        : null;
      return { ...s, _isOpen: isOpen, _distance: dist };
    });

    if (loc) {
      result = result
        .filter(s => s._distance !== null && s._distance <= RADIUS_KM)
        .sort((a, b) => a._distance - b._distance);
    }

    setSalons(result);
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

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Salons près de toi</Text>
          <Text style={styles.headerSub}>📍 Dans un rayon de {RADIUS_KM} km</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#A8852A" />
        </View>
      ) : salons.length === 0 ? (
        <View style={styles.emptyWrap}>
          <BlurView intensity={55} tint="light" style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyTitle}>Aucun salon trouvé</Text>
            <Text style={styles.emptySub}>
              {userLocation
                ? `Aucun salon dans un rayon de ${RADIUS_KM} km.`
                : "Active la localisation pour voir les salons proches."}
            </Text>
          </BlurView>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.resultCount}>
            {salons.length} salon{salons.length > 1 ? 's' : ''}
            {userLocation ? ` à ${RADIUS_KM} km` : ''}
          </Text>
          {salons.map(s => (
            <TouchableOpacity
              key={s.id}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('SalonPublic', { salon: s })}>
              <BlurView intensity={55} tint="light" style={styles.card}>
                <View style={styles.photoWrap}>
                  {s.photo_url
                    ? <Image source={{ uri: s.photo_url }} style={styles.photo} resizeMode="cover" />
                    : <View style={styles.photoPlaceholder}><Text style={styles.photoEmoji}>✂</Text></View>}
                </View>

                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  {(s.address || s.city) && (
                    <Text style={styles.address} numberOfLines={1}>
                      {[s.address, s.city].filter(Boolean).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.rating}>★ {s.rating?.toFixed(1) || '—'}</Text>
                </View>

                <View style={styles.right}>
                  <View style={[styles.statusPill,
                    s._isOpen
                      ? { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.28)' }
                      : { backgroundColor: 'rgba(192,57,43,0.1)', borderColor: 'rgba(192,57,43,0.25)' }]}>
                    <Text style={[styles.statusText, { color: s._isOpen ? '#7C3D8F' : '#C0392B' }]}>
                      {s._isOpen ? '● Ouvert' : '● Fermé'}
                    </Text>
                  </View>
                  {s._distance !== null && (
                    <Text style={styles.distance}>
                      {s._distance < 1
                        ? `${Math.round(s._distance * 1000)} m`
                        : `${s._distance.toFixed(1)} km`}
                    </Text>
                  )}
                </View>
              </BlurView>
            </TouchableOpacity>
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

  card: { borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', gap: 10 },

  photoWrap: { width: 58, height: 58, borderRadius: 14, overflow: 'hidden', flexShrink: 0 },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', backgroundColor: 'rgba(28,28,30,0.07)', alignItems: 'center', justifyContent: 'center' },
  photoEmoji: { fontSize: 22, opacity: 0.3 },

  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  address: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  rating: { fontSize: 11, color: '#A8852A', marginTop: 3, fontWeight: '600' },

  right: { alignItems: 'flex-end', gap: 4 },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5 },
  statusText: { fontSize: 11, fontWeight: '600' },
  distance: { fontSize: 10, color: 'rgba(28,28,30,0.4)' },
});

