import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

const TIME_OPTIONS = [10, 15, 20, 30, 45];

export default function AddClientModal({ navigation, route }) {
  const { barberId, salonId } = route.params || {};
  const [name, setName]                   = useState('');
  const [selectedTime, setSelectedTime]   = useState(20);
  const [services, setServices]           = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [adding, setAdding]               = useState(false);

  useEffect(() => {
    if (salonId) {
      supabase
        .from('services')
        .select('*')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => { if (data) setServices(data); });
    }
  }, [salonId]);

  function selectService(svc) {
    setSelectedService(svc);
    setShowCatalogue(false);
  }

  async function handleAdd() {
    setAdding(true);
    try {
      const { data: last } = await supabase
        .from('queue')
        .select('position')
        .eq('barber_id', barberId)
        .in('status', ['active', 'walkin', 'pending_confirmation', 'in_progress'])
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPos = (last?.position ?? 0) + 1;

      const dur = selectedService ? (selectedService.duration_minutes ?? selectedTime) : selectedTime;
      await supabase.from('queue').insert({
        barber_id:      barberId,
        client_name:    name.trim() || 'Walk-in',
        service:        selectedService?.name || 'Walk-in',
        position:       nextPos,
        status:         'walkin',
        duration:       dur,
        estimated_wait: dur,
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wallpaper}>
        <View style={s.blob1} />
        <View style={s.blob2} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          {/* HEADER */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={s.back}>← Annuler</Text>
            </TouchableOpacity>
            <Text style={s.title}>Ajouter un client</Text>
            <Text style={s.sub}>Ajouté en fin de file</Text>
          </View>

          {/* NOM */}
          <BlurView intensity={60} tint="light" style={s.card}>
            <Text style={s.cardLabel}>
              Nom <Text style={s.optional}>(facultatif)</Text>
            </Text>
            <TextInput
              style={s.input}
              placeholder="Prénom du client..."
              placeholderTextColor="rgba(28,28,30,0.3)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </BlurView>

          {/* TEMPS ESTIMÉ */}
          <BlurView intensity={60} tint="light" style={s.card}>
            <Text style={s.cardLabel}>Temps estimé</Text>
            <View style={s.timeRow}>
              {TIME_OPTIONS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.timeBtn, selectedTime === t && s.timeBtnActive]}
                  onPress={() => setSelectedTime(t)}>
                  <Text style={[s.timeBtnText, selectedTime === t && s.timeBtnTextActive]}>
                    {t} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* CATALOGUE */}
          <BlurView intensity={60} tint="light" style={s.card}>
            <Text style={s.cardLabel}>
              Prestation <Text style={s.optional}>(facultatif)</Text>
            </Text>

            {selectedService ? (
              <View style={s.selectedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedName}>{selectedService.name}</Text>
                  {(selectedService.price || selectedService.duration) ? (
                    <Text style={s.selectedSub}>
                      {selectedService.price ? `${selectedService.price} €` : ''}
                      {selectedService.price && selectedService.duration_minutes ? ' · ' : ''}
                      {selectedService.duration_minutes ? `${selectedService.duration_minutes} min` : ''}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={() => setSelectedService(null)}>
                  <Text style={s.clearBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.catalogueBtn, showCatalogue && s.catalogueBtnOpen]}
                onPress={() => setShowCatalogue(v => !v)}
                activeOpacity={0.7}>
                <Text style={s.catalogueBtnIcon}>🗂</Text>
                <Text style={s.catalogueBtnText}>
                  {showCatalogue ? 'Masquer le catalogue' : 'Choisir depuis le catalogue'}
                </Text>
                <Text style={s.catalogueChevron}>{showCatalogue ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            )}

            {showCatalogue && !selectedService && (
              <View style={s.serviceList}>
                {services.length === 0 ? (
                  <Text style={s.noService}>Aucune prestation configurée</Text>
                ) : services.map(svc => (
                  <TouchableOpacity
                    key={svc.id}
                    style={s.serviceItem}
                    onPress={() => selectService(svc)}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.serviceName}>{svc.name}</Text>
                      {(svc.price || svc.duration) ? (
                        <Text style={s.serviceSub}>
                          {svc.price ? `${svc.price} €` : ''}
                          {svc.price && svc.duration_minutes ? ' · ' : ''}
                          {svc.duration_minutes ? `${svc.duration_minutes} min` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={s.serviceChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </BlurView>

          {/* BOUTON AJOUTER */}
          <TouchableOpacity
            style={[s.addBtn, adding && { opacity: 0.6 }]}
            onPress={handleAdd}
            disabled={adding}
            activeOpacity={0.8}>
            <Text style={s.addBtnText}>
              {adding ? '⏳ Ajout en cours...' : '✓  Ajouter à la file'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1 },
  wallpaper:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#F0FAEE' },
  blob1:    { position:'absolute', top:-40, left:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(124,61,143,0.18)' },
  blob2:    { position:'absolute', bottom:80, right:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(168,133,42,0.14)' },

  header:   { padding:16, paddingTop:20 },
  back:     { fontSize:14, color:'#0071E3', marginBottom:14 },
  title:    { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },
  sub:      { fontSize:13, color:'rgba(28,28,30,0.45)', marginTop:4 },

  card:     { marginHorizontal:16, marginTop:12, borderRadius:18, overflow:'hidden', padding:16, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  cardLabel:{ fontSize:12, fontWeight:'700', color:'rgba(28,28,30,0.5)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12 },
  optional: { fontSize:11, fontWeight:'400', color:'rgba(28,28,30,0.35)', textTransform:'none' },

  input:    { backgroundColor:'rgba(28,28,30,0.05)', borderRadius:13, padding:13, fontSize:15, color:'#1C1C1E', borderWidth:0.5, borderColor:'rgba(28,28,30,0.1)' },

  timeRow:  { flexDirection:'row', gap:8 },
  timeBtn:  { flex:1, height:44, borderRadius:13, backgroundColor:'rgba(255,255,255,0.6)', alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  timeBtnActive: { backgroundColor:'#7C3D8F', borderColor:'#7C3D8F' },
  timeBtnText:   { fontSize:13, fontWeight:'600', color:'rgba(28,28,30,0.5)' },
  timeBtnTextActive: { color:'#fff', fontWeight:'700' },

  catalogueBtn:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(0,113,227,0.07)', borderRadius:13, padding:13, borderWidth:0.5, borderColor:'rgba(0,113,227,0.2)' },
  catalogueBtnOpen: { backgroundColor:'rgba(0,113,227,0.12)', borderColor:'rgba(0,113,227,0.35)' },
  catalogueBtnIcon: { fontSize:18 },
  catalogueBtnText: { flex:1, fontSize:14, fontWeight:'600', color:'#0071E3' },
  catalogueChevron: { fontSize:11, color:'#0071E3' },

  selectedRow:  { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(124,61,143,0.08)', borderRadius:13, padding:13, borderWidth:0.5, borderColor:'rgba(124,61,143,0.25)', gap:10 },
  selectedName: { fontSize:14, fontWeight:'700', color:'#7C3D8F' },
  selectedSub:  { fontSize:12, color:'rgba(124,61,143,0.65)', marginTop:2 },
  clearBtn:     { width:28, height:28, borderRadius:9, backgroundColor:'rgba(28,28,30,0.06)', alignItems:'center', justifyContent:'center' },
  clearBtnText: { fontSize:13, color:'rgba(28,28,30,0.45)' },

  serviceList: { marginTop:10, gap:2 },
  serviceItem: { flexDirection:'row', alignItems:'center', paddingVertical:11, paddingHorizontal:4, borderBottomWidth:0.5, borderBottomColor:'rgba(28,28,30,0.07)' },
  serviceName: { fontSize:14, fontWeight:'600', color:'#1C1C1E' },
  serviceSub:  { fontSize:12, color:'rgba(28,28,30,0.45)', marginTop:2 },
  serviceChevron: { fontSize:20, color:'rgba(28,28,30,0.3)', marginLeft:8 },
  noService:   { fontSize:13, color:'rgba(28,28,30,0.4)', textAlign:'center', paddingVertical:16 },

  addBtn:     { marginHorizontal:16, marginTop:20, backgroundColor:'rgba(124,61,143,0.15)', borderRadius:16, padding:17, alignItems:'center', borderWidth:1, borderColor:'rgba(124,61,143,0.4)' },
  addBtnText: { fontSize:16, fontWeight:'800', color:'#7C3D8F' },
});

