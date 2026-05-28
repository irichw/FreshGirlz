import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput, ScrollView, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function OpenQueueModal({ navigation, route }) {
  const barber = route.params?.barber || { name:'Kevin J.', id:null };
  const [count, setCount] = useState(0);
  const [names, setNames] = useState(['','','','','']);
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      // 1 — Ouvrir la file du Coiffeuse + le salon
      if (barber.id) {
        await supabase
          .from('coiffeuses')
          .update({ is_available: true })
          .eq('id', barber.id);
      }
      if (barber.salonId) {
        await supabase
          .from('salons')
          .update({ is_open: true })
          .eq('id', barber.salonId);
      }

      // 2 — Insérer les walk-ins dans la file
      for (let i = 0; i < count; i++) {
        const clientName = names[i].trim() || `Walk-in #${i + 1}`;
        if (barber.id) {
          await supabase.from('queue').insert({
            barber_id: barber.id,
            client_name: clientName,
            service: 'Walk-in',
            position: i + 1,
            status: 'walkin',
            estimated_wait: i * 25,
          });
        }
      }

      Alert.alert(
        '✓ File ouverte !',
        `${count > 0 ? count + ' walk-in(s) ajouté(s).' : 'Aucun walk-in.'}\nLes clients peuvent maintenant rejoindre.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setOpening(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ouvrir la file</Text>
          <Text style={styles.sub}>Combien de personnes sont déjà présentes ?</Text>
        </View>

        {/* SÉLECTEUR */}
        <BlurView intensity={60} tint="light" style={styles.countCard}>
          <Text style={styles.countLabel}>Personnes présentes</Text>
          <View style={styles.countRow}>
            {[0,1,2,3,4,5].map((n) => (
              <TouchableOpacity key={n}
                style={[styles.countBtn, count === n && styles.countBtnActive]}
                onPress={() => setCount(n)}>
                <Text style={[styles.countBtnText, count === n && styles.countBtnTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>

        {/* PRÉNOMS OPTIONNELS */}
        {count > 0 && (
          <BlurView intensity={60} tint="light" style={styles.namesCard}>
            <Text style={styles.namesTitle}>
              Prénoms <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            <Text style={styles.namesSub}>
              Si vide → "Walk-in #1", "Walk-in #2"...
            </Text>
            {Array.from({ length: count }).map((_, i) => (
              <View key={i} style={styles.nameRow}>
                <View style={styles.nameNum}>
                  <Text style={styles.nameNumText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={styles.nameInput}
                  placeholder={`Walk-in #${i + 1}`}
                  placeholderTextColor="rgba(28,28,30,0.3)"
                  value={names[i]}
                  onChangeText={(val) => {
                    const newNames = [...names];
                    newNames[i] = val;
                    setNames(newNames);
                  }}
                  autoCapitalize="words"
                />
              </View>
            ))}
          </BlurView>
        )}

        {/* RÉCAP */}
        <BlurView intensity={55} tint="light" style={styles.recapCard}>
          <Text style={styles.recapTitle}>Résumé</Text>
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel}>Coiffeuse</Text>
            <Text style={styles.recapValue}>{barber.name}</Text>
          </View>
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel}>Walk-ins présents</Text>
            <Text style={[styles.recapValue, {color:'#A8852A'}]}>{count}</Text>
          </View>
          <View style={styles.recapRow}>
            <Text style={styles.recapLabel}>Attente estimée</Text>
            <Text style={styles.recapValue}>~{count * 25} min</Text>
          </View>
        </BlurView>

        {/* BOUTON OUVRIR */}
        <TouchableOpacity style={styles.openBtn}
          onPress={handleOpen} disabled={opening}>
          <Text style={styles.openBtnText}>
            {opening ? '⏳ Ouverture...' : '● Ouvrir la file maintenant'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#F0FAEE' },
  blob1: { position:'absolute', top:-40, left:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(124,61,143,0.2)' },
  blob2: { position:'absolute', bottom:100, right:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(168,133,42,0.15)' },

  header: { padding:16, paddingTop:20 },
  back: { fontSize:14, color:'#0071E3', marginBottom:12 },
  title: { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },
  sub: { fontSize:14, color:'rgba(28,28,30,0.55)', marginTop:5 },

  countCard: { marginHorizontal:16, marginTop:14, borderRadius:18, overflow:'hidden', padding:16, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  countLabel: { fontSize:13, fontWeight:'600', color:'rgba(28,28,30,0.5)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:12 },
  countRow: { flexDirection:'row', gap:8 },
  countBtn: { flex:1, height:44, borderRadius:13, backgroundColor:'rgba(255,255,255,0.6)', alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  countBtnActive: { backgroundColor:'#7C3D8F', borderColor:'#7C3D8F' },
  countBtnText: { fontSize:18, fontWeight:'700', color:'rgba(28,28,30,0.5)' },
  countBtnTextActive: { color:'#fff' },

  namesCard: { marginHorizontal:16, marginTop:10, borderRadius:18, overflow:'hidden', padding:16, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  namesTitle: { fontSize:15, fontWeight:'700', color:'#1C1C1E', marginBottom:4 },
  optional: { fontSize:13, fontWeight:'400', color:'rgba(28,28,30,0.4)' },
  namesSub: { fontSize:12, color:'rgba(28,28,30,0.45)', marginBottom:12 },
  nameRow: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:8 },
  nameNum: { width:28, height:28, borderRadius:9, backgroundColor:'rgba(168,133,42,0.12)', borderWidth:1, borderColor:'rgba(168,133,42,0.28)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  nameNumText: { fontSize:12, fontWeight:'700', color:'#A8852A' },
  nameInput: { flex:1, backgroundColor:'rgba(28,28,30,0.05)', borderRadius:12, padding:11, fontSize:14, color:'#1C1C1E', borderWidth:0.5, borderColor:'rgba(28,28,30,0.1)' },

  recapCard: { marginHorizontal:16, marginTop:10, borderRadius:16, overflow:'hidden', padding:14, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  recapTitle: { fontSize:13, fontWeight:'700', color:'rgba(28,28,30,0.45)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:10 },
  recapRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:7 },
  recapLabel: { fontSize:13, color:'rgba(28,28,30,0.55)' },
  recapValue: { fontSize:13, fontWeight:'600', color:'#1C1C1E' },

  openBtn: { marginHorizontal:16, marginTop:16, backgroundColor:'rgba(124,61,143,0.18)', borderRadius:16, padding:16, alignItems:'center', borderWidth:1, borderColor:'rgba(124,61,143,0.4)' },
  openBtnText: { fontSize:16, fontWeight:'800', color:'#7C3D8F' },
});
