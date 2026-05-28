import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Alert, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

const CAPIL_TYPES = ['3C', '4A', '4B', '4C'];
const FACE_SHAPES = ['Ovale', 'Rond', 'Carré', 'Rectangle'];
const PREFS = ['Fade', 'Design', 'Barbe', 'Locs', 'Twists', 'Afro'];

export default function AccountSettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  const [capilType, setCapilType] = useState('4A');
  const [faceShape, setFaceShape] = useState('Ovale');
  const [prefs, setPrefs] = useState([]);
  const [rappelOn, setRappelOn] = useState(true);
  const [hideFreshScore, setHideFreshScore] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigation.goBack(); return; }
      setEmail(session.user.email || '');

      const { data: client } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (client) {
        setClientData(client);
        setName(client.name || '');
        if (client.hair_type) setCapilType(client.hair_type);
        if (client.face_shape) setFaceShape(client.face_shape);
        if (client.preferences) setPrefs(client.preferences);
        if (client.reminder_on !== null) setRappelOn(client.reminder_on);
        setHideFreshScore(client.hide_fresh_score || false);
      }
    } catch (e) {
      console.log('Erreur AccountSettings:', e.message);
    } finally {
      setLoading(false);
    }
  }

  function togglePref(p) {
    setPrefs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function saveAll() {
    if (!clientData) return;
    setSaving(true);
    await supabase.from('clientes').update({
      name: name.trim() || clientData.name,
      hair_type: capilType,
      face_shape: faceShape,
      preferences: prefs,
      reminder_on: rappelOn,
      hide_fresh_score: hideFreshScore,
    }).eq('id', clientData.id);
    setSaving(false);
    navigation.goBack();
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes tes données seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            if (clientData) {
              await supabase.from('coupes').delete().eq('client_id', clientData.id);
              await supabase.from('clientes').delete().eq('id', clientData.id);
            }
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wallpaper} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

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
        <Text style={styles.headerTitle}>Réglages du compte</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Mon compte */}
        <Text style={styles.secTitle}>👤 Mon compte</Text>
        <BlurView intensity={60} tint="light" style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoL}>Email</Text>
            <Text style={styles.infoV} numberOfLines={1}>{email}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoL}>Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ton prénom"
              placeholderTextColor="rgba(28,28,30,0.3)"
              style={styles.nameInput}
              autoCorrect={false}
            />
          </View>
        </BlurView>

        {/* Profil capillaire */}
        <Text style={styles.secTitle}>💇 Profil capillaire</Text>
        <BlurView intensity={60} tint="light" style={styles.card}>
          <Text style={styles.capilLabel}>Type de cheveux</Text>
          <View style={styles.chipRow}>
            {CAPIL_TYPES.map(t => (
              <TouchableOpacity key={t}
                style={[styles.chip, capilType === t && styles.chipActive]}
                onPress={() => setCapilType(t)}>
                <Text style={[styles.chipText, capilType === t && styles.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.capilLabel, { marginTop: 14 }]}>Morphologie du visage</Text>
          <View style={styles.chipRow}>
            {FACE_SHAPES.map(s => (
              <TouchableOpacity key={s}
                style={[styles.chip, faceShape === s && styles.chipActive]}
                onPress={() => setFaceShape(s)}>
                <Text style={[styles.chipText, faceShape === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.capilLabel, { marginTop: 14 }]}>Préférences de coupe</Text>
          <View style={styles.chipRow}>
            {PREFS.map(p => (
              <TouchableOpacity key={p}
                style={[styles.chip, prefs.includes(p) && styles.chipGold]}
                onPress={() => togglePref(p)}>
                <Text style={[styles.chipText, prefs.includes(p) && styles.chipTextGold]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>

        {/* Notifications */}
        <Text style={styles.secTitle}>🔔 Notifications</Text>
        <BlurView intensity={60} tint="light" style={styles.card}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>Rappel automatique</Text>
              <Text style={styles.settingDesc}>Reçois un rappel tous les 21 jours pour ta coupe</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, rappelOn && styles.toggleOn]}
              onPress={() => setRappelOn(!rappelOn)}>
              <View style={[styles.toggleThumb, rappelOn && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>File d'attente</Text>
              <Text style={styles.settingDesc}>Notifié quand c'est bientôt ton tour</Text>
            </View>
            <TouchableOpacity style={[styles.toggle, styles.toggleOn]}>
              <View style={[styles.toggleThumb, styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Confidentialité — FreshScore masqué V1, réactiver en V2 */}

        {/* Zone danger */}
        <Text style={[styles.secTitle, { color: '#C0392B' }]}>⚠ Zone dangereuse</Text>
        <BlurView intensity={60} tint="light" style={[styles.card, { borderColor: 'rgba(192,57,43,0.22)' }]}>
          <TouchableOpacity style={styles.deleteRow} onPress={confirmDeleteAccount}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deleteTitle}>Supprimer mon compte</Text>
              <Text style={styles.deleteDesc}>Supprime définitivement ton compte et toutes tes données</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#C0392B' }}>→</Text>
          </TouchableOpacity>
        </BlurView>

      </ScrollView>

      </KeyboardAvoidingView>
      <BlurView intensity={70} tint="light" style={styles.saveBar}>
        <TouchableOpacity style={styles.saveBtn} onPress={saveAll} disabled={saving}>
          <Text style={styles.saveBtnText}>
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Text>
        </TouchableOpacity>
      </BlurView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.15)' },
  blob2: { position: 'absolute', bottom: 200, left: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(60,160,255,0.12)' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E' },

  secTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 2 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  infoL: { fontSize: 13, color: 'rgba(28,28,30,0.45)' },
  infoV: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', maxWidth: '65%', textAlign: 'right' },

  capilLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 9 },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  chipActive: { backgroundColor: 'rgba(28,28,30,0.88)', borderColor: 'rgba(28,28,30,0.88)' },
  chipGold: { backgroundColor: 'rgba(168,133,42,0.15)', borderColor: 'rgba(168,133,42,0.35)' },
  chipText: { fontSize: 13, fontWeight: '500', color: 'rgba(28,28,30,0.55)' },
  chipTextActive: { color: '#fff' },
  chipTextGold: { color: '#A8852A', fontWeight: '600' },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  settingDesc: { fontSize: 11, color: 'rgba(28,28,30,0.45)', marginTop: 2, lineHeight: 16 },

  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.15)', position: 'relative', flexShrink: 0 },
  toggleOn: { backgroundColor: '#7C3D8F' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, left: 2 },
  toggleThumbOn: { left: 22 },

  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteTitle: { fontSize: 14, fontWeight: '700', color: '#C0392B' },
  deleteDesc: { fontSize: 11, color: 'rgba(192,57,43,0.55)', marginTop: 2, lineHeight: 16 },

  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 34, overflow: 'hidden', borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.5)' },
  saveBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  nameInput: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', textAlign: 'right', flex: 1, paddingVertical: 0 },
});

