import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  TextInput, ScrollView, Alert, Keyboard, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const DAYS = [
  { day: 0, label: 'Lun' },
  { day: 1, label: 'Mar' },
  { day: 2, label: 'Mer' },
  { day: 3, label: 'Jeu' },
  { day: 4, label: 'Ven' },
  { day: 5, label: 'Sam' },
  { day: 6, label: 'Dim' },
];

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CreateSalonScreen({ onSalonCreated, onBack }) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Étape 1
  const [salonName, setSalonName] = useState('');
  const [salonAddress, setSalonAddress] = useState('');
  const [salonPostalCode, setSalonPostalCode] = useState('');
  const [salonCity, setSalonCity] = useState('');
  const [salonDesc, setSalonDesc] = useState('');
  const [salonPhone, setSalonPhone] = useState('');
  const [salonInstagram, setSalonInstagram] = useState('');

  // Étape 2
  const [photoUris, setPhotoUris] = useState([]);

  // Étape 3 — équipe
  const [teamMembers, setTeamMembers] = useState([]);
  const [newMemberName, setNewMemberName] = useState('');

  // Étape 4 — prestations
  const [servicesList, setServicesList] = useState([]);
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcPrice, setNewSvcPrice] = useState('');
  const [newSvcDuration, setNewSvcDuration] = useState('30');

  // Étape 5 — horaires
  const [hours, setHours] = useState(DAYS.map(d => ({
    ...d,
    open: '09:00',
    close: d.day >= 5 ? '18:00' : '19:00',
    closed: d.day === 6,
  })));

  // ─── Navigation ───────────────────────────────────────────────────────────

  function nextStep() {
    Keyboard.dismiss();
    if (step === 1 && !salonName.trim()) {
      Alert.alert('Requis', 'Le nom du salon est obligatoire.');
      return;
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function prevStep() {
    setStep(s => Math.max(s - 1, 1));
  }

  // ─── Photo ────────────────────────────────────────────────────────────────

  async function pickPhoto() {
    if (photoUris.length >= 5) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "L'accès à la galerie est requis.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUris(prev => [...prev, result.assets[0].uri]);
  }

  function removePhoto(idx) {
    setPhotoUris(prev => prev.filter((_, i) => i !== idx));
  }

  // ─── Équipe ───────────────────────────────────────────────────────────────

  function addTeamMember() {
    if (!newMemberName.trim()) return;
    setTeamMembers(prev => [...prev, { name: newMemberName.trim(), code: generateCode() }]);
    setNewMemberName('');
  }

  function removeTeamMember(idx) {
    setTeamMembers(prev => prev.filter((_, i) => i !== idx));
  }

  function regenerateCode(idx) {
    setTeamMembers(prev => prev.map((m, i) => i === idx ? { ...m, code: generateCode() } : m));
  }

  // ─── Prestations ──────────────────────────────────────────────────────────

  function addService() {
    if (!newSvcName.trim()) return;
    setServicesList(prev => [...prev, {
      name: newSvcName.trim(),
      price: newSvcPrice,
      duration: newSvcDuration,
    }]);
    setNewSvcName('');
    setNewSvcPrice('');
    setNewSvcDuration('30');
  }

  function removeService(idx) {
    setServicesList(prev => prev.filter((_, i) => i !== idx));
  }

  // ─── Horaires ─────────────────────────────────────────────────────────────

  function toggleDay(idx) {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, closed: !h.closed } : h));
  }

  function updateHour(idx, field, value) {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  }

  // ─── Création finale ──────────────────────────────────────────────────────

  async function handleCreate() {
    Keyboard.dismiss();
    setSubmitting(true);
    setCreateError(null);
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw new Error(`Auth: ${userErr.message}`);
      if (!user) throw new Error('Session expirée — reconnecte-toi');

      // 1. Créer le salon
      const salonPayload = {
        name: salonName.trim(),
        description: salonDesc.trim() || null,
        phone: salonPhone.trim() || null,
        instagram: salonInstagram.replace('@', '').trim() || null,
        address: salonAddress.trim() || null,
        postal_code: salonPostalCode.trim() || null,
        city: salonCity.trim() || null,
        is_open: false,
      };

      const { data: salon, error: salonErr } = await supabase
        .from('salons')
        .insert(salonPayload)
        .select()
        .single();
      if (salonErr) throw new Error(`Création salon : ${salonErr.message}`);

      // 2. Lier la coiffeuse au salon (AVANT les photos pour que les policies RLS passent)
      const barberName = user.user_metadata?.name || 'Manager';
      const { data: existingBarber } = await supabase
        .from('coiffeuses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (existingBarber) {
        const { error: barberErr } = await supabase.from('coiffeuses').update({
          name: barberName,
          salon_id: salon.id,
          role: 'manager',
        }).eq('id', existingBarber.id);
        if (barberErr) throw new Error(`Liaison coiffeuse : ${barberErr.message}`);
      } else {
        const { error: barberErr } = await supabase.from('coiffeuses').insert({
          user_id: user.id,
          name: barberName,
          salon_id: salon.id,
          role: 'manager',
        });
        if (barberErr) throw new Error(`Création coiffeuse : ${barberErr.message}`);
      }

      // 3. Upload photos
      const uploadedUrls = [];
      for (let i = 0; i < photoUris.length; i++) {
        try {
          const uri = photoUris[i];
          const ext = uri.split('.').pop().split('?')[0] || 'jpg';
          const fileName = `salon_${salon.id}_${i}.${ext}`;
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const { error: uploadErr } = await supabase.storage
            .from('Photos')
            .upload(fileName, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('Photos').getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
          }
        } catch (_) {}
      }
      if (uploadedUrls.length > 0) {
        await supabase.from('salons').update({ photo_url: uploadedUrls[0] }).eq('id', salon.id);
        for (let i = 0; i < uploadedUrls.length; i++) {
          await supabase.from('salon_photos').insert({
            salon_id: salon.id,
            photo_url: uploadedUrls[i],
            position: i,
          });
        }
      }

      // 4. Codes d'invitation pour l'équipe
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      for (const member of teamMembers) {
        await supabase.from('salon_invites').insert({
          salon_id: salon.id,
          code: member.code,
          is_used: false,
          expires_at: expiresAt,
        });
      }

      // 5. Prestations
      for (const svc of servicesList) {
        await supabase.from('services').insert({
          salon_id: salon.id,
          name: svc.name,
          price: parseFloat(svc.price) || 0,
          duration_minutes: parseInt(svc.duration) || 30,
          is_active: true,
        });
      }

      // 6. Horaires
      for (const h of hours) {
        await supabase.from('opening_hours').insert({
          salon_id: salon.id,
          day_of_week: h.day,
          open_time: h.open,
          close_time: h.close,
          is_closed: h.closed,
        });
      }

      onSalonCreated();
    } catch (e) {
      console.error('[CreateSalon]', e.message);
      setCreateError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      {onBack && (
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* EN-TÊTE */}
          <View style={styles.header}>
            <Text style={styles.logoTitle}>Fresh<Text style={styles.gold}>Girlz</Text></Text>
            <Text style={styles.headerSub}>Créons votre salon 💇‍♀️</Text>
          </View>

          {/* INDICATEUR D'ÉTAPES */}
          <View style={styles.stepsRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[styles.stepDot, i + 1 === step && styles.stepDotActive, i + 1 < step && styles.stepDotDone]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>Étape {step} sur {TOTAL_STEPS}</Text>

          {/* ── ÉTAPE 1 : INFOS DE BASE ── */}
          {step === 1 && (
            <BlurView intensity={65} tint="light" style={styles.card}>
              <Text style={styles.cardTitle}>🏪 Informations du salon</Text>

              <Field label="Nom du salon *">
                <TextInput
                  style={styles.input}
                  placeholder="Ex : FreshGirlz Paris"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={salonName}
                  onChangeText={setSalonName}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Adresse">
                <TextInput
                  style={styles.input}
                  placeholder="Ex : 12 rue de la Paix"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={salonAddress}
                  onChangeText={setSalonAddress}
                />
              </Field>

              <View style={styles.addressRow}>
                <View style={{ width: 90 }}>
                  <Field label="Code postal">
                    <TextInput
                      style={styles.input}
                      placeholder="75001"
                      placeholderTextColor="rgba(28,28,30,0.3)"
                      value={salonPostalCode}
                      onChangeText={setSalonPostalCode}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Ville">
                    <TextInput
                      style={styles.input}
                      placeholder="Paris"
                      placeholderTextColor="rgba(28,28,30,0.3)"
                      value={salonCity}
                      onChangeText={setSalonCity}
                      autoCapitalize="words"
                    />
                  </Field>
                </View>
              </View>

              <Field label="Description">
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Ex : Barbershop premium au cœur de Paris"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={salonDesc}
                  onChangeText={setSalonDesc}
                  multiline
                  numberOfLines={3}
                />
              </Field>

              <Field label="Téléphone">
                <TextInput
                  style={styles.input}
                  placeholder="+33 6 00 00 00 00"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={salonPhone}
                  onChangeText={setSalonPhone}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Instagram">
                <TextInput
                  style={styles.input}
                  placeholder="@votresalon"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={salonInstagram}
                  onChangeText={setSalonInstagram}
                  autoCapitalize="none"
                />
              </Field>
            </BlurView>
          )}

          {/* ── ÉTAPE 2 : PHOTOS ── */}
          {step === 2 && (
            <BlurView intensity={65} tint="light" style={styles.card}>
              <Text style={styles.cardTitle}>📸 Photos du salon</Text>
              <Text style={styles.cardSub}>
                Jusqu'à 5 photos · la première sera la photo principale
              </Text>

              <View style={styles.photoGrid}>
                {photoUris.map((uri, i) => (
                  <View key={i} style={styles.photoThumb}>
                    <Image source={{ uri }} style={styles.photoThumbImg} contentFit="cover" />
                    {i === 0 && (
                      <View style={styles.mainBadge}>
                        <Text style={styles.mainBadgeText}>Principale</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removePhoto(i)}>
                      <Text style={styles.removePhotoBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {photoUris.length < 5 && (
                  <TouchableOpacity style={styles.addPhotoThumb} onPress={pickPhoto} activeOpacity={0.7}>
                    <Text style={styles.addPhotoIcon}>+</Text>
                    <Text style={styles.addPhotoLabel}>
                      {photoUris.length === 0 ? 'Ajouter une photo' : 'Ajouter'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>
          )}

          {/* ── ÉTAPE 3 : ÉQUIPE ── */}
          {step === 3 && (
            <BlurView intensity={65} tint="light" style={styles.card}>
              <Text style={styles.cardTitle}>👥 Votre équipe</Text>
              <Text style={styles.cardSub}>Ajoutez vos coiffeuses — chacun recevra un code d'invitation unique</Text>

              {teamMembers.map((m, i) => (
                <View key={i} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.name}</Text>
                    <View style={styles.codeRow}>
                      <Text style={styles.codeValue}>{m.code}</Text>
                      <TouchableOpacity onPress={() => regenerateCode(i)} style={styles.regenBtn}>
                        <Text style={styles.regenBtnText}>↺</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeTeamMember(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.addMemberRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Prénom du Coiffeuse"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={newMemberName}
                  onChangeText={setNewMemberName}
                  autoCapitalize="words"
                  onSubmitEditing={addTeamMember}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addTeamMember}>
                  <Text style={styles.addBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          )}

          {/* ── ÉTAPE 4 : PRESTATIONS ── */}
          {step === 4 && (
            <BlurView intensity={65} tint="light" style={styles.card}>
              <Text style={styles.cardTitle}>✂ Vos prestations</Text>
              <Text style={styles.cardSub}>Vous pourrez en ajouter d'autres depuis la gestion du salon</Text>

              {servicesList.map((s, i) => (
                <View key={i} style={styles.serviceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{s.name}</Text>
                    <Text style={styles.serviceMeta}>{s.duration} min · {s.price ? `${s.price} €` : 'Prix libre'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeService(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <Field label="Nom de la prestation">
                <TextInput
                  style={styles.input}
                  placeholder="Ex : Coupe + dégradé"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={newSvcName}
                  onChangeText={setNewSvcName}
                  autoCapitalize="words"
                />
              </Field>

              <View style={styles.svcMetaRow}>
                <View style={{ flex: 1 }}>
                  <Field label="Durée (min)">
                    <TextInput
                      style={styles.input}
                      placeholder="30"
                      placeholderTextColor="rgba(28,28,30,0.3)"
                      value={newSvcDuration}
                      onChangeText={setNewSvcDuration}
                      keyboardType="numeric"
                    />
                  </Field>
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Field label="Prix (€)">
                    <TextInput
                      style={styles.input}
                      placeholder="20"
                      placeholderTextColor="rgba(28,28,30,0.3)"
                      value={newSvcPrice}
                      onChangeText={setNewSvcPrice}
                      keyboardType="numeric"
                    />
                  </Field>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.secondaryBtn, !newSvcName.trim() && { opacity: 0.4 }]}
                onPress={addService}
                disabled={!newSvcName.trim()}>
                <Text style={styles.secondaryBtnText}>+ Ajouter cette prestation</Text>
              </TouchableOpacity>
            </BlurView>
          )}

          {/* ── ÉTAPE 5 : HORAIRES ── */}
          {step === 5 && (
            <BlurView intensity={65} tint="light" style={styles.card}>
              <Text style={styles.cardTitle}>🕐 Horaires d'ouverture</Text>
              <Text style={styles.cardSub}>Modifiables à tout moment depuis la gestion du salon</Text>

              {hours.map((h, i) => (
                <View key={i} style={styles.dayRow}>
                  <Text style={[styles.dayLabel, h.closed && styles.dayLabelClosed]}>{h.label}</Text>
                  <Switch
                    value={!h.closed}
                    onValueChange={() => toggleDay(i)}
                    trackColor={{ false: 'rgba(28,28,30,0.1)', true: 'rgba(124,61,143,0.35)' }}
                    thumbColor={!h.closed ? '#7C3D8F' : 'rgba(28,28,30,0.3)'}
                  />
                  {!h.closed ? (
                    <View style={styles.hoursInputs}>
                      <TextInput
                        style={styles.hourInput}
                        value={h.open}
                        onChangeText={v => updateHour(i, 'open', v)}
                        placeholder="09:00"
                        placeholderTextColor="rgba(28,28,30,0.3)"
                        maxLength={5}
                      />
                      <Text style={styles.hourSep}>–</Text>
                      <TextInput
                        style={styles.hourInput}
                        value={h.close}
                        onChangeText={v => updateHour(i, 'close', v)}
                        placeholder="19:00"
                        placeholderTextColor="rgba(28,28,30,0.3)"
                        maxLength={5}
                      />
                    </View>
                  ) : (
                    <Text style={styles.closedLabel}>Fermé</Text>
                  )}
                </View>
              ))}
            </BlurView>
          )}

          {/* ─── BOUTONS DE NAVIGATION ─── */}
          {createError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {createError}</Text>
            </View>
          )}
          <View style={styles.navRow}>
            {step > 1 && (
              <TouchableOpacity style={styles.navBackBtn} onPress={prevStep}>
                <Text style={styles.navBackBtnText}>← Retour</Text>
              </TouchableOpacity>
            )}

            {step < TOTAL_STEPS ? (
              <View style={styles.nextGroup}>
                {step >= 2 && (
                  <TouchableOpacity style={styles.skipBtn} onPress={nextStep}>
                    <Text style={styles.skipBtnText}>Passer</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
                  <Text style={styles.nextBtnText}>Suivant →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.createBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>Créer mon salon 🎉</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.2)' },
  blob2: { position: 'absolute', bottom: 100, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', top: 300, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,61,143,0.12)' },

  scroll: { flexGrow: 1, padding: 20, paddingBottom: 50 },

  header: { alignItems: 'center', marginBottom: 18, marginTop: 48 },
  backBtn: { position: 'absolute', top: 14, left: 16, zIndex: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(28,28,30,0.85)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 20, color: '#fff', lineHeight: 22 },
  logoTitle: { fontSize: 30, fontWeight: '800', color: '#1C1C1E', letterSpacing: -1.2 },
  gold: { color: '#7C3D8F' },
  headerSub: { fontSize: 15, color: 'rgba(28,28,30,0.5)', marginTop: 4 },

  stepsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,28,30,0.12)' },
  stepDotActive: { backgroundColor: '#7C3D8F', width: 22, borderRadius: 4 },
  stepDotDone: { backgroundColor: 'rgba(124,61,143,0.4)' },
  stepLabel: { textAlign: 'center', fontSize: 12, color: 'rgba(28,28,30,0.4)', marginBottom: 16 },

  card: { borderRadius: 22, overflow: 'hidden', padding: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  cardSub: { fontSize: 13, color: 'rgba(28,28,30,0.45)', marginBottom: 18, lineHeight: 18 },

  fieldWrap: { marginBottom: 13 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 13, padding: 12, fontSize: 15, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  addressRow: { flexDirection: 'row', gap: 10 },

  // Photo grid
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoThumb: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(28,28,30,0.06)' },
  photoThumbImg: { width: '100%', height: '100%' },
  mainBadge: { position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(168,133,42,0.85)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mainBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  removePhotoBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  removePhotoBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  addPhotoThumb: { width: '31%', aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(28,28,30,0.15)', borderStyle: 'dashed', backgroundColor: 'rgba(28,28,30,0.03)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoIcon: { fontSize: 26, color: 'rgba(28,28,30,0.3)', lineHeight: 30 },
  addPhotoLabel: { fontSize: 9, color: 'rgba(28,28,30,0.35)', textAlign: 'center' },

  // Équipe
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,61,143,0.07)', borderRadius: 13, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(124,61,143,0.2)' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeValue: { fontSize: 16, fontWeight: '800', color: '#7C3D8F', letterSpacing: 3 },
  regenBtn: { padding: 4 },
  regenBtnText: { fontSize: 16, color: 'rgba(28,28,30,0.4)' },
  addMemberRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  addBtn: { backgroundColor: '#7C3D8F', borderRadius: 13, width: 48, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 24, color: '#fff', fontWeight: '300' },
  removeBtn: { padding: 8 },
  removeBtnText: { fontSize: 14, color: 'rgba(28,28,30,0.35)' },

  // Prestations
  serviceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168,133,42,0.07)', borderRadius: 13, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.2)' },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  serviceMeta: { fontSize: 12, color: 'rgba(28,28,30,0.45)', marginTop: 2 },
  svcMetaRow: { flexDirection: 'row' },
  secondaryBtn: { backgroundColor: 'rgba(168,133,42,0.1)', borderRadius: 13, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.3)', marginTop: 4 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#7C3D8F' },

  // Horaires
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(28,28,30,0.06)' },
  dayLabel: { width: 36, fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  dayLabelClosed: { color: 'rgba(28,28,30,0.3)' },
  hoursInputs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 12 },
  hourInput: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, fontWeight: '600', color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', width: 62, textAlign: 'center' },
  hourSep: { fontSize: 14, color: 'rgba(28,28,30,0.35)' },
  closedLabel: { marginLeft: 12, fontSize: 13, color: 'rgba(28,28,30,0.35)', fontStyle: 'italic' },

  // Navigation
  errorBox: { backgroundColor: 'rgba(192,57,43,0.09)', borderRadius: 13, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.25)' },
  errorText: { fontSize: 13, color: '#C0392B', lineHeight: 18 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  navBackBtn: { paddingVertical: 12, paddingHorizontal: 6 },
  navBackBtnText: { fontSize: 15, color: 'rgba(28,28,30,0.45)', fontWeight: '500' },
  nextGroup: { flexDirection: 'row', gap: 10, marginLeft: 'auto' },
  skipBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.06)' },
  skipBtnText: { fontSize: 14, color: 'rgba(28,28,30,0.45)', fontWeight: '500' },
  nextBtn: { backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 13, paddingVertical: 12, paddingHorizontal: 22 },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  createBtn: { flex: 1, backgroundColor: '#7C3D8F', borderRadius: 14, padding: 15, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

