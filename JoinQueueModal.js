import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, Alert, Image, Modal, FlatList, Pressable
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { joinQueue, checkAnyActiveQueue, leaveQueue } from './QueueService';
import { haversineKm, etaSecondsFromKm } from './utils/geo';

export default function JoinQueueModal({ navigation, route }) {
  const barber = route.params?.barber || { name:'Kevin J.' };
  const [selected, setSelected] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [etaLoading, setEtaLoading] = useState(true);

  // Référence & inspirations
  const [refCoupe, setRefCoupe] = useState(null);       // coupe de référence du profil
  const [inspirations, setInspirations] = useState([]); // coupes sauvegardées
  const [selectedRef, setSelectedRef] = useState(null); // { id, photo_url } sélectionné
  const [showRefPicker, setShowRefPicker] = useState(false);

  useEffect(() => {
    loadCatalogue();
    computeEta();
    loadClientRef();
  }, [barber.id]);

  async function computeEta() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setEtaLoading(false); return; }

      const [locResult, salonRes] = await Promise.all([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        supabase.from('salons').select('latitude, longitude').eq('id', barber.salon_id).maybeSingle(),
      ]);

      const salon = salonRes.data;
      if (!salon?.latitude || !salon?.longitude) { setEtaLoading(false); return; }

      const distKm = haversineKm(
        locResult.coords.latitude, locResult.coords.longitude,
        salon.latitude, salon.longitude
      );
      setEtaSeconds(etaSecondsFromKm(distKm));
    } catch (_) {
    } finally {
      setEtaLoading(false);
    }
  }

  async function loadClientRef() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: client } = await supabase
      .from('clientes')
      .select('id, reference_cut')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!client) return;

    const promises = [];

    // Coupe de référence du profil
    if (client.reference_cut) {
      promises.push(
        supabase.from('coupes').select('id, photo_url, service').eq('id', client.reference_cut).maybeSingle()
      );
    } else {
      promises.push(Promise.resolve({ data: null }));
    }

    // Inspirations sauvegardées
    promises.push(
      supabase.from('coupe_inspirations').select('coupe_id').eq('client_id', client.id).order('created_at', { ascending: false }).limit(12)
    );

    const [refRes, inspirIdsRes] = await Promise.all(promises);
    if (refRes.data) setRefCoupe(refRes.data);

    const ids = (inspirIdsRes.data || []).map(r => r.coupe_id);
    if (ids.length > 0) {
      const { data: inspirData } = await supabase
        .from('coupes')
        .select('id, photo_url, service')
        .in('id', ids);
      setInspirations(inspirData || []);
    }
  }

  async function loadCatalogue() {
    const salonId = barber.salon_id;
    if (!salonId) { setLoadingCatalogue(false); return; }

    const [catsRes, servicesRes] = await Promise.all([
      supabase.from('service_categories').select('*').eq('salon_id', salonId).order('position'),
      supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('name'),
    ]);

    const cats = catsRes.data || [];
    const services = servicesRes.data || [];

    let grouped;
    if (cats.length > 0) {
      grouped = cats
        .map(cat => ({
          id: cat.id,
          cat: cat.name,
          items: services
            .filter(s => s.category_id === cat.id)
            .map(s => ({ id: s.id, name: s.name, dur: s.duration_minutes, prix: s.price })),
        }))
        .filter(g => g.items.length > 0);
    } else if (services.length > 0) {
      grouped = [{ id: 0, cat: 'Prestations', items: services.map(s => ({ id: s.id, name: s.name, dur: s.duration_minutes, prix: s.price })) }];
    } else {
      grouped = [];
    }

    setCatalogue(grouped);
    setLoadingCatalogue(false);
  }

  function toggleItem(item) {
    setSelected(prev =>
      prev.find(s => s.id === item.id)
        ? prev.filter(s => s.id !== item.id)
        : [...prev, item]
    );
  }

  const totalDur = selected.reduce((a, b) => a + b.dur, 0);
  const totalPrix = selected.reduce((a, b) => a + b.prix, 0);

  async function handleConfirm() {
    // Blocage géographique : ETA > 1h
    if (etaSeconds !== null && etaSeconds > 3600) {
      Alert.alert(
        'Trop loin',
        `Tu es à plus d'1h du salon. Rapproche-toi pour rejoindre la file.`
      );
      return;
    }

    const existing = await checkAnyActiveQueue();
    if (existing && existing.barber_id !== barber.id) {
      // Récupérer le nom du Coiffeuse de l'autre file
      const { data: otherBarber } = await supabase
        .from('coiffeuses').select('name').eq('id', existing.barber_id).maybeSingle();
      const otherName = otherBarber?.name || 'un autre Coiffeuse';
      Alert.alert(
        `Déjà en file chez ${otherName}`,
        `Tu as déjà une place chez ${otherName}. Annule-la pour rejoindre ${barber.name} ?`,
        [
          { text: 'Garder ma place', style: 'cancel' },
          { text: `Rejoindre ${barber.name}`, style: 'destructive', onPress: async () => {
            await leaveQueue(existing.id);
            await proceedJoin();
          }},
        ]
      );
      return;
    }
    await proceedJoin();
  }

  async function proceedJoin() {
    const { success, error, entry } = await joinQueue({
      barberId: barber.id,
      service: selected.map(s => s.name).join(' + '),
      totalPrix,
      totalDur,
      etaSeconds,
      referenceUrl: selectedRef?.photo_url ?? null,
    });

    if (success) {
      navigation.navigate('Queue', { barber, myEntry: entry });
    } else if (error === 'not_authenticated') {
      navigation.navigate('Auth');
    } else if (error === 'already_in_queue') {
      navigation.navigate('Queue', { barber });
    } else if (error === 'outside_hours') {
      Alert.alert(
        'Salon fermé',
        "Ce salon est actuellement fermé. Reviens pendant les heures d'ouverture."
      );
    } else if (error === 'queue_locked') {
      Alert.alert(
        'File verrouillée 🔒',
        `${barber.name} n'accepte plus de nouveaux clients pour l'instant. Reviens plus tard.`
      );
    } else {
      alert('Erreur : ' + error);
    }
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choisir ses prestations</Text>
        <Text style={styles.sub}>File de {barber.name}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}>

        {/* CATALOGUE */}
        {loadingCatalogue ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>Chargement du catalogue...</Text>
          </View>
        ) : catalogue.length === 0 ? (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(28,28,30,0.4)', fontSize: 13 }}>Aucune prestation disponible</Text>
          </View>
        ) : catalogue.map((section) => (
          <View key={section.id}>
            <Text style={styles.catLabel}>{section.cat}</Text>
            {section.items.map((item) => {
              const isSelected = !!selected.find(s => s.id === item.id);
              return (
                <TouchableOpacity key={item.id}
                  onPress={() => toggleItem(item)} activeOpacity={0.85}>
                  <BlurView intensity={55} tint="light"
                    style={[styles.itemCard, isSelected && styles.itemCardSelected]}>
                    <View style={styles.itemLeft}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View>
                        <View style={styles.itemNameRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.pop && (
                            <View style={styles.popBadge}>
                              <Text style={styles.popText}>🔥 Pop</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemDur}>⏱ {item.dur} min</Text>
                      </View>
                    </View>
                    <Text style={[styles.itemPrix, isSelected && styles.itemPrixSelected]}>
                      {item.prix}€
                    </Text>
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* RÉFÉRENCE / INSPIRATION */}
        <TouchableOpacity onPress={() => setShowRefPicker(true)} activeOpacity={0.85}>
          <BlurView intensity={60} tint="light" style={styles.refCard}>
            {selectedRef ? (
              <>
                <Image source={{ uri: selectedRef.photo_url }} style={styles.refThumb} />
                <View style={styles.refLeft}>
                  <Text style={styles.refTitle}>Référence envoyée 🔖</Text>
                  <Text style={styles.refSub} numberOfLines={1}>
                    {selectedRef.service || 'Photo sélectionnée'} · {barber.name} verra ta ref
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedRef(null)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                  <Text style={{ fontSize: 16, color: 'rgba(28,28,30,0.35)' }}>✕</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.refIcon}>🔖</Text>
                <View style={styles.refLeft}>
                  <Text style={styles.refTitle}>Envoyer une référence</Text>
                  <Text style={styles.refSub}>
                    {(refCoupe || inspirations.length > 0)
                      ? 'Partager ta coupe de référence ou une inspiration'
                      : 'Aucune référence dans ton profil'}
                  </Text>
                </View>
                {(refCoupe || inspirations.length > 0) && (
                  <Text style={{ fontSize: 13, color: '#A8852A', fontWeight: '600' }}>Choisir →</Text>
                )}
              </>
            )}
          </BlurView>
        </TouchableOpacity>

      </ScrollView>

      {/* BOTTOM BAR — RÉCAP + CONFIRMER */}
      {selected.length > 0 && (
        <BlurView intensity={70} tint="light" style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomSelected}>
              {selected.length} prestation{selected.length > 1 ? 's' : ''} sélectionnée{selected.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.bottomDetails}>
              {totalDur} min · {totalPrix}€
              {!etaLoading && etaSeconds !== null
                ? `  ·  ETA ~${Math.ceil(etaSeconds / 60)} min`
                : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, etaSeconds !== null && etaSeconds > 3600 && styles.confirmBtnDisabled]}
            onPress={handleConfirm}>
            <Text style={styles.confirmBtnText}>
              {etaSeconds !== null && etaSeconds > 3600 ? 'Trop loin' : 'Rejoindre la file →'}
            </Text>
          </TouchableOpacity>
        </BlurView>
      )}

      {selected.length === 0 && (
        <BlurView intensity={70} tint="light" style={styles.bottomBar}>
          {!etaLoading && etaSeconds !== null && (
            <Text style={[styles.bottomHint, etaSeconds > 3600 && { color: '#C0392B' }]}>
              {etaSeconds > 3600
                ? `Trop loin · ${Math.round(etaSeconds / 60)} min — max 60 min`
                : `Ton ETA : ~${Math.ceil(etaSeconds / 60)} min`}
            </Text>
          )}
          <Text style={styles.bottomHint}>
            Sélectionne au moins une prestation
          </Text>
        </BlurView>
      )}

      {/* MODAL SÉLECTION RÉFÉRENCE */}
      <Modal visible={showRefPicker} transparent animationType="slide" onRequestClose={() => setShowRefPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowRefPicker(false)}>
          <Pressable style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Choisir une référence</Text>

            {refCoupe && (
              <>
                <Text style={styles.pickerSection}>Ma coupe de référence</Text>
                <TouchableOpacity
                  style={[styles.pickerItem, selectedRef?.id === refCoupe.id && styles.pickerItemSelected]}
                  onPress={() => { setSelectedRef(refCoupe); setShowRefPicker(false); }}
                  activeOpacity={0.8}>
                  <Image source={{ uri: refCoupe.photo_url }} style={styles.pickerThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{refCoupe.service || 'Coupe de référence'}</Text>
                    <Text style={styles.pickerItemSub}>Depuis mon profil</Text>
                  </View>
                  {selectedRef?.id === refCoupe.id && <Text style={{ color: '#A8852A', fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              </>
            )}

            {inspirations.length > 0 && (
              <>
                <Text style={styles.pickerSection}>Mes inspirations sauvegardées</Text>
                <FlatList
                  data={inspirations}
                  keyExtractor={i => i.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerItem, selectedRef?.id === item.id && styles.pickerItemSelected]}
                      onPress={() => { setSelectedRef(item); setShowRefPicker(false); }}
                      activeOpacity={0.8}>
                      <Image source={{ uri: item.photo_url }} style={styles.pickerThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemName}>{item.service || 'Inspiration'}</Text>
                        <Text style={styles.pickerItemSub}>Sauvegardée</Text>
                      </View>
                      {selectedRef?.id === item.id && <Text style={{ color: '#A8852A', fontSize: 16 }}>✓</Text>}
                    </TouchableOpacity>
                  )}
                />
              </>
            )}

            {!refCoupe && inspirations.length === 0 && (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: 'rgba(28,28,30,0.4)', textAlign: 'center' }}>
                  Aucune référence dans ton profil.{'\n'}Choisis ta coupe préférée depuis l{"'"}onglet Profil.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#FAF4F8' },
  blob1: { position:'absolute', top:-40, right:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(168,133,42,0.18)' },
  blob2: { position:'absolute', bottom:100, left:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(201,80,122,0.12)' },

  header: { padding:16, paddingTop:12 },
  back: { fontSize:14, color:'#0071E3', marginBottom:8 },
  title: { fontSize:22, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.5 },
  sub: { fontSize:13, color:'rgba(28,28,30,0.5)', marginTop:3 },

  catLabel: { fontSize:12, fontWeight:'700', color:'rgba(28,28,30,0.4)', textTransform:'uppercase', letterSpacing:0.5, paddingHorizontal:16, paddingTop:14, paddingBottom:6 },

  itemCard: { marginHorizontal:16, marginBottom:6, borderRadius:14, overflow:'hidden', padding:13, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  itemCardSelected: { borderColor:'rgba(168,133,42,0.4)', backgroundColor:'rgba(168,133,42,0.06)' },
  itemLeft: { flexDirection:'row', gap:11, alignItems:'center', flex:1 },
  checkbox: { width:24, height:24, borderRadius:8, borderWidth:1.5, borderColor:'rgba(28,28,30,0.2)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  checkboxSelected: { backgroundColor:'#A8852A', borderColor:'#A8852A' },
  checkmark: { fontSize:13, color:'#fff', fontWeight:'700' },
  itemNameRow: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  itemName: { fontSize:14, fontWeight:'600', color:'#1C1C1E' },
  popBadge: { backgroundColor:'rgba(192,57,43,0.1)', borderRadius:20, paddingHorizontal:7, paddingVertical:2, borderWidth:0.5, borderColor:'rgba(192,57,43,0.2)' },
  popText: { fontSize:9, color:'#C0392B', fontWeight:'600' },
  itemDur: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:3 },
  itemPrix: { fontSize:17, fontWeight:'800', color:'rgba(28,28,30,0.4)' },
  itemPrixSelected: { color:'#A8852A' },

  refCard: { marginHorizontal:16, marginTop:10, borderRadius:16, overflow:'hidden', padding:13, flexDirection:'row', alignItems:'center', gap:10, borderWidth:0.5, borderColor:'rgba(168,133,42,0.28)' },
  refLeft: { flex:1 },
  refIcon: { fontSize:22 },
  refTitle: { fontSize:14, fontWeight:'600', color:'#1C1C1E' },
  refSub: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:2 },
  refThumb: { width:44, height:44, borderRadius:10, flexShrink:0 },

  pickerOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  pickerSheet: { backgroundColor:'#FAF4F8', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40, maxHeight:'80%' },
  pickerHandle: { width:36, height:4, borderRadius:2, backgroundColor:'rgba(28,28,30,0.15)', alignSelf:'center', marginBottom:16 },
  pickerTitle: { fontSize:17, fontWeight:'800', color:'#1C1C1E', marginBottom:12 },
  pickerSection: { fontSize:11, fontWeight:'700', color:'rgba(28,28,30,0.4)', textTransform:'uppercase', letterSpacing:0.5, marginTop:10, marginBottom:6 },
  pickerItem: { flexDirection:'row', alignItems:'center', gap:12, padding:10, borderRadius:14, borderWidth:0.5, borderColor:'rgba(28,28,30,0.08)', marginBottom:6, backgroundColor:'rgba(255,255,255,0.7)' },
  pickerItemSelected: { borderColor:'rgba(168,133,42,0.4)', backgroundColor:'rgba(168,133,42,0.06)' },
  pickerThumb: { width:52, height:52, borderRadius:10, flexShrink:0 },
  pickerItemName: { fontSize:13, fontWeight:'600', color:'#1C1C1E' },
  pickerItemSub: { fontSize:11, color:'rgba(28,28,30,0.45)', marginTop:2 },

  bottomBar: { position:'absolute', bottom:0, left:0, right:0, padding:16, paddingBottom:28, overflow:'hidden', borderTopWidth:0.5, borderTopColor:'rgba(255,255,255,0.6)' },
  bottomInfo: { marginBottom:10 },
  bottomSelected: { fontSize:14, fontWeight:'700', color:'#1C1C1E' },
  bottomDetails: { fontSize:12, color:'rgba(28,28,30,0.55)', marginTop:2 },
  confirmBtn: { backgroundColor:'rgba(28,28,30,0.88)', borderRadius:14, padding:15, alignItems:'center' },
  confirmBtnDisabled: { backgroundColor:'rgba(192,57,43,0.75)' },
  confirmBtnText: { fontSize:15, fontWeight:'800', color:'#fff' },
  bottomHint: { fontSize:13, color:'rgba(28,28,30,0.4)', textAlign:'center', paddingVertical:8 },
});
