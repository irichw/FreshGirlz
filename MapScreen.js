import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ScrollView, Dimensions, Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import * as Location from 'expo-location';
import { haversineKm } from './utils/geo';

// Maps uniquement sur iOS/Android
let MapView, Marker, PROVIDER_DEFAULT;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
}

const { width, height } = Dimensions.get('window');

export default function MapScreen({ navigation }) {
  const [salons, setSalons] = useState([]);
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(null);
  const [filterRadius, setFilterRadius] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getUserLocation();
    fetchSalons();
  }, []);

  async function getUserLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setUserLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  }

  async function fetchSalons() {
    const { data } = await supabase
      .from('salons')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (data) setSalons(data);
    setLoading(false);
  }

  function centerOnUser() {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 800);
    }
  }

  function centerOnSalon(salon) {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: salon.latitude,
        longitude: salon.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 600);
    }
    setSelectedSalon(salon);
  }

  const initialRegion = {
    latitude: userLocation?.latitude || 48.8566,
    longitude: userLocation?.longitude || 2.3522,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const filteredSalons = salons.filter(s => {
    if (filterOpen === true && !s.is_open) return false;
    if (filterOpen === false && s.is_open) return false;
    if (filterRadius !== null && userLocation) {
      if (!s.latitude || !s.longitude) return false;
      if (haversineKm(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude) > filterRadius) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* MAP */}
     {Platform.OS !== 'web' ? (
  <MapView
    ref={mapRef}
    style={styles.map}
    provider={PROVIDER_DEFAULT}
    initialRegion={initialRegion}
    showsUserLocation
    showsMyLocationButton={false}>
    {filteredSalons.map((salon) => (
      <Marker
        key={salon.id}
        coordinate={{ latitude: salon.latitude, longitude: salon.longitude }}
        onPress={() => centerOnSalon(salon)}>
        <View style={[styles.markerContainer, selectedSalon?.id === salon.id && styles.markerSelected]}>
          <Text style={styles.markerIcon}>✂</Text>
        </View>
      </Marker>
    ))}
  </MapView>
) : (
  <View style={[styles.map, { backgroundColor: '#C8DFC4', alignItems: 'center', justifyContent: 'center' }]}>
    <Text style={{ fontSize: 14, color: 'rgba(28,28,30,0.4)' }}>Map disponible sur iOS & Android</Text>
  </View>
)}

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <BlurView intensity={70} tint="light" style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>Salons près de toi</Text>
        </BlurView>
        <TouchableOpacity
          style={[styles.filterBtn, (filterOpen !== null || filterRadius !== null) && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}>
          <Text style={styles.filterBtnText}>
            {(filterOpen !== null || filterRadius !== null) ? '● Filtres' : '⚙ Filtres'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locBtn} onPress={centerOnUser}>
          <Text style={styles.locBtnText}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM SHEET */}
      <View style={styles.sheet}>
        {selectedSalon ? (
          /* SALON SÉLECTIONNÉ */
          <BlurView intensity={80} tint="light" style={styles.salonDetail}>
            <View style={styles.sheetHandle} />
            <View style={styles.salonDetailRow}>
              <View style={styles.salonDetailPhoto}>
                {selectedSalon.photo_url ? (
                  <Image source={{ uri: selectedSalon.photo_url }}
                    style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 24, opacity: 0.2 }}>✂</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.salonDetailName}>{selectedSalon.name}</Text>
                <Text style={styles.salonDetailAddr}>{selectedSalon.address}</Text>
                <Text style={styles.salonDetailAddr}>{selectedSalon.city}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  <Text style={{ fontSize: 11, color: '#A8852A' }}>
                    {'★'.repeat(Math.round(selectedSalon.rating || 0))}
                  </Text>
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>● Ouvert</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedSalon(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.visitBtn}
              onPress={() => navigation.navigate('SalonPublic', { salon: selectedSalon })}>
              <Text style={styles.visitBtnText}>Voir le salon →</Text>
            </TouchableOpacity>
          </BlurView>
        ) : (
          /* LISTE SALONS */
          <BlurView intensity={80} tint="light" style={styles.salonList}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {filteredSalons.length} salon{filteredSalons.length !== 1 ? 's' : ''}
              {filterOpen === true ? ' ouverts' : filterOpen === false ? ' fermés' : ''}
              {filterRadius !== null ? ` · ${filterRadius} km` : ''}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
              {filteredSalons.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.salonChip}
                  onPress={() => centerOnSalon(s)}>
                  <View style={styles.salonChipPhoto}>
                    {s.photo_url ? (
                      <Image source={{ uri: s.photo_url }}
                        style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: 16, opacity: 0.3 }}>✂</Text>
                    )}
                  </View>
                  <Text style={styles.salonChipName} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.salonChipCity} numberOfLines={1}>{s.city}</Text>
                  <View style={styles.salonChipRating}>
                    <Text style={styles.salonChipRatingText}>★ {s.rating}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        )}
      </View>

      {/* MODAL FILTRES */}
      {showFilters && (
        <View style={styles.filterOverlay}>
          <TouchableOpacity style={styles.filterDismiss} onPress={() => setShowFilters(false)} />
          <BlurView intensity={85} tint="light" style={styles.filterSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.filterTitle}>Filtres</Text>

            <Text style={styles.filterLabel}>Statut</Text>
            <View style={styles.filterRow}>
              {[{ label: 'Tous', v: null }, { label: 'Ouverts', v: true }, { label: 'Fermés', v: false }].map(o => (
                <TouchableOpacity
                  key={String(o.v)}
                  style={[styles.filterChip, filterOpen === o.v && styles.filterChipActive]}
                  onPress={() => setFilterOpen(o.v)}>
                  <Text style={[styles.filterChipText, filterOpen === o.v && styles.filterChipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Rayon</Text>
            <View style={styles.filterRow}>
              {[null, 2, 5, 10, 20].map(r => (
                <TouchableOpacity
                  key={String(r)}
                  style={[styles.filterChip, filterRadius === r && styles.filterChipActive]}
                  onPress={() => setFilterRadius(r)}>
                  <Text style={[styles.filterChipText, filterRadius === r && styles.filterChipTextActive]}>
                    {r === null ? 'Tous' : `${r} km`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {!userLocation && filterRadius !== null && (
              <Text style={styles.filterWarning}>Localisation requise pour filtrer par rayon</Text>
            )}

            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Text style={styles.applyBtnText}>Appliquer</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  map: { width, height },

  header: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { flex: 1, borderRadius: 13, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
  headerTitleText: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', textAlign: 'center' },
  locBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  locBtnText: { fontSize: 18 },

  markerContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1C1C1E', borderWidth: 2.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  markerSelected: { backgroundColor: '#A8852A', transform: [{ scale: 1.2 }] },
  markerIcon: { fontSize: 14, color: '#fff' },

  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  salonDetail: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', padding: 16, paddingBottom: 32, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginBottom: 14 },
  salonDetailRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  salonDetailPhoto: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  salonDetailName: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  salonDetailAddr: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  openBadge: { backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.28)' },
  openBadgeText: { fontSize: 10, fontWeight: '600', color: '#7C3D8F' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  closeBtnText: { fontSize: 12, color: 'rgba(28,28,30,0.5)' },
  visitBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, alignItems: 'center' },
  visitBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  salonList: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 12, paddingBottom: 32, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, marginBottom: 12 },
  salonChip: { width: 120, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)', overflow: 'hidden' },
  salonChipPhoto: { width: '100%', height: 70, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center' },
  salonChipName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', padding: 6, paddingBottom: 2 },
  salonChipCity: { fontSize: 10, color: 'rgba(28,28,30,0.5)', paddingHorizontal: 6 },
  salonChipRating: { paddingHorizontal: 6, paddingBottom: 8, marginTop: 3 },
  salonChipRatingText: { fontSize: 10, color: '#A8852A', fontWeight: '600' },

  filterBtn: { height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)' },
  filterBtnActive: { backgroundColor: 'rgba(168,133,42,0.2)', borderColor: 'rgba(168,133,42,0.5)' },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },

  filterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  filterDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  filterSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', padding: 20, paddingBottom: 36, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
  filterTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 16 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.07)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.15)' },
  filterChipActive: { backgroundColor: 'rgba(168,133,42,0.2)', borderColor: 'rgba(168,133,42,0.5)' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(28,28,30,0.55)' },
  filterChipTextActive: { color: '#A8852A' },
  filterWarning: { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginTop: -8, marginBottom: 12 },
  applyBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 4 },
  applyBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
