import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Switch, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView, Image, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';

export default function ShopManagementScreen({ navigation, route }) {
  const { salonId } = route.params;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from('shop_products')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditingProduct(null);
    setName(''); setDescription(''); setPrice(''); setImageUrl(''); setIsAvailable(true);
    setShowModal(true);
  }

  function openEdit(p) {
    setEditingProduct(p);
    setName(p.name); setDescription(p.description || '');
    setPrice(String(p.price)); setImageUrl(p.image_url || ''); setIsAvailable(p.is_available);
    setShowModal(true);
  }

  function pickPhoto() {
    Alert.alert('Ajouter une photo', '', [
      { text: 'Bibliothèque photos', onPress: () => pickAndUpload('library') },
      { text: 'Appareil photo', onPress: () => pickAndUpload('camera') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }

  async function pickAndUpload(source) {
    let result;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Autorise l'accès à l'appareil photo dans les réglages.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "Autorise l'accès à ta bibliothèque photo dans les réglages.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
      });
    }

    if (result.canceled) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('base64 manquant');
      const fileName = `shop/${salonId}/${Date.now()}.jpeg`;
      const byteArray = Uint8Array.from(atob(asset.base64), c => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage
        .from('Photos')
        .upload(fileName, byteArray, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(fileName);
      setImageUrl(publicUrl);
    } catch (e) {
      Alert.alert('Erreur upload', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct() {
    if (!name.trim() || !price) { Alert.alert('Champs requis', 'Le nom et le prix sont obligatoires.'); return; }
    const payload = {
      salon_id: salonId,
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price) || 0,
      image_url: imageUrl || null,
      is_available: isAvailable,
    };
    if (editingProduct) {
      await supabase.from('shop_products').update(payload).eq('id', editingProduct.id);
    } else {
      await supabase.from('shop_products').insert(payload);
    }
    setShowModal(false);
    loadProducts();
  }

  async function toggleAvailability(product) {
    await supabase.from('shop_products').update({ is_available: !product.is_available }).eq('id', product.id);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_available: !p.is_available } : p));
  }

  function confirmDelete(id) {
    if (Platform.OS === 'web') {
      if (!window.confirm('Supprimer ce produit ?')) return;
      deleteProduct(id);
    } else {
      Alert.alert('Supprimer', 'Supprimer ce produit de la boutique ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteProduct(id) },
      ]);
    }
  }

  async function deleteProduct(id) {
    await supabase.from('shop_products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Boutique</Text>
          <Text style={styles.headerSub}>{products.length} produit{products.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <ActivityIndicator color="#A8852A" />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🛍</Text>
            <Text style={styles.emptyTitle}>Aucun produit</Text>
            <Text style={styles.emptySubtitle}>Ajoutez vos premiers produits à la boutique.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>+ Ajouter un produit</Text>
            </TouchableOpacity>
          </View>
        ) : products.map((p) => (
          <BlurView key={p.id} intensity={55} tint="light" style={styles.productCard}>
            <View style={styles.productRow}>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.productImg} />
              ) : (
                <View style={styles.productImgPlaceholder}>
                  <Text style={{ fontSize: 22 }}>🛍</Text>
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.name}</Text>
                {!!p.description && (
                  <Text style={styles.productDesc} numberOfLines={2}>{p.description}</Text>
                )}
                <Text style={styles.productPrice}>{parseFloat(p.price).toFixed(2)} €</Text>
              </View>
              <View style={styles.productActions}>
                <Switch
                  value={p.is_available}
                  onValueChange={() => toggleAvailability(p)}
                  trackColor={{ false: 'rgba(28,28,30,0.15)', true: '#7C3D8F' }}
                  thumbColor="#fff"
                  style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                />
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
                  <Text style={styles.editBtnText}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(p.id)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
            {!p.is_available && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Indisponible</Text>
              </View>
            )}
          </BlurView>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* PHOTO */}
              <Text style={styles.fieldLabel}>Photo du produit</Text>
              <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#A8852A" />
                ) : imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text>
                    <Text style={styles.photoPlaceholderText}>Bibliothèque ou appareil photo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!imageUrl && (
                <TouchableOpacity onPress={() => setImageUrl('')} style={styles.removePhotoBtn}>
                  <Text style={styles.removePhotoText}>✕ Supprimer la photo</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 16 }} />
              <FormField label="Nom *" value={name} onChange={setName} placeholder="Ex: Pomade Mate" />
              <FormField label="Description" value={description} onChange={setDescription} multiline placeholder="Ex: Tenue forte, finition mate, 100ml" />
              <FormField label="Prix (€) *" value={price} onChange={setPrice} keyboard="decimal-pad" placeholder="Ex: 12.90" />

              <View style={styles.availRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Disponible à la commande</Text>
                  <Text style={styles.availSub}>Les clients pourront commander ce produit</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: 'rgba(28,28,30,0.15)', true: '#7C3D8F' }}
                  thumbColor="#fff"
                />
              </View>
              <TouchableOpacity style={[styles.saveBtn, uploading && { opacity: 0.5 }]} onPress={saveProduct} disabled={uploading}>
                <Text style={styles.saveBtnText}>{editingProduct ? 'Enregistrer' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function FormField({ label, value, onChange, placeholder, multiline, keyboard }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(28,28,30,0.3)"
        multiline={multiline}
        keyboardType={keyboard || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', bottom: 100, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(201,80,122,0.12)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  backBtnText: { fontSize: 18, color: '#1C1C1E' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  headerSub: { fontSize: 11, color: 'rgba(28,28,30,0.5)', marginTop: 1 },
  addBtn: { backgroundColor: 'rgba(0,113,227,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  addBtnText: { fontSize: 12, color: '#0071E3', fontWeight: '700' },
  productCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', padding: 12 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  productImg: { width: 64, height: 64, borderRadius: 12 },
  productImgPlaceholder: { width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.1)', alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  productDesc: { fontSize: 12, color: 'rgba(28,28,30,0.5)', marginTop: 3 },
  productPrice: { fontSize: 16, fontWeight: '800', color: '#A8852A', marginTop: 4 },
  productActions: { alignItems: 'center', gap: 6 },
  editBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(168,133,42,0.12)', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { fontSize: 13, color: '#A8852A' },
  deleteBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(192,57,43,0.1)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 13, color: '#C0392B' },
  unavailableBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(192,57,43,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  unavailableText: { fontSize: 10, fontWeight: '600', color: '#C0392B' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#1C1C1E', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: 'rgba(28,28,30,0.45)', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  photoPickerBtn: { width: '100%', height: 140, borderRadius: 16, backgroundColor: 'rgba(28,28,30,0.05)', borderWidth: 1, borderColor: 'rgba(28,28,30,0.12)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 140, borderRadius: 16 },
  photoPlaceholder: { alignItems: 'center' },
  photoPlaceholderText: { fontSize: 12, color: 'rgba(28,28,30,0.4)', fontWeight: '600' },
  removePhotoBtn: { alignSelf: 'center', marginTop: 8 },
  removePhotoText: { fontSize: 12, color: '#C0392B', fontWeight: '600' },
  availRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  availSub: { fontSize: 11, color: 'rgba(28,28,30,0.45)', marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
  modalClose: { fontSize: 14, color: 'rgba(28,28,30,0.4)', padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 12, padding: 12, fontSize: 14, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  saveBtn: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

