import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Alert, Image, TextInput,
  Dimensions, RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { colors, SPECIALITES } from './colors';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 56) / 3;

const TABS_BOOK = ['Photos', 'Prestations'];

// Cache module-level : survit aux remontages dus au Stack Navigator
const _bookCache = { photos: [], prestations: [], coiffeuseId: null };

export default function CoiffeuseBookScreen({ navigation }) {
  const [coiffeuse, setCoiffeuse] = useState(null);
  const [photos, setPhotos] = useState(_bookCache.photos);
  const [prestations, setPrestations] = useState(_bookCache.prestations);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Formulaire nouvelle prestation
  const [showPrestForm, setShowPrestForm] = useState(false);
  const [prestForm, setPrestForm] = useState({ nom: '', categorie: 'tresses', emoji: '💆', prix_min: '', prix_max: '', duree_min: '', description: '' });

  useFocusEffect(useCallback(() => { loadData(); }, []));

  async function loadData() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { data: coiffData } = await supabase
        .from('coiffeuses').select('id, name').eq('user_id', user.id).maybeSingle();
      if (!coiffData) return;
      setCoiffeuse(coiffData);

      const { data: photosArr } = await supabase
        .from('book_photos')
        .select('id, photo_url, caption, categorie, likes, created_at')
        .eq('coiffeuse_id', coiffData.id)
        .order('created_at', { ascending: false });

      const { data: prestArr } = await supabase
        .from('prestations')
        .select('id, nom, categorie, emoji, prix_min, prix_max, duree_min, description')
        .eq('coiffeuse_id', coiffData.id)
        .order('categorie');

      if (photosArr !== null) {
        _bookCache.photos = photosArr;
        _bookCache.coiffeuseId = coiffData.id;
        setPhotos(photosArr);
      }
      if (prestArr !== null) {
        _bookCache.prestations = prestArr;
        setPrestations(prestArr);
      }
    } catch (e) {
      console.error('[loadData] catch:', e.message);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  async function addPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorise l'accès à ta galerie dans les réglages de l'appli.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.length || !coiffeuse) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const fileName = `book_${coiffeuse.id}_${Date.now()}.${ext}`;
      const raw = atob(asset.base64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }

      const { error: uploadErr } = await supabase.storage
        .from('book-photos')
        .upload(fileName, bytes, { contentType: mimeType, upsert: true });
      if (uploadErr) throw new Error('Upload storage: ' + uploadErr.message);

      const { data: { publicUrl } } = supabase.storage.from('book-photos').getPublicUrl(fileName);

      const { error: insertErr } = await supabase.from('book_photos').insert({
        coiffeuse_id: coiffeuse.id,
        photo_url: publicUrl,
      });
      if (insertErr) throw new Error('Insert book_photos: ' + insertErr.message);

      loadData();
    } catch (e) {
      console.error('[addPhoto] catch:', e.message);
      Alert.alert('Erreur upload', e.message || "Impossible d'ajouter la photo.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoId) {
    Alert.alert('Supprimer cette photo ?', 'Cette action est irréversible.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('book_photos').delete().eq('id', photoId);
          loadData();
        },
      },
    ]);
  }

  async function savePrest() {
    if (!prestForm.nom.trim()) {
      Alert.alert('Erreur', 'Le nom de la prestation est requis.');
      return;
    }
    try {
      await supabase.from('prestations').insert({
        coiffeuse_id: coiffeuse.id,
        nom: prestForm.nom.trim(),
        categorie: prestForm.categorie,
        emoji: prestForm.emoji,
        prix_min: parseInt(prestForm.prix_min) || 0,
        prix_max: parseInt(prestForm.prix_max) || parseInt(prestForm.prix_min) || 0,
        duree_min: parseInt(prestForm.duree_min) || 0,
        description: prestForm.description.trim() || null,
      });
      setShowPrestForm(false);
      setPrestForm({ nom: '', categorie: 'tresses', emoji: '💆', prix_min: '', prix_max: '', duree_min: '', description: '' });
      loadData();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
  }

  async function deletePrest(prestId) {
    Alert.alert('Supprimer cette prestation ?', '', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('prestations').delete().eq('id', prestId);
          loadData();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <Text style={styles.title}>Mon Book</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={activeTab === 0 ? addPhoto : () => setShowPrestForm(true)}>
          <Text style={styles.addBtnText}>
            {uploading ? '⏳' : activeTab === 0 ? '+ Photo' : '+ Prestation'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ONGLETS */}
      <View style={styles.tabsRow}>
        {TABS_BOOK.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => setActiveTab(i)}>
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* ONGLET PHOTOS */}
        {activeTab === 0 && (
          <View style={styles.photoSection}>
            {photos.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>📸</Text>
                <Text style={styles.emptyTitle}>Ton book est vide</Text>
                <Text style={styles.emptySub}>Ajoute des photos de tes réalisations pour attirer des clientes</Text>
                <TouchableOpacity style={styles.addFirstBtn} onPress={addPhoto}>
                  <Text style={styles.addFirstBtnText}>Ajouter une photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.grid}>
                {photos.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.photoCell}
                    onLongPress={() => deletePhoto(p.id)}
                    activeOpacity={0.85}>
                    {p.photo_url ? (
                      <Image source={{ uri: p.photo_url }} style={styles.photoImg} />
                    ) : (
                      <View style={[styles.photoImg, styles.photoPlaceholder]}>
                        <Text style={{ fontSize: 24 }}>💆</Text>
                      </View>
                    )}
                    {p.likes > 0 && (
                      <BlurView intensity={40} tint="dark" style={styles.photoLikes}>
                        <Text style={styles.photoLikesText}>♥ {p.likes}</Text>
                      </BlurView>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ONGLET PRESTATIONS */}
        {activeTab === 1 && (
          <View style={styles.prestSection}>
            {/* FORMULAIRE NOUVELLE PRESTATION */}
            {showPrestForm && (
              <BlurView intensity={55} tint="light" style={styles.prestForm}>
                <Text style={styles.prestFormTitle}>Nouvelle prestation</Text>

                <Text style={styles.formLabel}>Nom *</Text>
                <TextInput
                  style={styles.formInput}
                  value={prestForm.nom}
                  onChangeText={v => setPrestForm(f => ({ ...f, nom: v }))}
                  placeholder="Ex : Box braids"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.formLabel}>Catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                  {SPECIALITES.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.catChip, prestForm.categorie === s.id && styles.catChipActive]}
                      onPress={() => setPrestForm(f => ({ ...f, categorie: s.id, emoji: s.emoji }))}>
                      <Text style={styles.catChipText}>{s.emoji} {s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.priceRow}>
                  <View style={styles.halfInput}>
                    <Text style={styles.formLabel}>Prix min (€)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={prestForm.prix_min}
                      onChangeText={v => setPrestForm(f => ({ ...f, prix_min: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.formLabel}>Prix max (€)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={prestForm.prix_max}
                      onChangeText={v => setPrestForm(f => ({ ...f, prix_max: v }))}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.formLabel}>Durée (minutes)</Text>
                <TextInput
                  style={styles.formInput}
                  value={prestForm.duree_min}
                  onChangeText={v => setPrestForm(f => ({ ...f, duree_min: v }))}
                  placeholder="Ex : 120 (pour 2h)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formInputMulti]}
                  value={prestForm.description}
                  onChangeText={v => setPrestForm(f => ({ ...f, description: v }))}
                  placeholder="Décris la prestation..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.formCancel} onPress={() => setShowPrestForm(false)}>
                    <Text style={styles.formCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.formSave} onPress={savePrest}>
                    <Text style={styles.formSaveText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            )}

            {prestations.length === 0 && !showPrestForm ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>💈</Text>
                <Text style={styles.emptyTitle}>Aucune prestation</Text>
                <Text style={styles.emptySub}>Ajoute tes services pour que les clientes puissent réserver</Text>
                <TouchableOpacity style={styles.addFirstBtn} onPress={() => setShowPrestForm(true)}>
                  <Text style={styles.addFirstBtnText}>Ajouter une prestation</Text>
                </TouchableOpacity>
              </View>
            ) : (
              prestations.map(p => (
                <BlurView key={p.id} intensity={50} tint="light" style={styles.prestCard}>
                  <View style={styles.prestIcon}>
                    <Text style={styles.prestEmoji}>{p.emoji || '💆'}</Text>
                  </View>
                  <View style={styles.prestInfo}>
                    <Text style={styles.prestNom}>{p.nom}</Text>
                    {p.description && <Text style={styles.prestDesc} numberOfLines={1}>{p.description}</Text>}
                    <View style={styles.prestMeta}>
                      {p.duree_min > 0 && (
                        <Text style={styles.prestMetaText}>⏱ {p.duree_min}min</Text>
                      )}
                      {p.prix_min > 0 && (
                        <Text style={styles.prestPrix}>
                          {p.prix_min === p.prix_max ? `${p.prix_min}€` : `${p.prix_min}–${p.prix_max}€`}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => deletePrest(p.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </BlurView>
              ))
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <CoiffeuseTabBar active="CoiffeuseBook" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.dark },
  addBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 9 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  tabsRow: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 14, padding: 3, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.dark },

  photoSection: { paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  photoCell: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  photoLikes: { position: 'absolute', bottom: 4, right: 4, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 3 },
  photoLikesText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  prestSection: { paddingHorizontal: 20 },
  prestForm: { borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight, padding: 20, marginBottom: 16 },
  prestFormTitle: { fontSize: 17, fontWeight: '800', color: colors.dark, marginBottom: 14 },
  formLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7, marginTop: 10 },
  formInput: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 12, padding: 12, fontSize: 14, color: colors.dark, borderWidth: 0.5, borderColor: colors.border },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  catRow: { gap: 8, paddingBottom: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  catChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  catChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  priceRow: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  formCancel: { flex: 1, backgroundColor: 'rgba(28,28,30,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' },
  formCancelText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  formSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 12, alignItems: 'center' },
  formSaveText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  prestCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderLight, padding: 14, marginBottom: 10, gap: 12 },
  prestIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  prestEmoji: { fontSize: 20 },
  prestInfo: { flex: 1, gap: 3 },
  prestNom: { fontSize: 14, fontWeight: '700', color: colors.dark },
  prestDesc: { fontSize: 12, color: colors.textMuted },
  prestMeta: { flexDirection: 'row', gap: 10 },
  prestMetaText: { fontSize: 11, color: colors.textMuted },
  prestPrix: { fontSize: 13, fontWeight: '700', color: colors.primary },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },

  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  emptySub: { fontSize: 13, color: 'rgba(28,28,30,0.35)', textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  addFirstBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  addFirstBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

