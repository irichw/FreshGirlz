import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';
import { useFocusEffect } from '@react-navigation/native';

// ── Helpers affichage ──────────────────────────────────────────────────────
function fmtDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function fmtPrice(svc) {
  const min = svc.price_min ?? svc.price;
  const max = svc.price_max;
  const type = svc.price_type || 'fixed';
  if (min === null || min === undefined || min === '') return 'Sur devis';
  if (type === 'range' && max) return `${Number(min).toFixed(0)} – ${Number(max).toFixed(0)} €`;
  if (type === 'from') return `À partir de ${Number(min).toFixed(0)} €`;
  if (Number(min) === 0) return 'Gratuit';
  return `${Number(min).toFixed(0)} €`;
}

const PRICE_TYPES = [
  { key: 'fixed', label: 'Prix fixe' },
  { key: 'range', label: 'Fourchette' },
  { key: 'from',  label: 'À partir de' },
];

export default function ServicesManagementScreen({ navigation, route }) {
  const { salonId } = route.params;

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCatModal, setShowCatModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingCat, setEditingCat] = useState(null);

  // Catégorie
  const [catName, setCatName] = useState('');

  // Prestation
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [durationH, setDurationH] = useState('0');
  const [durationM, setDurationM] = useState('30');
  const [priceType, setPriceType] = useState('fixed');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState(null);

  useFocusEffect(
    useCallback(() => { loadAll(); }, [])
  );

  async function loadAll() {
    const [catsRes, servicesRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('salon_id', salonId).order('position'),
      supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name'),
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    setLoading(false);
  }

  // ── CATÉGORIES ─────────────────────────────────────────────────────────────
  async function saveCat() {
    if (!catName) { alert('Nom requis'); return; }
    if (editingCat) {
      await supabase.from('service_categories').update({ name: catName }).eq('id', editingCat.id);
    } else {
      await supabase.from('service_categories').insert({ salon_id: salonId, name: catName, position: categories.length });
    }
    setCatName(''); setEditingCat(null); setShowCatModal(false); loadAll();
  }

  async function deleteCat(id) {
    const hasServices = services.some(s => s.category_id === id);
    if (hasServices) { alert('Cette catégorie contient des prestations. Déplacez-les d\'abord.'); return; }
    if (Platform.OS === 'web') {
      if (!window.confirm('Supprimer cette catégorie ?')) return;
      await supabase.from('service_categories').delete().eq('id', id);
    } else {
      Alert.alert('Supprimer', 'Supprimer cette catégorie ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => { await supabase.from('service_categories').delete().eq('id', id); loadAll(); } },
      ]); return;
    }
    loadAll();
  }

  function openEditCat(cat) { setEditingCat(cat); setCatName(cat.name); setShowCatModal(true); }
  function openAddCat() { setEditingCat(null); setCatName(''); setShowCatModal(true); }

  // ── SERVICES ───────────────────────────────────────────────────────────────
  function openAddService(categoryId = null) {
    setEditingService(null);
    setServiceName(''); setServiceDesc('');
    setDurationH('0'); setDurationM('30');
    setPriceType('fixed'); setPriceMin(''); setPriceMax('');
    setServiceCategoryId(categoryId);
    setShowServiceModal(true);
  }

  function openEditService(s) {
    setEditingService(s);
    setServiceName(s.name);
    setServiceDesc(s.description || '');
    const totalMin = s.duration_minutes || 30;
    setDurationH(String(Math.floor(totalMin / 60)));
    setDurationM(String(totalMin % 60));
    setPriceType(s.price_type || 'fixed');
    const min = s.price_min ?? s.price;
    setPriceMin(min !== null && min !== undefined ? String(min) : '');
    setPriceMax(s.price_max !== null && s.price_max !== undefined ? String(s.price_max) : '');
    setServiceCategoryId(s.category_id);
    setShowServiceModal(true);
  }

  async function saveService() {
    if (!serviceName) { alert('Le nom est requis'); return; }
    const totalMinutes = (parseInt(durationH) || 0) * 60 + (parseInt(durationM) || 0);
    if (totalMinutes <= 0) { alert('La durée doit être supérieure à 0'); return; }
    if (!priceMin && priceType !== 'fixed') { alert('Renseigne au moins un prix'); return; }

    const parsedMin = priceMin !== '' ? parseFloat(priceMin) : null;
    const parsedMax = priceType === 'range' && priceMax !== '' ? parseFloat(priceMax) : null;

    const payload = {
      salon_id: salonId,
      name: serviceName,
      description: serviceDesc,
      duration_minutes: totalMinutes,
      price_type: priceType,
      price_min: parsedMin,
      price_max: parsedMax,
      price: parsedMin ?? 0,
      category_id: serviceCategoryId,
      is_active: true,
    };

    if (editingService) {
      await supabase.from('services').update(payload).eq('id', editingService.id);
    } else {
      await supabase.from('services').insert(payload);
    }
    setShowServiceModal(false); loadAll();
  }

  async function deleteService(id) {
    if (Platform.OS === 'web') {
      if (!window.confirm('Supprimer cette prestation ?')) return;
      await supabase.from('services').update({ is_active: false }).eq('id', id);
    } else {
      Alert.alert('Supprimer', 'Supprimer cette prestation ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => { await supabase.from('services').update({ is_active: false }).eq('id', id); loadAll(); } },
      ]); return;
    }
    loadAll();
  }

  const uncategorized = services.filter(s => !s.category_id);
  const totalServices = services.length;

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: 'rgba(28,28,30,0.4)' }}>Chargement...</Text>
      </View>
    </SafeAreaView>
  );

  function renderServiceRow(s, isLast) {
    return (
      <View key={s.id} style={[styles.serviceRow, isLast && { borderBottomWidth: 0 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceName}>{s.name}</Text>
          <Text style={styles.serviceMeta}>{fmtDuration(s.duration_minutes)} · {fmtPrice(s)}</Text>
          {s.description ? <Text style={styles.serviceDesc}>{s.description}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => openEditService(s)} style={styles.iconBtn}>
          <Text>✎</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteService(s.id)} style={styles.iconBtn}>
          <Text style={{ color: '#C0392B' }}>🗑</Text>
        </TouchableOpacity>
      </View>
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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Prestations</Text>
          <Text style={styles.headerSub}>{totalServices} prestation{totalServices > 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addCatBtn} onPress={openAddCat}>
          <Text style={styles.addCatBtnText}>+ Catégorie</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}>

        {categories.map((cat) => {
          const catServices = services.filter(s => s.category_id === cat.id);
          return (
            <BlurView key={cat.id} intensity={55} tint="light" style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catCount}>{catServices.length} prestation{catServices.length > 1 ? 's' : ''}</Text>
                <TouchableOpacity onPress={() => openEditCat(cat)} style={styles.iconBtn}>
                  <Text style={{ fontSize: 14 }}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCat(cat.id)} style={styles.iconBtn}>
                  <Text style={{ fontSize: 14, color: '#C0392B' }}>🗑</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sectionBody}>
                {catServices.length === 0
                  ? <Text style={styles.emptyText}>Aucune prestation dans cette catégorie</Text>
                  : catServices.map((s, i) => renderServiceRow(s, i === catServices.length - 1))}
                <TouchableOpacity style={styles.addServiceBtn} onPress={() => openAddService(cat.id)}>
                  <Text style={styles.addServiceBtnText}>+ Ajouter une prestation</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          );
        })}

        <BlurView intensity={55} tint="light" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.catName}>Sans catégorie</Text>
            <Text style={styles.catCount}>{uncategorized.length} prestation{uncategorized.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.sectionBody}>
            {uncategorized.length === 0
              ? <Text style={styles.emptyText}>Aucune prestation sans catégorie</Text>
              : uncategorized.map((s, i) => renderServiceRow(s, i === uncategorized.length - 1))}
            <TouchableOpacity style={styles.addServiceBtn} onPress={() => openAddService(null)}>
              <Text style={styles.addServiceBtnText}>+ Ajouter une prestation</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

      </ScrollView>

      {/* ── MODAL CATÉGORIE ── */}
      <Modal visible={showCatModal} transparent animationType="slide" onRequestClose={() => setShowCatModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</Text>
              <TouchableOpacity onPress={() => setShowCatModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 16 }}>
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput
                style={styles.input} value={catName} onChangeText={setCatName}
                placeholder="Ex: Tresses" placeholderTextColor="rgba(28,28,30,0.3)" autoFocus
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveCat}>
                <Text style={styles.saveBtnText}>{editingCat ? 'Enregistrer' : 'Ajouter'}</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL SERVICE ── */}
      <Modal visible={showServiceModal} transparent animationType="slide" onRequestClose={() => setShowServiceModal(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <BlurView intensity={80} tint="light" style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingService ? 'Modifier la prestation' : 'Nouvelle prestation'}</Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">

              {/* Nom */}
              <Text style={styles.fieldLabel}>Nom *</Text>
              <TextInput
                style={[styles.input, { marginBottom: 14 }]}
                value={serviceName} onChangeText={setServiceName}
                placeholder="Ex: Knotless Braids" placeholderTextColor="rgba(28,28,30,0.3)"
              />

              {/* Description */}
              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={[styles.input, { height: 72, textAlignVertical: 'top', marginBottom: 14 }]}
                value={serviceDesc} onChangeText={setServiceDesc}
                placeholder="Ex: Box braids avec extensions..." placeholderTextColor="rgba(28,28,30,0.3)"
                multiline
              />

              {/* Durée : heures + minutes */}
              <Text style={styles.fieldLabel}>Durée *</Text>
              <View style={styles.durationRow}>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.durationInput}
                    value={durationH} onChangeText={setDurationH}
                    keyboardType="numeric" maxLength={2}
                    placeholder="0" placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  <Text style={styles.durationUnit}>h</Text>
                </View>
                <Text style={styles.durationSep}>:</Text>
                <View style={styles.durationField}>
                  <TextInput
                    style={styles.durationInput}
                    value={durationM} onChangeText={setDurationM}
                    keyboardType="numeric" maxLength={2}
                    placeholder="30" placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  <Text style={styles.durationUnit}>min</Text>
                </View>
                {/* Aperçu */}
                <View style={styles.durationPreview}>
                  <Text style={styles.durationPreviewText}>
                    {fmtDuration((parseInt(durationH) || 0) * 60 + (parseInt(durationM) || 0))}
                  </Text>
                </View>
              </View>

              {/* Type de prix */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Type de prix *</Text>
              <View style={styles.priceTypeRow}>
                {PRICE_TYPES.map(pt => (
                  <TouchableOpacity
                    key={pt.key}
                    style={[styles.priceTypeBtn, priceType === pt.key && styles.priceTypeBtnActive]}
                    onPress={() => setPriceType(pt.key)}>
                    <Text style={[styles.priceTypeTxt, priceType === pt.key && styles.priceTypeTxtActive]}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Champs prix selon type */}
              {priceType === 'fixed' && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Prix (€)</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 4 }]}
                    value={priceMin} onChangeText={setPriceMin}
                    keyboardType="numeric" placeholder="Ex: 80"
                    placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  <Text style={styles.fieldHint}>Laisser vide = Sur devis</Text>
                </>
              )}

              {priceType === 'from' && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>À partir de (€) *</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 4 }]}
                    value={priceMin} onChangeText={setPriceMin}
                    keyboardType="numeric" placeholder="Ex: 60"
                    placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  <Text style={styles.fieldHint}>Affiché : "À partir de 60 €"</Text>
                </>
              )}

              {priceType === 'range' && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Prix minimum (€) *</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 10 }]}
                    value={priceMin} onChangeText={setPriceMin}
                    keyboardType="numeric" placeholder="Ex: 60"
                    placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  <Text style={styles.fieldLabel}>Prix maximum (€) *</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 4 }]}
                    value={priceMax} onChangeText={setPriceMax}
                    keyboardType="numeric" placeholder="Ex: 120"
                    placeholderTextColor="rgba(28,28,30,0.3)"
                  />
                  {priceMin && priceMax
                    ? <Text style={styles.fieldHint}>Affiché : "{priceMin} – {priceMax} €"</Text>
                    : <Text style={styles.fieldHint}>Affiché : "X – Y €"</Text>}
                </>
              )}

              {/* Catégorie */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Catégorie</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                <TouchableOpacity
                  style={[styles.catPill, !serviceCategoryId && styles.catPillActive]}
                  onPress={() => setServiceCategoryId(null)}>
                  <Text style={[styles.catPillText, !serviceCategoryId && styles.catPillTextActive]}>Sans catégorie</Text>
                </TouchableOpacity>
                {categories.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[styles.catPill, serviceCategoryId === c.id && styles.catPillActive]}
                    onPress={() => setServiceCategoryId(c.id)}>
                    <Text style={[styles.catPillText, serviceCategoryId === c.id && styles.catPillTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.saveBtn} onPress={saveService}>
                <Text style={styles.saveBtnText}>{editingService ? 'Enregistrer les modifications' : 'Ajouter la prestation'}</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
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
  addCatBtn: { backgroundColor: 'rgba(0,113,227,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)' },
  addCatBtnText: { fontSize: 11, color: '#0071E3', fontWeight: '600' },

  section: { borderRadius: 18, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  sectionBody: { padding: 14 },
  catName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#1C1C1E' },
  catCount: { fontSize: 11, color: 'rgba(28,28,30,0.4)' },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.05)', alignItems: 'center', justifyContent: 'center' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)', gap: 8 },
  serviceName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  serviceMeta: { fontSize: 11, color: '#7C3D8F', marginTop: 2 },
  serviceDesc: { fontSize: 11, color: 'rgba(28,28,30,0.45)', marginTop: 2 },
  emptyText: { fontSize: 12, color: 'rgba(28,28,30,0.4)', textAlign: 'center', paddingVertical: 8 },
  addServiceBtn: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,113,227,0.07)', borderWidth: 0.5, borderColor: 'rgba(0,113,227,0.2)', alignItems: 'center' },
  addServiceBtnText: { fontSize: 12, color: '#0071E3', fontWeight: '600' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,28,30,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.08)' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
  modalClose: { fontSize: 14, color: 'rgba(28,28,30,0.4)', padding: 4 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  fieldHint: { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginBottom: 4, fontStyle: 'italic' },
  input: { backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 12, padding: 12, fontSize: 14, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },

  // Durée
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  durationField: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)', paddingHorizontal: 12, paddingVertical: 10, gap: 4, flex: 1 },
  durationInput: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', minWidth: 32, textAlign: 'center' },
  durationUnit: { fontSize: 13, color: 'rgba(28,28,30,0.45)', fontWeight: '600' },
  durationSep: { fontSize: 22, color: 'rgba(28,28,30,0.3)', fontWeight: '300' },
  durationPreview: { backgroundColor: 'rgba(124,61,143,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.25)' },
  durationPreviewText: { fontSize: 13, fontWeight: '700', color: '#7C3D8F' },

  // Type de prix
  priceTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  priceTypeBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)', alignItems: 'center' },
  priceTypeBtnActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  priceTypeTxt: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.55)' },
  priceTypeTxtActive: { color: '#fff' },

  // Catégorie pills
  catPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.06)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.12)' },
  catPillActive: { backgroundColor: 'rgba(28,28,30,0.88)' },
  catPillText: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  catPillTextActive: { color: '#fff' },

  saveBtn: { backgroundColor: '#7C3D8F', borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
