import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export default function AfterCutCoiffeuseScreen({ navigation, route }) {
  const { currentClient, nextClient, waitingQueue, barberInfo, elapsedSeconds } = route.params || {};
  const [avisEnvoye, setAvisEnvoye] = useState(false);
  const [photoVisibility, setPhotoVisibility] = useState('public');
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  useEffect(() => {
    notifyQueueAdvance();
  }, []);

  async function notifyQueueAdvance() {
    const queue = waitingQueue || [];
    // index 0 = nextClient → notifié quand le Coiffeuse clique "Inviter"
    // index 1 → "Tu es le prochain !"
    // index 2+ → "Tu as avancé d'une place"
    const toNotify = queue.slice(1);
    if (!toNotify.length) return;

    const clientIds = toNotify.map(c => c.client_id).filter(Boolean);
    if (!clientIds.length) return;

    const { data: clientUsers } = await supabase
      .from('clientes')
      .select('id, user_id')
      .in('id', clientIds);

    if (!clientUsers?.length) return;

    const userMap = Object.fromEntries(clientUsers.map(c => [c.id, c.user_id]));
    const barberName = barberInfo?.name || 'ton Coiffeuse';

    const notifications = toNotify
      .map((client, idx) => {
        const user_id = userMap[client.client_id];
        if (!user_id) return null;
        const isNextUp = idx === 0;
        const remaining = toNotify.length - idx;
        return {
          recipient_user_id: user_id,
          type: 'queue_advance',
          title: isNextUp ? 'Tu es le prochain ! 🔜' : "Tu as avancé d'une place 📈",
          body: isNextUp
            ? `Prépare-toi, c'est bientôt ton tour chez ${barberName}`
            : `La file avance ! Plus que ${remaining} personne${remaining > 1 ? 's' : ''} avant toi`,
          data: { barber_id: barberInfo?.id },
          read: false,
        };
      })
      .filter(Boolean);

    if (notifications.length) {
      await supabase.from('notifications').insert(notifications);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l'accès à la caméra pour prendre la photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0].uri);
      setPhotoUploaded(false);
    }
  }

  async function publishPhoto() {
    if (!photo || uploading) return;
    setUploading(true);
    try {
      const response = await fetch(photo);
      const arrayBuffer = await response.arrayBuffer();
      // Force JPEG — arraybuffer + contentType explicite = fiable sur iOS
      const filename = `coupes/barber_${barberInfo?.id}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('photos-coupes')
        .upload(filename, arrayBuffer, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos-coupes')
        .getPublicUrl(filename);

      const isPublic = photoVisibility === 'public';
      const { data: coupe } = await supabase.from('coupes').insert({
        barber_id: barberInfo?.id,
        salon_id: barberInfo?.salons?.id || barberInfo?.salon_id || null,
        client_id: currentClient?.client_id || null,
        service: currentClient?.service,
        photo_url: publicUrl,
        is_public: isPublic,
        is_private: !isPublic,
      }).select().single();

      if (isPublic && coupe?.id) {
        await supabase.from('feed_events').insert({
          type: 'new_coupe',
          coupe_id: coupe.id,
          barber_id: barberInfo?.id,
          created_at: new Date().toISOString(),
        });
      }

      if (currentClient?.client_id && coupe?.id) {
        const { data: clientData } = await supabase
          .from('clientes')
          .select('user_id')
          .eq('id', currentClient.client_id)
          .single();
        if (clientData?.user_id) {
          await supabase.from('notifications').insert({
            recipient_user_id: clientData.user_id,
            type: 'barber_photo',
            title: 'Photo de ta coupe 📸',
            body: `${barberName} a partagé une photo de ta coupe`,
            data: {
              coupe_id: coupe.id,
              photo_url: publicUrl,
              is_public: isPublic,
              barber_id: barberInfo?.id,
              barber_name: barberName,
              screen: 'PhotoConsent',
            },
            read: false,
          });
        }
      }

      setPhotoUploaded(true);
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'envoyer la photo. Réessaie.");
      console.log('Erreur upload photo Coiffeuse:', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSendAvis() {
    if (avisEnvoye) return;
    try {
      const { data: clientData } = await supabase
        .from('clientes')
        .select('user_id')
        .eq('id', currentClient?.client_id)
        .single();
      if (clientData?.user_id) {
        await supabase.from('notifications').insert({
          recipient_user_id: clientData.user_id,
          type: 'review_request',
          title: 'Donne ton avis ! ⭐',
          body: `${barberName} aimerait avoir ton retour sur ta coupe`,
          data: {
            barber_id: barberInfo?.id,
            queue_id: currentClient?.id,
            barber_name: barberName,
            service: currentClient?.service,
            screen: 'AfterCut',
          },
          read: false,
        });
      }
    } catch (err) {
      console.log('Erreur envoi demande avis:', err.message);
    }
    setAvisEnvoye(true);
  }

  const [starting, setStarting] = useState(false);

  async function handleDemarrerSuivant() {
    if (!nextClient || starting) return;
    setStarting(true);
    await supabase
      .from('queue')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', nextClient.id);

    const { data: clientUser } = await supabase
      .from('clientes')
      .select('user_id')
      .eq('id', nextClient.client_id)
      .single();
    if (clientUser?.user_id) {
      await supabase.from('notifications').insert({
        recipient_user_id: clientUser.user_id,
        type: 'your_turn',
        title: "C'est ton tour ! ✂",
        body: `${barberInfo?.name || 'Ton Coiffeuse'} t'attend, viens t'installer.`,
        data: { barber_id: barberInfo?.id },
        read: false,
      });
    }
    navigation.navigate('CoiffeuseDashboard');
  }

  const initials = (name) => name?.split(' ').map(n => n[0]).join('') || '?';
  const estimatedDur = currentClient?.duration || currentClient?.estimated_wait;
  const duration = elapsedSeconds > 0 ? Math.round(elapsedSeconds / 60) : (estimatedDur || '?');
  const barberName = barberInfo?.name || 'Coiffeuse';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HEADER */}
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Coupe terminée</Text>

        {/* RECAP CLIENT */}
        <BlurView intensity={60} tint="light" style={styles.card}>
          <View style={styles.row}>
            <View style={styles.av}>
              <Text style={styles.avText}>{initials(currentClient?.client_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{currentClient?.client_name}</Text>
              <Text style={styles.sub}>{currentClient?.service}</Text>
              <View style={styles.badgeGreen}>
                <Text style={styles.badgeGreenText}>Terminé · {duration} min</Text>
              </View>
            </View>
          </View>
          <View style={styles.sep} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Durée réelle</Text>
            <Text style={styles.infoVal}>{duration} min</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Durée estimée</Text>
            <Text style={styles.infoVal}>{estimatedDur || '?'} min</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Coiffeuse</Text>
            <Text style={styles.infoVal}>{barberName}</Text>
          </View>
        </BlurView>

        {/* AVIS */}
        <Text style={styles.sectionLabel}>Avis client</Text>
        <TouchableOpacity
          style={[styles.avisBtn, avisEnvoye && styles.avisBtnDone]}
          onPress={handleSendAvis}
          activeOpacity={0.8}>
          <View style={styles.row}>
            <View style={[styles.avisIcon, avisEnvoye && styles.avisIconDone]}>
              <Text style={styles.avisIconText}>⭐</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.avisText}>
                {avisEnvoye ? 'Demande envoyée' : 'Demander un avis'}
              </Text>
              <Text style={styles.avisSub}>
                {avisEnvoye
                  ? `${currentClient?.client_name} a reçu une notification`
                  : `Envoyer une notif à ${currentClient?.client_name}`}
              </Text>
            </View>
            <View style={[styles.check, avisEnvoye && styles.checkDone]}>
              {avisEnvoye && <Text style={styles.checkMark}>✓</Text>}
            </View>
          </View>
        </TouchableOpacity>

        {/* PHOTO */}
        <Text style={styles.sectionLabel}>Photo de la coupe</Text>
        <BlurView intensity={55} tint="light" style={styles.card}>
          {photo ? (
            <>
              <Image source={{ uri: photo }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={takePhoto}>
                <Text style={styles.retakeBtnText}>📷 Reprendre</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.photoZone} onPress={takePhoto} activeOpacity={0.8}>
              <Text style={styles.photoZoneIcon}>📷</Text>
              <Text style={styles.photoZoneText}>Prendre une photo</Text>
              <Text style={styles.photoZoneSub}>Ouvre l'appareil photo</Text>
            </TouchableOpacity>
          )}
          <View style={styles.photoOpts}>
            {['public', 'private'].map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.photoOpt, photoVisibility === opt && styles.photoOptSelected]}
                onPress={() => setPhotoVisibility(opt)}>
                <Text style={styles.photoOptLabel}>
                  {opt === 'public' ? '🌍 Book public' : '🔒 Privée'}
                </Text>
                <Text style={styles.photoOptSub}>
                  {opt === 'public' ? 'Visible par les clients' : 'Toi seul'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {photo && !photoUploaded && (
            <TouchableOpacity
              style={[styles.publishBtn, uploading && { opacity: 0.6 }]}
              onPress={publishPhoto}
              disabled={uploading}
              activeOpacity={0.85}>
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.publishBtnText}>
                  {photoVisibility === 'public' ? 'Publier dans mon book →' : 'Enregistrer en privé →'}
                </Text>
              )}
            </TouchableOpacity>
          )}
          {photoUploaded && (
            <View style={styles.uploadedBadge}>
              <Text style={styles.uploadedBadgeText}>
                ✓ Photo enregistrée · client notifié
              </Text>
            </View>
          )}
        </BlurView>

        {/* CLIENT SUIVANT */}
        {nextClient ? (
          <>
            <Text style={styles.sectionLabel}>Client suivant</Text>
            <BlurView intensity={60} tint="light" style={styles.nextCard}>
              <View style={styles.nextHeader}>
                <View style={styles.avGold}>
                  <Text style={styles.avGoldText}>{initials(nextClient?.client_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{nextClient?.client_name}</Text>
                  <Text style={styles.sub}>{nextClient?.service} · ~{nextClient?.estimated_wait} min</Text>
                </View>
                <View style={styles.badgeGold}>
                  <Text style={styles.badgeGoldText}>Suivant</Text>
                </View>
              </View>
              <View style={styles.sep} />
              <TouchableOpacity
                style={[styles.inviteBtn, starting && { opacity: 0.6 }]}
                onPress={handleDemarrerSuivant}
                disabled={starting}
                activeOpacity={0.85}>
                <Text style={styles.inviteBtnText}>
                  {starting ? 'Démarrage...' : '✂ Démarrer suivant →'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, { marginTop: 8, marginHorizontal: 0 }]}
                onPress={() => navigation.navigate('CoiffeuseDashboard')}>
                <Text style={styles.btnSecondaryText}>Ignorer · retour accueil</Text>
              </TouchableOpacity>
            </BlurView>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: '#7C3D8F', marginTop: 8 }]}
            onPress={() => navigation.navigate('CoiffeuseDashboard')}>
            <Text style={styles.btnPrimaryText}>✓ Validée — Retour accueil</Text>
          </TouchableOpacity>
        )}

        {/* PASSER */}
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnSecondaryText}>Passer sans photo ni avis</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0FAEE' },
  blob1: { position: 'absolute', top: -40, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.15)' },
  blob2: { position: 'absolute', bottom: 60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(168,133,42,0.12)' },

  back: { padding: 16, paddingBottom: 4 },
  backText: { fontSize: 14, color: '#0071E3' },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8, marginTop: 14 },

  card: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 13, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  av: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(124,61,143,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avText: { fontSize: 14, fontWeight: '700', color: '#0F6E56' },
  avGold: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avGoldText: { fontSize: 14, fontWeight: '700', color: '#854F0B' },

  name: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  sub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2 },

  badgeGreen: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 5 },
  badgeGreenText: { fontSize: 10, fontWeight: '600', color: '#0F6E56' },
  badgeGold: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', flexShrink: 0 },
  badgeGoldText: { fontSize: 10, fontWeight: '700', color: '#854F0B' },

  sep: { height: 0.5, backgroundColor: 'rgba(28,28,30,0.08)', marginVertical: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },
  infoVal: { fontSize: 12, fontWeight: '600', color: '#1C1C1E' },

  // AVIS
  avisBtn: { marginHorizontal: 16, borderRadius: 12, padding: 13, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)', backgroundColor: 'rgba(168,133,42,0.07)', marginBottom: 4 },
  avisBtnDone: { backgroundColor: 'rgba(124,61,143,0.08)', borderColor: 'rgba(124,61,143,0.3)' },
  avisIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(168,133,42,0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avisIconDone: { backgroundColor: 'rgba(124,61,143,0.15)' },
  avisIconText: { fontSize: 15 },
  avisText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', marginBottom: 1 },
  avisSub: { fontSize: 11, color: 'rgba(28,28,30,0.45)' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkDone: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  checkMark: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // PHOTO
  photoZone: { borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(28,28,30,0.12)', borderStyle: 'dashed', padding: 20, alignItems: 'center', backgroundColor: 'rgba(28,28,30,0.02)', marginBottom: 10 },
  photoZoneIcon: { fontSize: 24, marginBottom: 6 },
  photoZoneText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  photoZoneSub: { fontSize: 11, color: 'rgba(28,28,30,0.45)', marginTop: 3 },
  photoPreview: { width: '100%', aspectRatio: 4 / 5, borderRadius: 10, backgroundColor: '#1C1C1E', marginBottom: 8 },
  retakeBtn: { borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.15)', backgroundColor: 'rgba(28,28,30,0.04)', marginBottom: 10 },
  retakeBtnText: { fontSize: 12, color: 'rgba(28,28,30,0.55)' },
  photoOpts: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  photoOpt: { flex: 1, borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)', backgroundColor: 'rgba(28,28,30,0.03)' },
  photoOptSelected: { borderColor: 'rgba(124,61,143,0.4)', backgroundColor: 'rgba(124,61,143,0.08)' },
  photoOptLabel: { fontSize: 11, fontWeight: '600', color: '#1C1C1E' },
  photoOptSub: { fontSize: 9, color: 'rgba(28,28,30,0.45)', marginTop: 2 },
  publishBtn: { backgroundColor: '#7C3D8F', borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 2 },
  publishBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  uploadedBadge: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 8, padding: 9, alignItems: 'center', marginTop: 2 },
  uploadedBadgeText: { fontSize: 12, fontWeight: '600', color: '#0F6E56' },

  // CLIENT SUIVANT
  nextCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 13, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.25)', marginBottom: 4 },
  nextHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inviteBtn: { backgroundColor: '#7C3D8F', borderRadius: 10, padding: 12, alignItems: 'center' },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  btnPrimary: { marginHorizontal: 16, borderRadius: 12, padding: 13, alignItems: 'center' },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  btnSecondary: { marginHorizontal: 16, borderRadius: 12, padding: 11, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', backgroundColor: 'rgba(28,28,30,0.04)', marginTop: 8 },
  btnSecondaryText: { fontSize: 12, color: 'rgba(28,28,30,0.55)' },
});

