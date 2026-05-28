import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, StatusBar, Image, RefreshControl, Modal,
  Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { useFocusEffect } from '@react-navigation/native';

const { width: SW } = Dimensions.get('window');

function timeAgo(d) {
  const sec = Math.floor((Date.now() - new Date(d)) / 1000);
  if (sec < 60)    return "À l'instant";
  if (sec < 3600)  return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function StarRow({ rating }) {
  return (
    <View style={s.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={[s.star, i <= Math.round(rating) && s.starFilled]}>★</Text>
      ))}
    </View>
  );
}

function Avatar({ uri, size = 38, initials = '?' }) {
  if (uri) return <Image source={{ uri }} style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={s.avatarInitial}>{initials[0]?.toUpperCase() || '?'}</Text>
    </View>
  );
}

// ── Cartes ──────────────────────────────────────────────────────

function ReviewCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.cardWrap}>
      <BlurView intensity={60} tint="light" style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: '#A8852A' }]} />
        <View style={s.cardTop}>
          <View style={[s.typeTag, { backgroundColor: 'rgba(168,133,42,0.12)' }]}>
            <Text style={[s.typeLabel, { color: '#A8852A' }]}>⭐ Avis</Text>
          </View>
          <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={s.cardBody}>
          <Avatar uri={item.clients?.avatar_url} initials={item.clients?.name || 'C'} />
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{item.clients?.name || 'Client'}</Text>
            <Text style={s.cardSub}>
              {item.barbers?.name || 'Coiffeuse'}
              {item.barbers?.salons?.name ? ` · ${item.barbers.salons.name}` : ''}
            </Text>
            <StarRow rating={item.rating} />
          </View>
        </View>
        {!!item.comment && (
          <Text style={s.reviewComment} numberOfLines={2}>"{item.comment}"</Text>
        )}
      </BlurView>
    </TouchableOpacity>
  );
}

function SalonCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.cardWrap}>
      <BlurView intensity={60} tint="light" style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: '#7C3D8F' }]} />
        <View style={s.cardTop}>
          <View style={[s.typeTag, { backgroundColor: 'rgba(124,61,143,0.12)' }]}>
            <Text style={[s.typeLabel, { color: '#7C3D8F' }]}>✂️ Nouveau salon</Text>
          </View>
          <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={s.cardBody}>
          {item.photo_url
            ? <Image source={{ uri: item.photo_url }} style={s.salonThumb} />
            : (
              <View style={[s.salonThumb, s.salonThumbFallback]}>
                <Text style={{ fontSize: 22 }}>✂️</Text>
              </View>
            )
          }
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{item.name}</Text>
            {!!item.city && <Text style={s.cardSub}>📍 {item.city}</Text>}
            <Text style={[s.cardSub, { color: '#7C3D8F', fontWeight: '600', marginTop: 2 }]}>
              Vient de rejoindre FreshGirlz
            </Text>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function PhotoCard({ item, onPhotoPress, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.cardWrap}>
      <BlurView intensity={60} tint="light" style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: '#0071E3' }]} />
        <View style={s.cardTop}>
          <View style={[s.typeTag, { backgroundColor: 'rgba(0,113,227,0.12)' }]}>
            <Text style={[s.typeLabel, { color: '#0071E3' }]}>📸 Photo partagée</Text>
          </View>
          <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={s.cardBody}>
          <Avatar uri={item.barbers?.photo_url} initials={item.barbers?.name || 'B'} />
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{item.barbers?.name || 'Coiffeuse'}</Text>
            {!!item.service && <Text style={s.cardSub}>{item.service}</Text>}
            {item.likes > 0 && (
              <Text style={s.likesText}>❤️ {item.likes} like{item.likes > 1 ? 's' : ''}</Text>
            )}
          </View>
          {!!item.photo_url && (
            <TouchableOpacity onPress={() => onPhotoPress(item.photo_url)} activeOpacity={0.85}>
              <Image source={{ uri: item.photo_url }} style={s.photoThumb} />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function BarberCard({ item, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={s.cardWrap}>
      <BlurView intensity={60} tint="light" style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: '#1C1C1E' }]} />
        <View style={s.cardTop}>
          <View style={[s.typeTag, { backgroundColor: 'rgba(28,28,30,0.08)' }]}>
            <Text style={[s.typeLabel, { color: '#1C1C1E' }]}>👋 Nouveau Coiffeuse</Text>
          </View>
          <Text style={s.timeAgo}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={s.cardBody}>
          <Avatar uri={item.photo_url} size={44} initials={item.name || 'B'} />
          <View style={s.cardInfo}>
            <Text style={s.cardName}>{item.name}</Text>
            {!!item.salons?.name && <Text style={s.cardSub}>📍 {item.salons.name}</Text>}
            <Text style={[s.cardSub, { color: '#1C1C1E', fontWeight: '600', marginTop: 2 }]}>
              Vient de rejoindre la plateforme
            </Text>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

// ── Main ─────────────────────────────────────────────────────────

export default function CommunityScreen({ navigation }) {
  const [feed,       setFeed]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoUri,   setPhotoUri]   = useState(null);
  const photoOpacity = useState(new Animated.Value(0))[0];

  useFocusEffect(useCallback(() => { loadFeed(); }, []));

  async function loadFeed() {
    const [reviewsRes, salonsRes, coupesRes, barbersRes] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, rating, comment, created_at, coiffeuses(id, name, photo_url, salons(name)), clientes(id, name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('salons')
        .select('id, name, photo_url, city, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coupes')
        .select('id, photo_url, service, likes, created_at, coiffeuses(id, name, photo_url)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('coiffeuses')
        .select('id, name, photo_url, rating, created_at, salons(name)')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const reviews = (reviewsRes.data || []).map(r => ({ ...r, _type: 'review' }));
    const salons  = (salonsRes.data  || []).map(s => ({ ...s, _type: 'salon'  }));
    const coupes  = (coupesRes.data  || []).map(c => ({ ...c, _type: 'photo'  }));
    const barbers = (barbersRes.data || []).map(b => ({ ...b, _type: 'barber' }));

    const merged = [...reviews, ...salons, ...coupes, ...barbers]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFeed(merged);
    setLoading(false);
    setRefreshing(false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadFeed();
  }

  function openPhoto(uri) {
    setPhotoUri(uri);
    photoOpacity.setValue(0);
    Animated.spring(photoOpacity, { toValue: 1, useNativeDriver: true }).start();
  }

  function closePhoto() {
    Animated.timing(photoOpacity, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(() => setPhotoUri(null));
  }

  function renderItem({ item }) {
    if (item._type === 'review') {
      return (
        <ReviewCard
          item={item}
          onPress={() => item.barbers?.id && navigation.navigate('BarberProfile', { barber: item.barbers })}
        />
      );
    }
    if (item._type === 'salon') {
      return (
        <SalonCard
          item={item}
          onPress={() => navigation.navigate('SalonPublic', { salonId: item.id })}
        />
      );
    }
    if (item._type === 'photo') {
      return (
        <PhotoCard
          item={item}
          onPhotoPress={openPhoto}
          onPress={() => item.barbers?.id && navigation.navigate('BarberProfile', { barber: item.barbers })}
        />
      );
    }
    if (item._type === 'barber') {
      return (
        <BarberCard
          item={item}
          onPress={() => navigation.navigate('BarberProfile', { barber: item })}
        />
      );
    }
    return null;
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
        <View>
          <Text style={s.headerTitle}>Communauté</Text>
          <Text style={s.headerSub}>Activités récentes sur FreshGirlz</Text>
        </View>
      </View>

      {/* Feed */}
      {loading ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>Chargement…</Text>
        </View>
      ) : feed.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={s.emptyEmoji}>🌱</Text>
          <Text style={s.emptyText}>Aucune activité pour le moment</Text>
          <Text style={s.emptySub}>Reviens bientôt !</Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={item => `${item._type}_${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3D8F" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Photo fullscreen */}
      {photoUri && (
        <Modal transparent animationType="none" onRequestClose={closePhoto}>
          <Animated.View style={[s.photoModal, { opacity: photoOpacity }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closePhoto} activeOpacity={1}>
              <Image source={{ uri: photoUri }} style={s.photoFull} resizeMode="contain" />
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#F2F2F7' },
  wallpaper:{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  blob1:    { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(124,61,143,0.07)',  top: -60,  left: -60 },
  blob2:    { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.06)', top: 180,  right: -50 },
  blob3:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,113,227,0.05)',  bottom: 80, left: 30 },

  header:      { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: 'rgba(28,28,30,0.45)', marginTop: 1 },

  listContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 },

  cardWrap: { marginBottom: 12 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 3 },

  cardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  typeTag:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typeLabel:{ fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  timeAgo:  { fontSize: 11, color: 'rgba(28,28,30,0.4)' },

  cardBody: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  cardSub:  { fontSize: 12, color: 'rgba(28,28,30,0.5)', lineHeight: 16 },

  avatar:         { resizeMode: 'cover' },
  avatarFallback: { backgroundColor: 'rgba(28,28,30,0.1)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },

  starRow:   { flexDirection: 'row', marginTop: 3 },
  star:      { fontSize: 12, color: 'rgba(28,28,30,0.2)', marginRight: 1 },
  starFilled:{ color: '#A8852A' },

  reviewComment: { fontSize: 12, color: 'rgba(28,28,30,0.6)', fontStyle: 'italic', marginTop: 8, lineHeight: 17 },

  salonThumb: { width: 52, height: 52, borderRadius: 12, resizeMode: 'cover' },
  salonThumbFallback: { backgroundColor: 'rgba(124,61,143,0.1)', alignItems: 'center', justifyContent: 'center' },

  photoThumb: { width: 56, height: 56, borderRadius: 10, resizeMode: 'cover' },
  likesText:  { fontSize: 11, color: '#C0392B', marginTop: 3, fontWeight: '600' },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText:  { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  emptySub:   { fontSize: 13, color: 'rgba(28,28,30,0.45)', marginTop: 4 },

  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  photoFull:  { width: SW, height: '85%' },
});

