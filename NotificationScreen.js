import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

const TYPE_CONFIG = {
  queue_advance:  { icon: '📈', color: '#0071E3', bg: 'rgba(0,113,227,0.1)',   border: 'rgba(0,113,227,0.2)',   tappable: false },
  your_turn:      { icon: '✂',  color: '#7C3D8F', bg: 'rgba(124,61,143,0.1)',   border: 'rgba(124,61,143,0.25)',  tappable: false },
  new_review:     { icon: '⭐', color: '#A8852A', bg: 'rgba(168,133,42,0.1)',  border: 'rgba(168,133,42,0.25)', tappable: false },
  barber_photo:   { icon: '📸', color: '#A8852A', bg: 'rgba(168,133,42,0.1)',  border: 'rgba(168,133,42,0.3)',  tappable: true },
  review_request: { icon: '⭐', color: '#0071E3', bg: 'rgba(0,113,227,0.08)',  border: 'rgba(0,113,227,0.25)',  tappable: true },
  photo_removed:  { icon: '🗑', color: '#C0392B', bg: 'rgba(192,57,43,0.08)',  border: 'rgba(192,57,43,0.2)',   tappable: false },
  default:        { icon: '🔔', color: '#555',    bg: 'rgba(28,28,30,0.06)',   border: 'rgba(28,28,30,0.1)',    tappable: false },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  useEffect(() => {
    loadAndMarkRead();
    subscribeRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  async function loadAndMarkRead() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigation.goBack(); return; }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (data) setNotifications(data);

    // Marquer en masse sauf les types nécessitant une action utilisateur
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_user_id', session.user.id)
      .eq('read', false)
      .not('type', 'in', '(barber_photo,review_request)');

    setLoading(false);
  }

  async function subscribeRealtime() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    channelRef.current = supabase
      .channel('client-notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_user_id=eq.${session.user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        supabase.from('notifications').update({ read: true }).eq('id', payload.new.id);
      })
      .subscribe();
  }

  function handlePress(item) {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
    if (!cfg.tappable) return;
    // Notifications d'action déjà traitées → non interactives
    if (item.read && cfg.tappable) return;

    setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
    supabase.from('notifications').update({ read: true }).eq('id', item.id);

    const d = item.data || {};

    if (item.type === 'barber_photo') {
      navigation.navigate('PhotoConsent', {
        coupe_id: d.coupe_id,
        photo_url: d.photo_url,
        is_public: d.is_public,
        barber_id: d.barber_id,
        barber_name: d.barber_name,
        notification_id: item.id,
      });
    } else if (item.type === 'review_request') {
      navigation.navigate('AfterCut', {
        barberId: d.barber_id,
        queueId: d.queue_id,
        barberName: d.barber_name,
        barberService: d.service,
      });
    }
  }

  function renderItem({ item }) {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
    const isActionable = cfg.tappable && !item.read;
    const isActioned = cfg.tappable && item.read;
    return (
      <TouchableOpacity
        activeOpacity={isActionable ? 0.75 : 1}
        onPress={() => handlePress(item)}
        disabled={!isActionable}>
        <BlurView intensity={55} tint="light" style={[
          styles.notifCard,
          { borderColor: cfg.border },
          !item.read && styles.notifCardUnread,
          isActionable && styles.notifCardTappable,
        ]}>
          <View style={[styles.iconBg, { backgroundColor: cfg.bg }]}>
            {cfg.icon === '🔔'
              ? <Image source={require('./assets/notiffull.png')} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
              : <Text style={styles.iconText}>{cfg.icon}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>{item.title}</Text>
            <Text style={styles.notifBody}>{item.body}</Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>
          {!item.read && !cfg.tappable && <View style={[styles.dot, { backgroundColor: cfg.color }]} />}
          {isActionable && <Text style={[styles.arrow, { color: cfg.color }]}>›</Text>}
          {isActioned && (
            <View style={styles.actionedBadge}>
              <Text style={styles.actionedBadgeText}>✓</Text>
            </View>
          )}
        </BlurView>
      </TouchableOpacity>
    );
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chargement…</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Image source={require('./assets/notiffull.png')} style={{ width: 48, height: 48, resizeMode: 'contain', marginBottom: 8 }} />
          <Text style={styles.emptyTitle}>Aucune notification</Text>
          <Text style={styles.emptyText}>Tu seras notifié de l'avancement de ta place en file</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id?.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', bottom: 80, left: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.07)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#1C1C1E', fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },

  notifCard: { borderRadius: 14, overflow: 'hidden', padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderWidth: 0.5, marginBottom: 8 },
  notifCardUnread: { backgroundColor: 'rgba(255,255,255,0.45)' },
  notifCardTappable: { borderWidth: 1 },
  arrow: { fontSize: 22, fontWeight: '300', alignSelf: 'center', marginLeft: 2 },
  actionedBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(124,61,143,0.15)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  actionedBadgeText: { fontSize: 11, fontWeight: '700', color: '#0F6E56' },
  iconBg: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText: { fontSize: 18 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  notifBody: { fontSize: 12, color: 'rgba(28,28,30,0.6)', lineHeight: 17 },
  notifTime: { fontSize: 10, color: 'rgba(28,28,30,0.35)', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  emptyText: { fontSize: 13, color: 'rgba(28,28,30,0.5)', textAlign: 'center' },
});

