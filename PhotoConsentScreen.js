import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Image, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function PhotoConsentScreen({ navigation, route }) {
  const {
    coupe_id,
    photo_url,
    is_public,
    barber_id,
    barber_name,
    notification_id,
  } = route.params || {};

  const [decision, setDecision] = useState(null); // 'saved' | 'opposed'
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(null);

  useEffect(() => {
    async function init() {
      if (notification_id) {
        await supabase.from('notifications').update({ read: true }).eq('id', notification_id);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
      if (data) setClientId(data.id);
    }
    init();
  }, []);

  async function handleSave() {
    if (!clientId || !coupe_id || loading) return;
    setLoading(true);
    try {
      await supabase.from('coupe_inspirations').upsert(
        { client_id: clientId, coupe_id },
        { onConflict: 'client_id,coupe_id' }
      );
      setDecision('saved');
    } catch (err) {
      Alert.alert('Erreur', "Impossible d'enregistrer la photo.");
      console.log('Erreur save photo:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOppose() {
    if (loading) return;
    Alert.alert(
      "S'opposer à l'utilisation",
      "La photo sera supprimée du book du Coiffeuse. Cette action est irréversible.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await supabase.from('coupes').delete().eq('id', coupe_id);

              const { data: barberData } = await supabase
                .from('coiffeuses')
                .select('user_id, name')
                .eq('id', barber_id)
                .single();
              if (barberData?.user_id) {
                await supabase.from('notifications').insert({
                  recipient_user_id: barberData.user_id,
                  type: 'photo_removed',
                  title: 'Photo retirée 🗑',
                  body: "Un client s'est opposé à l'utilisation de sa photo. Elle a été supprimée.",
                  data: { coupe_id },
                  read: false,
                });
              }
              setDecision('opposed');
            } catch (err) {
              Alert.alert('Erreur', "Impossible de traiter ta demande.");
              console.log('Erreur opposition photo:', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  if (decision === 'saved') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.wallpaper}>
          <View style={styles.blob1} />
          <View style={styles.blob2} />
        </View>
        <View style={styles.resultContainer}>
          <Text style={styles.resultEmoji}>🔖</Text>
          <Text style={styles.resultTitle}>Enregistrée !</Text>
          <Text style={styles.resultSub}>La photo a été ajoutée à tes inspirations</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('ClientTabs')}>
            <Text style={styles.homeBtnText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (decision === 'opposed') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.wallpaper}>
          <View style={styles.blob1} />
          <View style={styles.blob2} />
        </View>
        <View style={styles.resultContainer}>
          <Text style={styles.resultEmoji}>✓</Text>
          <Text style={styles.resultTitle}>Opposition enregistrée</Text>
          <Text style={styles.resultSub}>La photo a été supprimée du book du Coiffeuse. Il a été notifié.</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('ClientTabs')}>
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
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Photo de ta coupe</Text>
        <Text style={styles.pageSub}>{barber_name || 'Ton Coiffeuse'} a partagé une photo</Text>

        {photo_url ? (
          <Image source={{ uri: photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>📷</Text>
          </View>
        )}

        <BlurView intensity={60} tint="light" style={styles.statusCard}>
          <Text style={styles.statusIcon}>{is_public ? '🌍' : '🔒'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {is_public ? 'Photo publique' : 'Photo privée'}
            </Text>
            <Text style={styles.statusSub}>
              {is_public
                ? "Visible dans le feed et le book public du Coiffeuse"
                : "Visible uniquement dans le book privé du Coiffeuse"}
            </Text>
          </View>
        </BlurView>

        <Text style={styles.sectionLabel}>Que veux-tu faire ?</Text>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSave, loading && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color="#0F6E56" size="small" />
          ) : (
            <>
              <Text style={styles.actionBtnIcon}>🔖</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnTitle}>Enregistrer dans mon book</Text>
                <Text style={styles.actionBtnSub}>Ajouter à tes inspirations</Text>
              </View>
              <Text style={styles.actionBtnArrow}>→</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnOppose, loading && { opacity: 0.6 }]}
          onPress={handleOppose}
          disabled={loading}
          activeOpacity={0.85}>
          <Text style={styles.actionBtnIcon}>🚫</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionBtnTitle, { color: '#C0392B' }]}>
              {"S'opposer à l'utilisation"}
            </Text>
            <Text style={styles.actionBtnSub}>Supprimer la photo du book du Coiffeuse</Text>
          </View>
          <Text style={[styles.actionBtnArrow, { color: '#C0392B' }]}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.navigate('ClientTabs')}>
          <Text style={styles.skipBtnText}>Pas maintenant</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F5F5F7' },
  blob1: { position: 'absolute', top: -40, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },
  blob2: { position: 'absolute', bottom: 60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(168,133,42,0.1)' },

  back: { padding: 16, paddingBottom: 4 },
  backText: { fontSize: 14, color: '#0071E3' },

  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'rgba(28,28,30,0.5)', paddingHorizontal: 16, marginBottom: 16 },

  photo: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#1C1C1E', marginBottom: 12 },
  photoPlaceholder: { marginHorizontal: 16, height: 200, borderRadius: 16, backgroundColor: 'rgba(28,28,30,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  photoPlaceholderText: { fontSize: 40 },

  statusCard: { marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 20 },
  statusIcon: { fontSize: 22 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  statusSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 2, lineHeight: 15 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 10 },

  actionBtn: { marginHorizontal: 16, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, borderWidth: 0.5 },
  actionBtnSave: { backgroundColor: 'rgba(124,61,143,0.07)', borderColor: 'rgba(124,61,143,0.25)' },
  actionBtnOppose: { backgroundColor: 'rgba(192,57,43,0.06)', borderColor: 'rgba(192,57,43,0.2)' },
  actionBtnIcon: { fontSize: 22 },
  actionBtnTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 2 },
  actionBtnSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)' },
  actionBtnArrow: { fontSize: 16, color: '#0F6E56', fontWeight: '700' },

  skipBtn: { marginHorizontal: 16, borderRadius: 12, padding: 11, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', backgroundColor: 'rgba(28,28,30,0.03)', marginTop: 4 },
  skipBtnText: { fontSize: 12, color: 'rgba(28,28,30,0.45)' },

  resultContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  resultEmoji: { fontSize: 56 },
  resultTitle: { fontSize: 24, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  resultSub: { fontSize: 14, color: 'rgba(28,28,30,0.55)', textAlign: 'center', lineHeight: 20 },
  homeBtn: { marginTop: 8, width: '100%', backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 14, padding: 14, alignItems: 'center' },
  homeBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

