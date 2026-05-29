import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  TextInput, ScrollView, Alert, Keyboard, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import { colors, SPECIALITES } from './colors';

const TOTAL_STEPS = 6;

const WORK_MODES = [
  { id: 'domicile', label: 'À mon domicile',                    Icon: '🏠', desc: 'Vous recevez vos clientes chez vous' },
  { id: 'deplace',  label: 'Je me déplace chez mes clientes',   Icon: '🚐', desc: '' },
  { id: 'les_deux', label: 'Les deux',                          Icon: '📍', desc: '' },
];

const PRICE_TYPES = [
  { key: 'fixed', label: 'Prix fixe' },
  { key: 'from',  label: 'À partir de' },
  { key: 'range', label: 'Fourchette' },
];

const DURATIONS_H = ['0', '1', '2', '3', '4', '5'];
const DURATIONS_M = ['0', '15', '30', '45'];

export default function OnboardingIndependanteScreen({ onComplete }) {
  const [step, setStep]           = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Étape 1 — Identité
  const [avatarUri, setAvatarUri] = useState(null);
  const [nomPro, setNomPro]       = useState('');
  const [slogan, setSlogan]       = useState('');

  // Étape 2 — Spécialités
  const [selectedSpecs, setSelectedSpecs] = useState([]);

  // Étape 3 — Modes + Zones
  const [selectedModes, setSelectedModes] = useState([]);
  const [zones, setZones]                 = useState([]);
  const [zoneCity, setZoneCity]           = useState('');
  const [zoneKm, setZoneKm]               = useState('');

  // Étape 5 — Prestations
  const [services, setServices]       = useState([]);
  const [showSvcModal, setShowSvcModal] = useState(false);
  const [svcName, setSvcName]         = useState('');
  const [svcDesc, setSvcDesc]         = useState('');
  const [svcPriceType, setSvcPriceType] = useState('fixed');
  const [svcPriceMin, setSvcPriceMin] = useState('');
  const [svcPriceMax, setSvcPriceMax] = useState('');
  const [svcDurH, setSvcDurH]         = useState('0');
  const [svcDurM, setSvcDurM]         = useState('30');

  // Étape 6 — Book photos
  const [bookPhotos, setBookPhotos]   = useState([]);

  // ─── Navigation ────────────────────────────────────────────────────────────

  function nextStep() {
    Keyboard.dismiss();
    if (step === 1 && !nomPro.trim()) {
      Alert.alert('Requis', 'Renseigne le nom de ton activité pour continuer.');
      return;
    }
    if (step === 2 && selectedSpecs.length === 0) {
      Alert.alert('Requis', 'Sélectionne au moins une spécialité.');
      return;
    }
    if (step === 3 && selectedModes.length === 0) {
      Alert.alert('Requis', 'Indique comment tu travailles.');
      return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  }

  function addZone() {
    if (!zoneCity.trim()) return;
    const label = zoneKm.trim()
      ? `${zoneCity.trim()} et alentours, ${zoneKm.trim()} km`
      : zoneCity.trim();
    setZones(prev => [...prev, label]);
    setZoneCity('');
    setZoneKm('');
  }

  function removeZone(idx) {
    setZones(prev => prev.filter((_, i) => i !== idx));
  }

  function prevStep() {
    if (step > 1) setStep(s => s - 1);
  }

  function skipStep() {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  }

  // ─── Avatar ────────────────────────────────────────────────────────────────

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "L'accès à la galerie est requis.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  }

  // ─── Spécialités ───────────────────────────────────────────────────────────

  function toggleSpec(id) {
    setSelectedSpecs(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  // ─── Modes de travail ──────────────────────────────────────────────────────

  function toggleMode(id) {
    setSelectedModes(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }

  // ─── Services ──────────────────────────────────────────────────────────────

  function openAddService() {
    setSvcName(''); setSvcDesc('');
    setSvcPriceType('fixed'); setSvcPriceMin(''); setSvcPriceMax('');
    setSvcDurH('0'); setSvcDurM('30');
    setShowSvcModal(true);
  }

  function confirmAddService() {
    if (!svcName.trim()) { Alert.alert('Requis', 'Nom de la prestation requis.'); return; }
    setServices(prev => [...prev, {
      name: svcName.trim(),
      description: svcDesc.trim() || null,
      price_type: svcPriceType,
      price_min: svcPriceMin ? parseFloat(svcPriceMin) : null,
      price_max: svcPriceMax ? parseFloat(svcPriceMax) : null,
      duration_minutes: parseInt(svcDurH) * 60 + parseInt(svcDurM),
    }]);
    setShowSvcModal(false);
  }

  function removeService(idx) {
    setServices(prev => prev.filter((_, i) => i !== idx));
  }

  function fmtServicePrice(svc) {
    if (!svc.price_min && svc.price_min !== 0) return 'Sur devis';
    if (svc.price_type === 'range' && svc.price_max)
      return `${svc.price_min} – ${svc.price_max} €`;
    if (svc.price_type === 'from') return `À partir de ${svc.price_min} €`;
    if (svc.price_min === 0) return 'Gratuit';
    return `${svc.price_min} €`;
  }

  function fmtDur(svc) {
    const h = Math.floor(svc.duration_minutes / 60);
    const m = svc.duration_minutes % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  // ─── Book photos ───────────────────────────────────────────────────────────

  async function pickBookPhoto() {
    if (bookPhotos.length >= 6) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "L'accès à la galerie est requis.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled) setBookPhotos(prev => [...prev, result.assets[0].uri]);
  }

  function removeBookPhoto(idx) {
    setBookPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  // ─── Upload helper ─────────────────────────────────────────────────────────

  async function uploadPhoto(uri, bucket, folder) {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(`Upload échoué : ${error.message}`);
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }

  // ─── Sauvegarde finale ─────────────────────────────────────────────────────

  async function handlePublish() {
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée — reconnecte-toi');

      // Récupérer l'id coiffeuse
      const { data: coiffeuse } = await supabase
        .from('coiffeuses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!coiffeuse) throw new Error('Profil coiffeuse introuvable');

      // 1. Upload avatar
      let photoUrl = null;
      if (avatarUri) {
        photoUrl = await uploadPhoto(avatarUri, 'avatars', user.id);
      }

      // 2. Mettre à jour le profil coiffeuse via RPC (contourne le schema cache)
      const { error: profileErr } = await supabase.rpc('save_onboarding_independante', {
        p_user_id:           user.id,
        p_nom_pro:           nomPro.trim(),
        p_avatar_url:        photoUrl,
        p_specialites:       selectedSpecs,
        p_work_modes:        selectedModes,
        p_ville:             zones.length > 0 ? zones[0].split(' et')[0] : null,
        p_intervention_zone: zones.length > 0 ? zones.join(' | ') : null,
        p_onboarding_done:   true,
        p_bio:               slogan.trim() || null,
      });
      if (profileErr) throw new Error(`Profil : ${profileErr.message}`);

      // 3. Insérer les services
      if (services.length > 0) {
        const rows = services.map(s => ({
          coiffeuse_id:     coiffeuse.id,
          salon_id:         null,
          name:             s.name,
          description:      s.description,
          price_type:       s.price_type,
          price_min:        s.price_min,
          price_max:        s.price_max,
          duration_minutes: s.duration_minutes,
          is_active:        true,
        }));
        const { error: svcErr } = await supabase.from('services').insert(rows);
        if (svcErr) throw new Error(`Services : ${svcErr.message}`);
      }

      // 4. Upload book photos
      for (const uri of bookPhotos) {
        const url = await uploadPhoto(uri, 'book-photos', user.id);
        await supabase.from('book_photos').insert({
          coiffeuse_id: coiffeuse.id,
          photo_url:    url,
        });
      }

      onComplete();
    } catch (err) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Rendu étapes ──────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 1: return <StepIdentite
        avatarUri={avatarUri} onPickAvatar={pickAvatar}
        nomPro={nomPro} setNomPro={setNomPro}
        slogan={slogan} setSlogan={setSlogan} />;
      case 2: return <StepSpecialites
        selectedSpecs={selectedSpecs} toggleSpec={toggleSpec} />;
      case 3: return <StepModes
        selectedModes={selectedModes} toggleMode={toggleMode}
        zones={zones} zoneCity={zoneCity} setZoneCity={setZoneCity}
        zoneKm={zoneKm} setZoneKm={setZoneKm}
        onAddZone={addZone} onRemoveZone={removeZone} />;
      case 4: return <StepServices
        services={services} onAdd={openAddService} onRemove={removeService}
        fmtPrice={fmtServicePrice} fmtDur={fmtDur} />;
      case 5: return <StepBookPhotos
        photos={bookPhotos} onAdd={pickBookPhoto} onRemove={removeBookPhoto} />;
      case 6: return <StepResume
        avatarUri={avatarUri} nomPro={nomPro} slogan={slogan}
        zones={zones} selectedSpecs={selectedSpecs} selectedModes={selectedModes}
        servicesCount={services.length} photosCount={bookPhotos.length} />;
      default: return null;
    }
  }

  const isOptionalStep = step === 4 || step === 5;
  const isLastStep = step === TOTAL_STEPS;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.bg}>
        <View style={s.blob1} />
        <View style={s.blob2} />
        <View style={s.blob3} />
        <View style={s.blob4} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          {step > 1 ? (
            <TouchableOpacity onPress={prevStep} style={s.backBtn}>
              <Text style={s.backBtnTxt}>←</Text>
            </TouchableOpacity>
          ) : <View style={s.backBtn} />}

          <View style={s.progressWrap}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[s.dot, i < step && s.dotActive, i === step - 1 && s.dotCurrent]}
              />
            ))}
          </View>

          <Text style={s.stepCount}>{step}/{TOTAL_STEPS}</Text>
        </View>

        {/* Contenu */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {isOptionalStep && !isLastStep && (
            <TouchableOpacity onPress={skipStep} style={s.skipBtn}>
              <Text style={s.skipBtnTxt}>Passer</Text>
            </TouchableOpacity>
          )}
          {isLastStep ? (
            <TouchableOpacity
              style={[s.nextBtn, submitting && s.nextBtnDisabled]}
              onPress={handlePublish}
              disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.nextBtnTxt}>Publier mon profil ✨</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.nextBtn} onPress={nextStep}>
              <Text style={s.nextBtnTxt}>
                {step === 1 ? 'Commencer →' : 'Suivant →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal ajout prestation */}
      <ServiceModal
        visible={showSvcModal}
        onClose={() => setShowSvcModal(false)}
        onConfirm={confirmAddService}
        name={svcName} setName={setSvcName}
        desc={svcDesc} setDesc={setSvcDesc}
        priceType={svcPriceType} setPriceType={setSvcPriceType}
        priceMin={svcPriceMin} setPriceMin={setSvcPriceMin}
        priceMax={svcPriceMax} setPriceMax={setSvcPriceMax}
        durH={svcDurH} setDurH={setSvcDurH}
        durM={svcDurM} setDurM={setSvcDurM}
      />
    </SafeAreaView>
  );
}

// ─── Étape 1 : Identité ────────────────────────────────────────────────────

function StepIdentite({ avatarUri, onPickAvatar, nomPro, setNomPro, slogan, setSlogan }) {
  return (
    <View style={s.identiteWrap}>
      {/* Photo grande et centrée */}
      <TouchableOpacity style={s.identiteAvatarBtn} onPress={onPickAvatar} activeOpacity={0.85}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={s.identiteAvatar} />
          : <View style={s.identiteAvatarEmpty}><Text style={s.identiteAvatarEmptyTxt}>Ajouter{'\n'}une photo</Text></View>}
        <View style={s.identiteCameraBtn}>
          <Text style={s.identiteCameraIcon}>📷</Text>
        </View>
      </TouchableOpacity>

      {/* Champs */}
      <View style={s.identiteFields}>
        <Text style={s.inputLabel}>Nom de votre activité</Text>
        <TextInput
          style={s.input}
          placeholder="Ex : Nana Hair, Vaalia Beauté…"
          placeholderTextColor="rgba(28,28,30,0.3)"
          value={nomPro}
          onChangeText={setNomPro}
          autoCapitalize="words"
          maxLength={50}
        />

        <Text style={[s.inputLabel, { marginTop: 20 }]}>Votre slogan (optionnel)</Text>
        <TextInput
          style={[s.input, s.inputMultiline]}
          placeholder="Des coiffures qui révèlent votre beauté ✨"
          placeholderTextColor="rgba(28,28,30,0.3)"
          value={slogan}
          onChangeText={setSlogan}
          multiline
          textAlignVertical="top"
          maxLength={120}
        />
      </View>
    </View>
  );
}

// ─── Étape 2 : Spécialités ────────────────────────────────────────────────

function StepSpecialites({ selectedSpecs, toggleSpec }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Vos spécialités</Text>
      <Text style={s.stepSub}>Sélectionnez tout ce que vous maîtrisez</Text>

      <View style={s.specsGrid}>
        {SPECIALITES.map(spec => {
          const active = selectedSpecs.includes(spec.id);
          return (
            <TouchableOpacity
              key={spec.id}
              style={[s.specCard, active && { backgroundColor: spec.color + '18', borderColor: spec.color }]}
              onPress={() => toggleSpec(spec.id)}
              activeOpacity={0.75}>
              <Text style={[s.specLabel, active && { color: spec.color, fontWeight: '800' }]}>
                {spec.label}
              </Text>
              {active && (
                <View style={[s.specCheck, { backgroundColor: spec.color }]}>
                  <Text style={s.specCheckMark}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedSpecs.length > 0 && (
        <Text style={s.selectedCount}>{selectedSpecs.length} spécialité{selectedSpecs.length > 1 ? 's' : ''} sélectionnée{selectedSpecs.length > 1 ? 's' : ''}</Text>
      )}
    </View>
  );
}

// ─── Étape 3 : Modes de travail + Zones ──────────────────────────────────

function StepModes({ selectedModes, toggleMode, zones, zoneCity, setZoneCity, zoneKm, setZoneKm, onAddZone, onRemoveZone }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Où travaillez-vous ?</Text>
      <Text style={s.stepSub}>Sélectionnez vos lieux d'exercice{'\n'}(plusieurs choix possibles)</Text>

      <View style={s.modeList}>
        {WORK_MODES.map(mode => {
          const active = selectedModes.includes(mode.id);
          return (
            <TouchableOpacity
              key={mode.id}
              style={[s.modeCard, active && s.modeCardActive]}
              onPress={() => toggleMode(mode.id)}
              activeOpacity={0.8}>
              <Text style={s.modeEmoji}>{mode.Icon}</Text>
              <Text style={[s.modeLabel, active && s.modeLabelActive]}>{mode.label}</Text>
              <View style={[s.modeCheckbox, active && s.modeCheckboxActive]}>
                {active && <Text style={s.modeCheckmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Zone d'intervention */}
      <View style={s.zoneSection}>
        <Text style={s.zoneSectionTitle}>Zone d'intervention</Text>
        <Text style={s.zoneSectionSub}>Ajouter vos zones</Text>

        {zones.map((z, i) => (
          <TouchableOpacity key={i} style={s.zoneRow} onPress={() => onRemoveZone(i)} activeOpacity={0.7}>
            <Text style={s.zoneRowTxt}>{z}</Text>
            <Text style={s.zoneRowArrow}>✕</Text>
          </TouchableOpacity>
        ))}

        <View style={s.zoneInputRow}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            placeholder="Ville (ex: Paris)"
            placeholderTextColor="rgba(28,28,30,0.3)"
            value={zoneCity}
            onChangeText={setZoneCity}
            autoCapitalize="words"
          />
          <TextInput
            style={[s.input, s.zoneKmInput]}
            placeholder="km"
            placeholderTextColor="rgba(28,28,30,0.3)"
            value={zoneKm}
            onChangeText={v => setZoneKm(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TouchableOpacity style={s.zoneAddBtn} onPress={onAddZone}>
            <Text style={s.zoneAddBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Étape 4 : Prestations ────────────────────────────────────────────────

function StepServices({ services, onAdd, onRemove, fmtPrice, fmtDur }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Tes prestations</Text>
      <Text style={s.stepSub}>Tu pourras en ajouter d'autres plus tard</Text>

      {services.map((svc, i) => (
        <BlurView key={i} intensity={55} tint="light" style={s.svcRow}>
          <View style={s.svcInfo}>
            <Text style={s.svcName}>{svc.name}</Text>
            <Text style={s.svcMeta}>{fmtDur(svc)} · {fmtPrice(svc)}</Text>
          </View>
          <TouchableOpacity onPress={() => onRemove(i)} style={s.svcRemove}>
            <Text style={s.svcRemoveTxt}>✕</Text>
          </TouchableOpacity>
        </BlurView>
      ))}

      <TouchableOpacity style={s.addSvcBtn} onPress={onAdd}>
        <Text style={s.addSvcBtnTxt}>+ Ajouter une prestation</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Étape 5 : Book photos ────────────────────────────────────────────────

function StepBookPhotos({ photos, onAdd, onRemove }) {
  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Ton book photo</Text>
      <Text style={s.stepSub}>Montre ton travail — jusqu'à 6 photos</Text>

      <View style={s.bookGrid}>
        {photos.map((uri, i) => (
          <View key={i} style={s.bookItem}>
            <Image source={{ uri }} style={s.bookImg} />
            <TouchableOpacity style={s.bookRemove} onPress={() => onRemove(i)}>
              <Text style={s.bookRemoveTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 6 && (
          <TouchableOpacity style={s.bookAdd} onPress={onAdd}>
            <Text style={s.bookAddIcon}>+</Text>
            <Text style={s.bookAddTxt}>Photo</Text>
          </TouchableOpacity>
        )}
      </View>

      {photos.length === 0 && (
        <Text style={s.bookHint}>
          Un book avec de belles photos multiplie tes réservations 💅
        </Text>
      )}
    </View>
  );
}

// ─── Étape 6 : Résumé ─────────────────────────────────────────────────────

function StepResume({ avatarUri, nomPro, slogan, zones, selectedSpecs, selectedModes, servicesCount, photosCount }) {
  const specInfos = SPECIALITES.filter(sp => selectedSpecs.includes(sp.id));
  const modeInfos = WORK_MODES.filter(m => selectedModes.includes(m.id));

  return (
    <View style={s.stepWrap}>
      <Text style={s.stepTitle}>Ton profil est prêt 🎉</Text>
      <Text style={s.stepSub}>Voici un aperçu avant publication</Text>

      {/* Carte identité */}
      <BlurView intensity={65} tint="light" style={s.resumeCard}>
        <View style={s.resumeAvatarRow}>
          <View style={s.resumeAvatarRing}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.resumeAvatar} />
              : <View style={s.resumeAvatarPlaceholder}><Text style={{ fontSize: 32 }}>💅</Text></View>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.resumeName}>{nomPro || 'Mon profil'}</Text>
            {slogan ? <Text style={s.resumeSlogan}>{slogan}</Text> : null}
            {zones.length > 0 ? <Text style={s.resumeVille}>📍 {zones[0]}</Text> : null}
            <View style={s.resumeStatRow}>
              <View style={s.resumeStat}>
                <Text style={s.resumeStatVal}>{servicesCount}</Text>
                <Text style={s.resumeStatLabel}>prestation{servicesCount > 1 ? 's' : ''}</Text>
              </View>
              <View style={s.resumeStatDiv} />
              <View style={s.resumeStat}>
                <Text style={s.resumeStatVal}>{photosCount}</Text>
                <Text style={s.resumeStatLabel}>photo{photosCount > 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        </View>
      </BlurView>

      {/* Spécialités */}
      {specInfos.length > 0 && (
        <BlurView intensity={55} tint="light" style={s.resumeSection}>
          <Text style={s.resumeSectionTitle}>Spécialités</Text>
          <View style={s.resumeChips}>
            {specInfos.map(sp => (
              <View key={sp.id} style={[s.resumeChip, { borderColor: sp.color, backgroundColor: sp.color + '18' }]}>
                <Text style={s.resumeChipEmoji}>{sp.emoji}</Text>
                <Text style={[s.resumeChipTxt, { color: sp.color }]}>{sp.label}</Text>
              </View>
            ))}
          </View>
        </BlurView>
      )}

      {/* Modes */}
      {modeInfos.length > 0 && (
        <BlurView intensity={55} tint="light" style={s.resumeSection}>
          <Text style={s.resumeSectionTitle}>Modes de travail</Text>
          <View style={s.resumeModes}>
            {modeInfos.map(m => (
              <View key={m.id} style={s.resumeMode}>
                <Text style={s.resumeModeEmoji}>{m.Icon}</Text>
                <Text style={s.resumeModeTxt}>{m.label}</Text>
              </View>
            ))}
          </View>
        </BlurView>
      )}

      <Text style={s.resumeNote}>
        Tu pourras modifier tous ces éléments depuis ton profil à tout moment.
      </Text>
    </View>
  );
}

// ─── Modal prestation ─────────────────────────────────────────────────────

function ServiceModal({
  visible, onClose, onConfirm,
  name, setName, desc, setDesc,
  priceType, setPriceType, priceMin, setPriceMin, priceMax, setPriceMax,
  durH, setDurH, durM, setDurM,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <BlurView intensity={75} tint="light" style={s.modalBox}>
            <Text style={s.modalTitle}>Nouvelle prestation</Text>

            <Text style={s.inputLabel}>Nom *</Text>
            <TextInput
              style={s.input}
              placeholder="Ex : Tresses box braids"
              placeholderTextColor="rgba(28,28,30,0.3)"
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />

            <Text style={[s.inputLabel, { marginTop: 12 }]}>Description (optionnel)</Text>
            <TextInput
              style={[s.input, { minHeight: 60 }]}
              placeholder="Détails, inclus dans la prestation…"
              placeholderTextColor="rgba(28,28,30,0.3)"
              value={desc}
              onChangeText={setDesc}
              multiline
              textAlignVertical="top"
            />

            <Text style={[s.inputLabel, { marginTop: 12 }]}>Durée</Text>
            <View style={s.durRow}>
              <View style={s.durGroup}>
                <Text style={s.durGroupLabel}>Heures</Text>
                <View style={s.durBtns}>
                  {DURATIONS_H.map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[s.durBtn, durH === h && s.durBtnActive]}
                      onPress={() => setDurH(h)}>
                      <Text style={[s.durBtnTxt, durH === h && s.durBtnTxtActive]}>{h}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={s.durGroup}>
                <Text style={s.durGroupLabel}>Minutes</Text>
                <View style={s.durBtns}>
                  {DURATIONS_M.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[s.durBtn, durM === m && s.durBtnActive]}
                      onPress={() => setDurM(m)}>
                      <Text style={[s.durBtnTxt, durM === m && s.durBtnTxtActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[s.inputLabel, { marginTop: 12 }]}>Type de prix</Text>
            <View style={s.priceTypeRow}>
              {PRICE_TYPES.map(pt => (
                <TouchableOpacity
                  key={pt.key}
                  style={[s.priceTypeBtn, priceType === pt.key && s.priceTypeBtnActive]}
                  onPress={() => setPriceType(pt.key)}>
                  <Text style={[s.priceTypeTxt, priceType === pt.key && s.priceTypeTxtActive]}>
                    {pt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.priceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.inputLabel}>
                  {priceType === 'range' ? 'Prix min (€)' : 'Prix (€)'}
                </Text>
                <TextInput
                  style={s.input}
                  placeholder="0"
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={priceMin}
                  onChangeText={setPriceMin}
                  keyboardType="decimal-pad"
                />
              </View>
              {priceType === 'range' && (
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.inputLabel}>Prix max (€)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="0"
                    placeholderTextColor="rgba(28,28,30,0.3)"
                    value={priceMax}
                    onChangeText={setPriceMax}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
                <Text style={s.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalConfirmBtn} onPress={onConfirm}>
                <Text style={s.modalConfirmTxt}>Ajouter →</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.background },
  bg:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background },
  blob1: { position: 'absolute', top: -60,  right: -60,  width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(124,61,143,0.12)' },
  blob2: { position: 'absolute', bottom: 80, left: -80,  width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(201,80,122,0.10)' },
  blob3: { position: 'absolute', top: 280,  right: -40,  width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(212,168,67,0.10)' },
  blob4: { position: 'absolute', top: 500,  left: -30,   width: 180, height: 180, borderRadius: 90,  backgroundColor: 'rgba(46,158,91,0.08)' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backBtnTxt: { fontSize: 22, color: colors.dark },
  progressWrap: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(124,61,143,0.15)' },
  dotActive: { backgroundColor: 'rgba(124,61,143,0.4)' },
  dotCurrent: { backgroundColor: colors.primary, width: 20 },
  stepCount: { fontSize: 12, fontWeight: '600', color: colors.textMuted, width: 36, textAlign: 'right' },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  // Footer
  footer: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 16, paddingTop: 12, gap: 10 },
  nextBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnTxt: { fontSize: 16, fontWeight: '800', color: '#fff' },
  skipBtn: { alignItems: 'center' },
  skipBtnTxt: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },

  // Étapes
  stepWrap: { paddingTop: 10 },
  stepTitle: { fontSize: 26, fontWeight: '800', color: colors.dark, marginBottom: 6 },
  stepSub:   { fontSize: 15, color: colors.textMuted, marginBottom: 24 },

  // Card
  card: { borderRadius: 18, overflow: 'hidden', padding: 18, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: 16 },

  // Inputs
  inputLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  input: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 13, padding: 13, fontSize: 15, color: colors.dark, borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  inputHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },

  // Identité (étape 1)
  identiteWrap: { flex: 1, alignItems: 'center', paddingTop: 8 },
  identiteAvatarBtn: { width: 160, height: 160, borderRadius: 80, marginBottom: 32 },
  identiteAvatar: { width: 160, height: 160, borderRadius: 80 },
  identiteAvatarEmpty: { width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(124,61,143,0.08)', borderWidth: 2, borderColor: 'rgba(124,61,143,0.25)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  identiteAvatarEmptyTxt: { fontSize: 14, color: colors.primary, fontWeight: '600', textAlign: 'center' },
  identiteCameraBtn: { position: 'absolute', bottom: 4, right: 4, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  identiteCameraIcon: { fontSize: 18 },
  identiteFields: { width: '100%' },
  inputMultiline: { minHeight: 80, paddingTop: 13 },

  // Spécialités (grille 2 colonnes, sans emojis)
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specCard: { width: '47%', paddingVertical: 18, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(28,28,30,0.04)', borderWidth: 1, borderColor: 'rgba(28,28,30,0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  specLabel: { fontSize: 15, fontWeight: '600', color: colors.textLight },
  specCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  specCheckMark: { fontSize: 11, color: '#fff', fontWeight: '800' },
  selectedCount: { marginTop: 16, fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'center' },

  // Modes (image 2 style)
  modeList: { gap: 10, marginBottom: 24 },
  modeCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(28,28,30,0.08)', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  modeCardActive: { borderColor: colors.primary, backgroundColor: '#fff' },
  modeEmoji: { fontSize: 24 },
  modeLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.dark },
  modeLabelActive: { color: colors.dark },
  modeCheckbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(28,28,30,0.2)', alignItems: 'center', justifyContent: 'center' },
  modeCheckboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeCheckmark: { fontSize: 12, color: '#fff', fontWeight: '800' },

  // Zone d'intervention
  zoneSection: { gap: 10 },
  zoneSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  zoneSectionSub: { fontSize: 13, color: colors.textMuted, marginTop: -4 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(28,28,30,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  zoneRowTxt: { fontSize: 14, color: colors.dark, fontWeight: '500' },
  zoneRowArrow: { fontSize: 13, color: colors.textMuted },
  zoneInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  zoneKmInput: { width: 64 },
  zoneAddBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  zoneAddBtnTxt: { fontSize: 22, color: '#fff', fontWeight: '700', lineHeight: 26 },

  // Services
  svcRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, overflow: 'hidden', padding: 14, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: 10 },
  svcInfo: { flex: 1 },
  svcName: { fontSize: 15, fontWeight: '700', color: colors.dark },
  svcMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  svcRemove: { padding: 6 },
  svcRemoveTxt: { fontSize: 14, color: colors.textMuted },
  addSvcBtn: { borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(124,61,143,0.4)', borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addSvcBtnTxt: { fontSize: 14, fontWeight: '700', color: colors.primary },

  // Book photos
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bookItem: { width: '30%', aspectRatio: 4 / 5, borderRadius: 12, overflow: 'hidden' },
  bookImg: { width: '100%', height: '100%' },
  bookRemove: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  bookRemoveTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  bookAdd: { width: '30%', aspectRatio: 4 / 5, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(124,61,143,0.4)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bookAddIcon: { fontSize: 22, color: colors.primary, fontWeight: '700' },
  bookAddTxt: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  bookHint: { marginTop: 20, fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Résumé
  resumeCard: { borderRadius: 20, overflow: 'hidden', padding: 20, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: 12 },
  resumeAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  resumeAvatarRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: colors.primary, padding: 2 },
  resumeAvatar: { width: '100%', height: '100%', borderRadius: 34 },
  resumeAvatarPlaceholder: { width: '100%', height: '100%', borderRadius: 34, backgroundColor: 'rgba(124,61,143,0.12)', alignItems: 'center', justifyContent: 'center' },
  resumeName: { fontSize: 18, fontWeight: '800', color: colors.dark, marginBottom: 2 },
  resumeSlogan: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginBottom: 4 },
  resumeVille: { fontSize: 13, color: colors.textMuted, marginBottom: 10 },
  resumeStatRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  resumeStat: { alignItems: 'center', paddingRight: 12 },
  resumeStatVal: { fontSize: 16, fontWeight: '800', color: colors.dark },
  resumeStatLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },
  resumeStatDiv: { width: 1, height: 22, backgroundColor: 'rgba(28,28,30,0.12)', marginRight: 12 },
  resumeSection: { borderRadius: 16, overflow: 'hidden', padding: 16, borderWidth: 0.5, borderColor: colors.borderLight, marginBottom: 12, gap: 10 },
  resumeSectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  resumeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resumeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, borderWidth: 1, gap: 5 },
  resumeChipEmoji: { fontSize: 14 },
  resumeChipTxt: { fontSize: 12, fontWeight: '700' },
  resumeModes: { gap: 8 },
  resumeMode: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resumeModeEmoji: { fontSize: 20 },
  resumeModeTxt: { fontSize: 14, fontWeight: '600', color: colors.dark },
  resumeNote: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  // Modal prestation
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', padding: 24, borderWidth: 0.5, borderColor: colors.borderLight },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.dark, marginBottom: 18 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(28,28,30,0.07)', alignItems: 'center' },
  modalCancelTxt: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center' },
  modalConfirmTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Durée dans modal
  durRow: { flexDirection: 'row', gap: 12 },
  durGroup: { flex: 1 },
  durGroupLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 6 },
  durBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  durBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(28,28,30,0.05)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  durBtnActive: { backgroundColor: colors.primary },
  durBtnTxt: { fontSize: 13, fontWeight: '600', color: colors.textLight },
  durBtnTxtActive: { color: '#fff' },

  // Type prix dans modal
  priceTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priceTypeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(28,28,30,0.05)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', alignItems: 'center' },
  priceTypeBtnActive: { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.4)' },
  priceTypeTxt: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  priceTypeTxtActive: { color: colors.primary },
  priceRow: { flexDirection: 'row', gap: 10 },
});
