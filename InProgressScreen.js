import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, Image,
  Modal, Pressable
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function InProgressScreen({ navigation, route }) {
  const { queueEntry } = route.params || {};
  const [elapsed, setElapsed] = useState(0);
  const [refCoupe, setRefCoupe] = useState(null);
  const [similarCoupes, setSimilarCoupes] = useState([]);
  const [photoModal, setPhotoModal] = useState(null);

  const barber = queueEntry?.barbers;
  const service = queueEntry?.service;
  const totalDuration = queueEntry?.duration || queueEntry?.estimated_wait || 30;
  const startedAt = queueEntry?.updated_at ? new Date(queueEntry.updated_at) : new Date();
  const clientRefUrl = queueEntry?.reference_url ?? null;

  // Timer temps réel (update toutes les 30s)
  useEffect(() => {
    const update = () => {
      const mins = Math.floor((new Date() - startedAt) / 60000);
      setElapsed(mins);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  const MOCK_SIMILAR = [
    { id: 'm1', photo_url: 'https://i.pravatar.cc/200?img=11', clients: { id: 101, name: 'Enzo R.' } },
    { id: 'm2', photo_url: 'https://i.pravatar.cc/200?img=15', clients: { id: 102, name: 'Karim B.' } },
    { id: 'm3', photo_url: 'https://i.pravatar.cc/200?img=22', clients: { id: 103, name: 'Malik D.' } },
    { id: 'm4', photo_url: 'https://i.pravatar.cc/200?img=33', clients: { id: 104, name: 'Jordan T.' } },
    { id: 'm5', photo_url: 'https://i.pravatar.cc/200?img=44', clients: { id: 105, name: 'Samir H.' } },
    { id: 'm6', photo_url: 'https://i.pravatar.cc/200?img=52', clients: { id: 106, name: 'Lucas M.' } },
  ];

  // Référence : priorité à reference_url stockée dans la queue, sinon fallback par service
  useEffect(() => {
    if (clientRefUrl) {
      setRefCoupe({ photo_url: clientRefUrl, service });
    } else if (queueEntry?.client_id && service) {
      supabase
        .from('coupes')
        .select('id, photo_url, service')
        .eq('client_id', queueEntry.client_id)
        .eq('service', service)
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => { if (data) setRefCoupe(data); });
    }
  }, [clientRefUrl, queueEntry?.client_id, service]);

  // Galerie similaire
  useEffect(() => {
    if (!queueEntry?.client_id || !service) return;
    supabase
      .from('coupes')
      .select('id, photo_url, service, clientes(id, name, avatar_url)')
      .eq('service', service)
      .eq('is_private', false)
      .neq('client_id', queueEntry.client_id)
      .order('likes', { ascending: false })
      .limit(12)
      .then(({ data }) => { if (data && data.length > 0) setSimilarCoupes(data); });
  }, [queueEntry?.client_id, service]);

  const displaySimilar = similarCoupes.length > 0 ? similarCoupes : MOCK_SIMILAR;

  const remaining = Math.max(0, totalDuration - elapsed);
  const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));
  const startTime = startedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = new Date(Date.now() + remaining * 60000);
  const endTimeStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`;

  const handleTerminee = () => {
    supabase
      .from('queue')
      .update({ status: 'pending_confirmation', updated_at: new Date().toISOString() })
      .eq('id', queueEntry?.id);

    navigation.navigate('AfterCut', {
      barberId: queueEntry?.barber_id,
      queueId: queueEntry?.id,
      barber,
      service,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HERO */}
        <View style={styles.hero}>
          {refCoupe?.photo_url ? (
            <Image source={{ uri: refCoupe.photo_url }} style={styles.heroBgImg} resizeMode="cover" />
          ) : barber?.photo_url ? (
            <Image source={{ uri: barber.photo_url }} style={styles.heroBgImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroBgColor}>
              <Text style={styles.heroBgEmoji}>✂</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={styles.heroBadge}>
            <View style={styles.heroDot} />
            <Text style={styles.heroBadgeText}>Coupe en cours</Text>
          </View>

          {refCoupe?.photo_url && (
            <TouchableOpacity
              style={styles.refPhotoBadge}
              onPress={() => setPhotoModal({ uri: refCoupe.photo_url, clientId: null, clientName: 'Ma coupe de référence' })}
              activeOpacity={0.8}>
              <Text style={styles.refPhotoBadgeText}>📷 Ma coupe de référence · agrandir</Text>
            </TouchableOpacity>
          )}

          <View style={styles.heroContent}>
            <Text style={styles.heroBarber}>{barber?.name} · {barber?.salons?.name}</Text>
            <Text style={styles.heroCoupe}>{service}</Text>
          </View>
        </View>

        <View style={styles.body}>

          {/* MÉTRIQUES */}
          <View style={styles.metrics}>
            <BlurView intensity={60} tint="light" style={styles.metric}>
              <Text style={styles.metricLabel}>Temps écoulé</Text>
              <Text style={styles.metricVal}>
                {elapsed}<Text style={styles.metricUnit}> min</Text>
              </Text>
              <Text style={styles.metricSub}>démarré à {startTime}</Text>
            </BlurView>
            <BlurView intensity={60} tint="light" style={styles.metric}>
              <Text style={styles.metricLabel}>Fin estimée</Text>
              <Text style={[styles.metricVal, { fontSize: 28 }]}>{endTimeStr}</Text>
              <Text style={styles.metricSub}>~{remaining} min restant</Text>
            </BlurView>
          </View>

          {/* PROGRESSION */}
          <BlurView intensity={55} tint="light" style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Progression estimée</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${progress}%` }]} />
            </View>
          </BlurView>

          {/* BOUTON */}
          <TouchableOpacity style={styles.btnDone} onPress={handleTerminee} activeOpacity={0.85}>
            <Text style={styles.btnDoneText}>✂ Ma coupe est terminée</Text>
          </TouchableOpacity>


        </View>
      </ScrollView>

      {/* PHOTO MODAL */}
      <Modal visible={!!photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(null)}>
        <Pressable style={styles.photoModalOverlay} onPress={() => setPhotoModal(null)}>
          <Pressable style={styles.photoModalContent}>
            {photoModal?.uri ? (
              <Image source={{ uri: photoModal.uri }} style={styles.photoModalImg} resizeMode="contain" />
            ) : (
              <View style={[styles.photoModalImg, { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 48 }}>✂</Text>
              </View>
            )}
            <View style={styles.photoModalBottom}>
              <Text style={styles.photoModalName}>{photoModal?.clientName}</Text>
              {photoModal?.clientId && (
                <TouchableOpacity
                  onPress={() => {
                    setPhotoModal(null);
                    navigation.navigate('PublicProfile', { client: { id: photoModal.clientId, name: photoModal.clientName } });
                  }}
                  style={styles.photoModalProfileBtn}
                  activeOpacity={0.8}>
                  <Text style={styles.photoModalProfileBtnText}>Voir le profil →</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0FAEE' },

  hero: { height: 260, position: 'relative' },
  heroBgImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  heroBgColor: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a2e1a', alignItems: 'center', justifyContent: 'center' },
  heroBgEmoji: { fontSize: 70, opacity: 0.08 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.62)' },
  backBtn: { position: 'absolute', top: 14, left: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: '#fff' },
  heroBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(124,61,143,0.85)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  heroBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  refPhotoBadge: { position: 'absolute', bottom: 50, left: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  refPhotoBadgeText: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  heroContent: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  heroBarber: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  heroCoupe: { fontSize: 22, fontWeight: '800', color: '#fff' },

  body: { padding: 14 },

  metrics: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metric: { flex: 1, borderRadius: 14, overflow: 'hidden', padding: 12, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)' },
  metricLabel: { fontSize: 10, color: 'rgba(28,28,30,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  metricVal: { fontSize: 30, fontWeight: '900', color: '#7C3D8F', lineHeight: 32 },
  metricUnit: { fontSize: 13, fontWeight: '500' },
  metricSub: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 4 },

  progressCard: { borderRadius: 14, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)', marginBottom: 12 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 12, color: 'rgba(28,28,30,0.5)' },
  progressPct: { fontSize: 12, fontWeight: '700', color: '#7C3D8F' },
  bar: { height: 7, backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#7C3D8F', borderRadius: 4 },

  btnDone: { backgroundColor: '#7C3D8F', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  btnDoneText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  gallerySection: { marginBottom: 4 },
  galleryTitle: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 12, paddingHorizontal: 2 },
  galleryItem: { width: 100, alignItems: 'center' },
  galleryPhoto: { width: 100, height: 125, borderRadius: 14, marginBottom: 6, overflow: 'hidden' },
  galleryName: { fontSize: 11, fontWeight: '600', color: '#1C1C1E', maxWidth: 96, textAlign: 'center' },

  photoModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  photoModalContent: { width: '100%', borderRadius: 20, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  photoModalImg: { width: '100%', aspectRatio: 3 / 4 },
  photoModalBottom: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoModalName: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },
  photoModalProfileBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  photoModalProfileBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

