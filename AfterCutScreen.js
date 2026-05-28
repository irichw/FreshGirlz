import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, TextInput, Image, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';

export default function AfterCutScreen({ navigation, route }) {
  const [rating, setRating] = useState(0);
  const [isRef, setIsRef] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [comment, setComment] = useState('');
  const [cutPhoto, setCutPhoto] = useState(null);
  const [photoVisibility, setPhotoVisibility] = useState('public');
  const [existingReview, setExistingReview] = useState(null);
  const [checkingReview, setCheckingReview] = useState(true);

  const barberId = route.params?.barberId;
  const queueId = route.params?.queueId;
  const barber = route.params?.barber;
  const service = route.params?.service || route.params?.barberService;
  const salonName = barber?.salons?.name || 'Salon';
  const barberName = barber?.name || route.params?.barberName || 'Coiffeuse';

  useEffect(() => {
    async function checkExistingReview() {
      if (!queueId && !barberId) { setCheckingReview(false); return; }

      // 1. Recherche précise par queue_id
      if (queueId) {
        const { data } = await supabase
          .from('reviews')
          .select('rating, comment, created_at')
          .eq('queue_id', queueId)
          .maybeSingle();
        if (data) { setExistingReview(data); setCheckingReview(false); return; }
      }

      // 2. Fallback : avis de ce client pour ce Coiffeuse dans les 48h
      if (barberId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setCheckingReview(false); return; }
        const { data: clientRow } = await supabase
          .from('clientes')
          .select('id')
          .eq('user_id', session.user.id)
          .single();
        if (clientRow) {
          const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const { data: rows } = await supabase
            .from('reviews')
            .select('rating, comment, created_at, queue!inner(client_id)')
            .eq('barber_id', barberId)
            .eq('queue.client_id', clientRow.id)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1);
          if (rows?.length) { setExistingReview(rows[0]); setCheckingReview(false); return; }
        }
      }

      setCheckingReview(false);
    }
    checkExistingReview();
  }, [queueId, barberId]);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l'accès à la caméra pour prendre ta photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setCutPhoto(result.assets[0].uri);
    }
  }

  async function uploadPhotoAndPublish(clientId) {
    if (!cutPhoto) return;
    try {
      const response = await fetch(cutPhoto);
      const arrayBuffer = await response.arrayBuffer();
      // Force JPEG — arraybuffer + contentType explicite = fiable sur iOS
      const filename = `coupes/${clientId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('photos-coupes')
        .upload(filename, arrayBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos-coupes')
        .getPublicUrl(filename);

      const isPublic = photoVisibility === 'public';
      const { data: coupe } = await supabase.from('coupes').insert({
        client_id: clientId,
        barber_id: barberId,
        service,
        photo_url: publicUrl,
        is_public: isPublic,
        is_private: !isPublic,
      }).select().single();

      if (isPublic && coupe?.id) {
        await supabase.from('feed_events').insert({
          type: 'new_coupe',
          coupe_id: coupe.id,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.log('Erreur upload photo:', err.message);
    }
  }

  async function notifyNextAndUpdate() {
    if (!queueId || !barberId) return;
    try {
      const [{ data: barberData }, { data: { session } }, { data: queueData }] = await Promise.all([
        supabase.from('coiffeuses').select('user_id').eq('id', barberId).single(),
        supabase.auth.getSession(),
        supabase.from('queue').select('client_id, client_name').eq('id', queueId).single(),
      ]);

      if (cutPhoto && queueData?.client_id) {
        await uploadPhotoAndPublish(queueData.client_id);
      }

      if (rating > 0) {
        const { data: review } = await supabase.from('reviews').insert({
          barber_id: barberId,
          queue_id: queueId,
          client_id: queueData?.client_id || null,
          rating,
          comment,
        }).select().single();

        if (barberData?.user_id) {
          await supabase.from('notifications').insert({
            recipient_user_id: barberData.user_id,
            type: 'new_review',
            title: 'Tu as reçu un avis',
            body: `${queueData?.client_name || 'Un client'} t'a noté ${rating}★`,
            data: {
              review_id: review?.id,
              client_id: queueData?.client_id,
              client_name: queueData?.client_name || 'Client',
              rating,
              comment,
            },
            read: false,
          });
        }
      }

      const { data } = await supabase
        .from('queue')
        .select('status')
        .eq('id', queueId)
        .maybeSingle();

      if (data && data.status !== 'done') {
        await supabase.from('queue').update({ status: 'done' }).eq('id', queueId);
      }
    } catch (error) {
      console.log('Erreur:', error.message);
    }
  }

  if (checkingReview) return null;

  if (existingReview) {
    const stars = '★'.repeat(existingReview.rating) + '☆'.repeat(5 - existingReview.rating);
    const date = new Date(existingReview.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.wallpaper}>
          <View style={styles.blob1} />
          <View style={styles.blob2} />
        </View>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Avis déjà envoyé</Text>
          <Text style={styles.doneSub}>Tu as déjà laissé un avis pour cette coupe</Text>
          <BlurView intensity={60} tint="light" style={[styles.doneCard, { width: '100%' }]}>
            <View style={styles.existingStars}>
              {[1,2,3,4,5].map(s => (
                <Text key={s} style={[styles.existingStar, s <= existingReview.rating && styles.existingStarActive]}>★</Text>
              ))}
            </View>
            {existingReview.comment ? (
              <Text style={styles.existingComment}>"{existingReview.comment}"</Text>
            ) : (
              <Text style={styles.existingCommentEmpty}>Aucun commentaire</Text>
            )}
            <Text style={styles.existingDate}>Posté le {date}</Text>
          </BlurView>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.wallpaper}>
          <View style={styles.blob1} />
          <View style={styles.blob2} />
        </View>
        <View style={styles.doneContainer}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.doneTitle}>Merci !</Text>
          <Text style={styles.doneSub}>Ton avis aide la communauté FreshGirlz</Text>
          {cutPhoto && (
            <BlurView intensity={60} tint="light" style={styles.donePhotoCard}>
              <Image source={{ uri: cutPhoto }} style={styles.donePhotoThumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.donePhotoLabel}>
                  {photoVisibility === 'public' ? '🌍 Photo publiée dans ton book' : '🔒 Photo dans ton book privé'}
                </Text>
                {photoVisibility === 'public' && (
                  <Text style={styles.donePhotoSub}>Visible dans le feed de tes amis</Text>
                )}
              </View>
            </BlurView>
          )}
          <BlurView intensity={60} tint="light" style={styles.doneCard}>
            <Text style={styles.doneCardTitle}>Prochaine coupe</Text>
            <Text style={styles.doneCardSub}>Dans environ 21 jours</Text>
            <View style={styles.reminderRow}>
              <Text style={styles.reminderText}>🔔 Activer le rappel</Text>
              <View style={styles.toggle}>
                <View style={styles.toggleThumbOn} />
              </View>
            </View>
          </BlurView>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroBg}>
            <Text style={styles.heroBgEmoji}>✂</Text>
          </View>
          <View style={styles.heroOverlay} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Coupe terminée ✓</Text>
          </View>
          <View style={styles.heroBottom}>
            <Text style={styles.heroTitle}>Comment s'est passée ta coupe ?</Text>
            <Text style={styles.heroSub}>{salonName} · {barberName} · {service}</Text>
          </View>
        </View>

        {/* NOTE */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Ta note</Text>
        </View>
        <BlurView intensity={60} tint="light" style={styles.ratingCard}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)}>
                <Text style={[styles.star, s <= rating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating === 0 ? 'Appuie pour noter' :
             rating === 1 ? 'Décevant 😕' :
             rating === 2 ? 'Peut mieux faire 😐' :
             rating === 3 ? 'Correct 🙂' :
             rating === 4 ? 'Très bien 😊' : 'Parfait ! 🔥'}
          </Text>
        </BlurView>

        {/* COMMENTAIRE */}
        <BlurView intensity={55} tint="light" style={styles.commentCard}>
          <TextInput
            style={styles.commentInput}
            placeholder={`Un commentaire ? ${barberName} sera ravi de lire...`}
            placeholderTextColor="rgba(28,28,30,0.35)"
            multiline
            value={comment}
            onChangeText={setComment}
          />
        </BlurView>

        {/* PHOTO */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Ta coupe</Text>
        </View>

        {cutPhoto ? (
          <BlurView intensity={60} tint="light" style={styles.photoPreviewCard}>
            <Image source={{ uri: cutPhoto }} style={styles.photoPreview} />

            {/* VISIBILITÉ */}
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visBtn, photoVisibility === 'public' && styles.visBtnPublicActive]}
                onPress={() => setPhotoVisibility('public')}
                activeOpacity={0.8}>
                <Text style={styles.visBtnIcon}>🌍</Text>
                <Text style={[styles.visBtnLabel, photoVisibility === 'public' && styles.visBtnLabelPublic]}>
                  Publier
                </Text>
                <Text style={styles.visBtnSub}>Book public · feed amis</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visBtn, photoVisibility === 'private' && styles.visBtnPrivateActive]}
                onPress={() => setPhotoVisibility('private')}
                activeOpacity={0.8}>
                <Text style={styles.visBtnIcon}>🔒</Text>
                <Text style={[styles.visBtnLabel, photoVisibility === 'private' && styles.visBtnLabelPrivate]}>
                  Privée
                </Text>
                <Text style={styles.visBtnSub}>Book privé seulement</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeBtnText}>📷 Reprendre une photo</Text>
            </TouchableOpacity>
          </BlurView>
        ) : (
          <TouchableOpacity onPress={takePhoto} activeOpacity={0.8}>
            <BlurView intensity={60} tint="light" style={styles.photoZone}>
              <View style={styles.photoZoneIconBg}>
                <Text style={styles.photoZoneIcon}>📷</Text>
              </View>
              <Text style={styles.photoZoneTitle}>Prends ta coupe en photo</Text>
              <Text style={styles.photoZoneSub}>Appareil photo · portrait 4:5</Text>
            </BlurView>
          </TouchableOpacity>
        )}

        {/* DÉFINIR COMME RÉFÉRENCE */}
        <BlurView intensity={60} tint="light"
          style={[styles.refCard, isRef && styles.refCardActive]}>
          <View style={styles.refLeft}>
            <Text style={styles.refIcon}>{isRef ? '🔖' : '📌'}</Text>
            <View>
              <Text style={styles.refTitle}>
                {isRef ? 'Défini comme référence ✓' : 'Définir comme référence ?'}
              </Text>
              <Text style={styles.refSub}>
                {isRef
                  ? `${barberName} verra cette coupe à ta prochaine visite`
                  : `${barberName} aura ce modèle pour ta prochaine visite`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.refToggle, isRef && styles.refToggleActive]}
            onPress={() => setIsRef(!isRef)}>
            <View style={[styles.refThumb, isRef && styles.refThumbActive]} />
          </TouchableOpacity>
        </BlurView>

        {/* SOUMETTRE */}
        <TouchableOpacity
          style={styles.submitBtn}
          activeOpacity={0.85}
          disabled={submitted}
          onPress={async () => {
            if (submitted) return;
            setSubmitted(true);
            await notifyNextAndUpdate();
          }}>
          <Text style={styles.submitBtnText}>Envoyer mon avis →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.2)' },
  blob2: { position: 'absolute', bottom: 100, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(124,61,143,0.15)' },
  blob3: { position: 'absolute', top: 300, left: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(60,160,255,0.12)' },

  // HERO
  hero: { height: 150, position: 'relative' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#2C1A06', alignItems: 'center', justifyContent: 'center' },
  heroBgEmoji: { fontSize: 70, opacity: 0.08 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.6)' },
  heroBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  heroBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  heroBottom: { position: 'absolute', bottom: 14, left: 14 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  // SECTION
  secRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  secTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },

  // RATING
  ratingCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  star: { fontSize: 36, color: 'rgba(28,28,30,0.15)' },
  starActive: { color: '#A8852A' },
  ratingLabel: { fontSize: 14, color: 'rgba(28,28,30,0.55)', fontWeight: '500' },

  // COMMENTAIRE
  commentCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 8, minHeight: 70 },
  commentInput: { fontSize: 13, color: '#1C1C1E', minHeight: 60 },

  // PHOTO ZONE (sans photo)
  photoZone: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.25)', marginBottom: 8 },
  photoZoneIconBg: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  photoZoneIcon: { fontSize: 26 },
  photoZoneTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 3 },
  photoZoneSub: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },

  // PHOTO PREVIEW (avec photo)
  photoPreviewCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  photoPreview: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#1C1C1E' },
  visibilityRow: { flexDirection: 'row', gap: 8, padding: 10 },
  visBtn: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(28,28,30,0.1)', backgroundColor: 'rgba(28,28,30,0.03)' },
  visBtnPublicActive: { borderColor: 'rgba(168,133,42,0.5)', backgroundColor: 'rgba(168,133,42,0.1)' },
  visBtnPrivateActive: { borderColor: 'rgba(60,100,200,0.4)', backgroundColor: 'rgba(60,100,200,0.08)' },
  visBtnIcon: { fontSize: 20, marginBottom: 4 },
  visBtnLabel: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  visBtnLabelPublic: { color: '#A8852A' },
  visBtnLabelPrivate: { color: '#3C64C8' },
  visBtnSub: { fontSize: 10, color: 'rgba(28,28,30,0.45)', marginTop: 2, textAlign: 'center' },
  retakeBtn: { marginHorizontal: 10, marginBottom: 10, borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', backgroundColor: 'rgba(28,28,30,0.04)' },
  retakeBtnText: { fontSize: 12, color: 'rgba(28,28,30,0.55)', fontWeight: '500' },

  // RÉFÉRENCE
  refCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 13, flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 14 },
  refCardActive: { borderColor: 'rgba(168,133,42,0.4)', backgroundColor: 'rgba(168,133,42,0.08)' },
  refLeft: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  refIcon: { fontSize: 22 },
  refTitle: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  refSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2, lineHeight: 15 },
  refToggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.15)', position: 'relative', flexShrink: 0 },
  refToggleActive: { backgroundColor: '#A8852A' },
  refThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, left: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  refThumbActive: { left: 22 },

  // SUBMIT
  submitBtn: { marginHorizontal: 16, backgroundColor: 'rgba(168,133,42,0.18)', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(168,133,42,0.4)' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#A8852A' },

  // DONE
  doneContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 },
  doneEmoji: { fontSize: 60 },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.8 },
  doneSub: { fontSize: 14, color: 'rgba(28,28,30,0.55)', textAlign: 'center' },
  donePhotoCard: { width: '100%', borderRadius: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  donePhotoThumb: { width: 52, height: 52, borderRadius: 10 },
  donePhotoLabel: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  donePhotoSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },
  doneCard: { width: '100%', borderRadius: 16, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  doneCardTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  doneCardSub: { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  reminderText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#7C3D8F', position: 'relative' },
  toggleThumbOn: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, right: 2 },
  homeBtn: { width: '100%', backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 16, padding: 15, alignItems: 'center' },
  homeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  existingStars: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  existingStar: { fontSize: 24, color: 'rgba(28,28,30,0.15)' },
  existingStarActive: { color: '#A8852A' },
  existingComment: { fontSize: 14, color: '#1C1C1E', fontStyle: 'italic', lineHeight: 20, marginBottom: 8 },
  existingCommentEmpty: { fontSize: 13, color: 'rgba(28,28,30,0.4)', marginBottom: 8 },
  existingDate: { fontSize: 11, color: 'rgba(28,28,30,0.4)' },
});

