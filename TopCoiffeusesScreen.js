import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function TopCoiffeusesScreen({ navigation }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadcoiffeuses();
  }, []);

  async function loadcoiffeuses() {
    const { data } = await supabase
      .from('coiffeuses')
      .select('*, salons(name, city)')
      .order('rating', { ascending: false })
      .limit(50);
    if (data) setBarbers(data);
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>✂ Top Barbers</Text>
          <Text style={styles.headerSub}>Les meilleurs coiffeuses de la plateforme</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* TOP 3 PODIUM */}
        {barbers.length >= 3 && (
          <View style={styles.podium}>
            {/* Rank 2 */}
            <TouchableOpacity
              style={[styles.podiumItem, { marginTop: 30 }]}
              onPress={() => navigation.navigate('BarberProfile', { barber: barbers[1] })}>
              <View style={styles.podiumAvatarWrap}>
                {barbers[1].photo_url ? (
                  <Image source={{ uri: barbers[1].photo_url }} style={styles.podiumAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: '#0A1A0A', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#7C3D8F' }}>{barbers[1].name?.[0]}</Text>
                  </View>
                )}
                <View style={[styles.podiumRank, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                  <Text style={styles.podiumRankText}>2</Text>
                </View>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{barbers[1].name}</Text>
              <Text style={styles.podiumSalon} numberOfLines={1}>{barbers[1].salons?.name}</Text>
              <View style={[styles.podiumScore, { borderColor: '#7C3D8F' }]}>
                <Text style={[styles.podiumScoreText, { color: '#7C3D8F' }]}>★ {barbers[1].rating}</Text>
              </View>
            </TouchableOpacity>

            {/* Rank 1 */}
            <TouchableOpacity
              style={styles.podiumItem}
              onPress={() => navigation.navigate('BarberProfile', { barber: barbers[0] })}>
              <View style={[styles.podiumAvatarWrap, { transform: [{ scale: 1.15 }] }]}>
                {barbers[0].photo_url ? (
                  <Image source={{ uri: barbers[0].photo_url }} style={styles.podiumAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: '#3A1A06', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#A8852A' }}>{barbers[0].name?.[0]}</Text>
                  </View>
                )}
                <View style={[styles.podiumRank, { backgroundColor: '#A8852A' }]}>
                  <Text style={styles.podiumRankText}>1</Text>
                </View>
              </View>
              <Text style={[styles.podiumName, { fontWeight: '800' }]} numberOfLines={1}>{barbers[0].name}</Text>
              <Text style={styles.podiumSalon} numberOfLines={1}>{barbers[0].salons?.name}</Text>
              <View style={[styles.podiumScore, { borderColor: '#A8852A' }]}>
                <Text style={[styles.podiumScoreText, { color: '#A8852A' }]}>★ {barbers[0].rating}</Text>
              </View>
            </TouchableOpacity>

            {/* Rank 3 */}
            <TouchableOpacity
              style={[styles.podiumItem, { marginTop: 50 }]}
              onPress={() => navigation.navigate('BarberProfile', { barber: barbers[2] })}>
              <View style={styles.podiumAvatarWrap}>
                {barbers[2].photo_url ? (
                  <Image source={{ uri: barbers[2].photo_url }} style={styles.podiumAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.podiumAvatar, { backgroundColor: '#1A0814', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#9B59B6' }}>{barbers[2].name?.[0]}</Text>
                  </View>
                )}
                <View style={[styles.podiumRank, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={styles.podiumRankText}>3</Text>
                </View>
              </View>
              <Text style={styles.podiumName} numberOfLines={1}>{barbers[2].name}</Text>
              <Text style={styles.podiumSalon} numberOfLines={1}>{barbers[2].salons?.name}</Text>
              <View style={[styles.podiumScore, { borderColor: '#9B59B6' }]}>
                <Text style={[styles.podiumScoreText, { color: '#9B59B6' }]}>★ {barbers[2].rating}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* SÉPARATEUR */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>Tous les coiffeuses</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* LISTE */}
        {barbers.slice(3).map((barber, index) => (
          <TouchableOpacity key={barber.id} activeOpacity={0.9}
            onPress={() => navigation.navigate('BarberProfile', { barber })}>
            <BlurView intensity={55} tint="light" style={styles.row}>
              <Text style={styles.rowRank}>#{index + 4}</Text>
              <View style={styles.rowAvatar}>
                {barber.photo_url ? (
                  <Image source={{ uri: barber.photo_url }} style={styles.rowAvatarImg} resizeMode="cover" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#A8852A' }}>{barber.name?.[0]}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{barber.name}</Text>
                <Text style={styles.rowSub}>{barber.salons?.name} · {barber.salons?.city}</Text>
              </View>
              <View style={styles.rowScore}>
                <Text style={styles.rowScoreText}>★ {barber.rating}</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        ))}

        {loading && (
          <Text style={styles.loadingText}>Chargement...</Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E8F4FF' },
  blob1: { position: 'absolute', top: -50, left: -50, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(80,160,255,0.22)' },
  blob2: { position: 'absolute', bottom: 100, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.15)' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E' },
  headerSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  podium: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, gap: 16 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumAvatarWrap: { position: 'relative', marginBottom: 8 },
  podiumAvatar: { width: 70, height: 70, borderRadius: 22, overflow: 'hidden' },
  podiumRank: { position: 'absolute', bottom: -6, right: -6, width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  podiumRankText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  podiumName: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 2 },
  podiumSalon: { fontSize: 10, color: 'rgba(28,28,30,0.45)', textAlign: 'center', marginBottom: 4 },
  podiumScore: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  podiumScoreText: { fontSize: 12, fontWeight: '800' },

  separator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  separatorLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(28,28,30,0.15)' },
  separatorText: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)' },

  row: { marginHorizontal: 16, marginBottom: 6, borderRadius: 14, overflow: 'hidden', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  rowRank: { fontSize: 13, fontWeight: '800', color: 'rgba(28,28,30,0.3)', width: 30 },
  rowAvatar: { width: 46, height: 46, borderRadius: 13, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  rowAvatarImg: { width: 46, height: 46 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  rowSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  rowScore: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)' },
  rowScoreText: { fontSize: 12, fontWeight: '700', color: '#A8852A' },

  loadingText: { fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center', padding: 20 },
});
