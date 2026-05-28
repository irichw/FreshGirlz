import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Modal, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function CoiffeuseNotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigation.goBack(); return; }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setNotifications(data);

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_user_id', session.user.id)
      .eq('read', false);

    setLoading(false);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Image source={require('./assets/notiffull.png')} style={{ width: 40, height: 40, resizeMode: 'contain', marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginBottom: 6 }}>Aucune notification</Text>
          <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.45)', textAlign: 'center' }}>
            Tes avis clients et alertes apparaîtront ici
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const parsedData = (() => {
              try { return typeof item.data === 'string' ? JSON.parse(item.data) : (item.data || {}); }
              catch { return {}; }
            })();
            const isRdv    = item.type === 'new_appointment';
            const isReview = item.type === 'new_review';
            return (
              <BlurView intensity={60} tint="light" style={[styles.notifCard, !item.read && styles.notifCardUnread]}>
                {!item.read && <View style={styles.unreadDot} />}
                <View style={styles.notifTop}>
                  <View style={[styles.notifIcon,
                    isReview && styles.notifIconGold,
                    isRdv    && styles.notifIconPurple,
                  ]}>
                    {isReview
                      ? <Text style={styles.notifIconText}>★</Text>
                      : isRdv
                        ? <Text style={styles.notifIconText}>📅</Text>
                        : <Image source={require('./assets/notiffull.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
                {isReview && (
                  <TouchableOpacity
                    style={styles.voirBtn}
                    onPress={() => setSelectedReview(item)}>
                    <Text style={styles.voirBtnText}>Voir l'avis →</Text>
                  </TouchableOpacity>
                )}
                {isRdv && (
                  <TouchableOpacity
                    style={styles.voirRdvBtn}
                    onPress={() => {
                      navigation.navigate('Agenda', {
                        initialAppointmentId: parsedData.appointment_id,
                      });
                    }}>
                    <Text style={styles.voirRdvBtnText}>Voir la demande · Confirmer →</Text>
                  </TouchableOpacity>
                )}
              </BlurView>
            );
          }}
        />
      )}

      {/* Modal détail avis */}
      <Modal
        visible={!!selectedReview}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReview(null)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={85} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Avis reçu</Text>
              <TouchableOpacity onPress={() => setSelectedReview(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <View style={styles.starsRow}>
                {[1,2,3,4,5].map(s => (
                  <Text key={s} style={[styles.star, s <= (selectedReview?.data?.rating || 0) && styles.starActive]}>★</Text>
                ))}
                <Text style={styles.ratingNum}>{selectedReview?.data?.rating}/5</Text>
              </View>

              {selectedReview?.data?.comment ? (
                <BlurView intensity={50} tint="light" style={styles.commentBox}>
                  <Text style={styles.commentText}>"{selectedReview.data.comment}"</Text>
                </BlurView>
              ) : (
                <View style={styles.commentBox}>
                  <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center' }}>Aucun commentaire</Text>
                </View>
              )}

              <Text style={styles.clientLabel}>Publié par</Text>
              <TouchableOpacity
                style={styles.clientRow}
                onPress={() => {
                  if (selectedReview?.data?.client_id) {
                    setSelectedReview(null);
                    navigation.navigate('PublicProfile', {
                      client: { id: selectedReview.data.client_id }
                    });
                  }
                }}>
                <View style={styles.clientAv}>
                  <Text style={styles.clientAvText}>
                    {(selectedReview?.data?.client_name || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.clientName}>{selectedReview?.data?.client_name || 'Client'}</Text>
                <Text style={styles.clientArrow}>Voir le profil →</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0FAEE' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.18)' },
  blob2: { position: 'absolute', bottom: 150, left: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(168,133,42,0.12)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },

  notifCard: { borderRadius: 16, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', position: 'relative' },
  notifCardUnread: { borderColor: 'rgba(124,61,143,0.3)' },
  unreadDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3D8F' },

  notifTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  notifIcon:       { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifIconGold:   { backgroundColor: 'rgba(168,133,42,0.15)' },
  notifIconPurple: { backgroundColor: 'rgba(124,61,143,0.15)' },
  notifIconText: { fontSize: 18 },
  notifTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  notifBody: { fontSize: 12, color: 'rgba(28,28,30,0.55)', lineHeight: 17 },
  notifTime: { fontSize: 10, color: 'rgba(28,28,30,0.35)', marginTop: 4 },

  voirBtn:       { marginTop: 10, backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)' },
  voirBtnText:   { fontSize: 13, fontWeight: '700', color: '#A8852A' },
  voirRdvBtn:    { marginTop: 10, backgroundColor: 'rgba(124,61,143,0.12)', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.3)' },
  voirRdvBtnText:{ fontSize: 13, fontWeight: '700', color: '#7C3D8F' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  modalClose: { fontSize: 14, color: 'rgba(28,28,30,0.4)', padding: 4 },

  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  star: { fontSize: 28, color: 'rgba(28,28,30,0.15)' },
  starActive: { color: '#A8852A' },
  ratingNum: { fontSize: 14, fontWeight: '700', color: '#A8852A', marginLeft: 8 },

  commentBox: { borderRadius: 12, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.4)' },
  commentText: { fontSize: 14, color: '#1C1C1E', lineHeight: 20, fontStyle: 'italic' },

  clientLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,113,227,0.06)', borderRadius: 14, padding: 12, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.15)' },
  clientAv: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clientAvText: { fontSize: 16, fontWeight: '800', color: '#A8852A' },
  clientName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  clientArrow: { fontSize: 12, color: '#0071E3', fontWeight: '600' },
});

