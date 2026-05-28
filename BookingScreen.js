import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';

const UPCOMING = [
  {
    id:1, salon:'King Style Barbershop', barber:'Kevin J.',
    service:'Mid Fade + Design', date:'Mer 28 jan', time:'14h30',
    status:'confirmed', type:'4A/4B', dur:25
  },
  {
    id:2, salon:'Fresh Cutz', barber:'Amed M.',
    service:'Combo Fade + Barbe', date:'Sam 31 jan', time:'11h00',
    status:'pending', type:'4C', dur:40
  },
];

const PAST = [
  {
    id:3, salon:'King Style', barber:'Kevin J.',
    service:'Mid Fade + Design', date:'Mer 21 jan', time:'15h00',
    status:'done', note:5
  },
  {
    id:4, salon:'King Style', barber:'Kevin J.',
    service:'Mid Fade', date:'Mer 7 jan', time:'14h00',
    status:'done', note:5
  },
];

export default function BookingScreen() {
  const [activeTab, setActiveTab] = useState('À venir');

  function statusColor(s) {
    if (s === 'confirmed') return '#7C3D8F';
    if (s === 'pending') return '#B06A00';
    if (s === 'done') return 'rgba(28,28,30,0.4)';
    return '#0071E3';
  }

  function statusLabel(s) {
    if (s === 'confirmed') return '✓ Confirmé';
    if (s === 'pending') return '⏳ En attente';
    if (s === 'done') return '✓ Terminé';
    return 'À confirmer';
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes RDV</Text>
          <TouchableOpacity style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Réserver</Text>
          </TouchableOpacity>
        </View>

        {/* PROCHAIN RDV — HERO */}
        <BlurView intensity={65} tint="light" style={styles.nextCard}>
          <View style={styles.nextTop}>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>📅 Prochain RDV</Text>
            </View>
            <View style={styles.nextStatus}>
              <Text style={styles.nextStatusText}>✓ Confirmé</Text>
            </View>
          </View>
          <Text style={styles.nextSalon}>King Style Barbershop</Text>
          <Text style={styles.nextService}>Mid Fade + Design · Kevin J.</Text>
          <View style={styles.nextDateRow}>
            <View style={styles.nextDateCard}>
              <Text style={styles.nextDateNum}>28</Text>
              <Text style={styles.nextDateMois}>JAN</Text>
            </View>
            <View style={styles.nextDateInfo}>
              <Text style={styles.nextDateDay}>Mercredi</Text>
              <Text style={styles.nextDateTime}>14h30 · ~25 min</Text>
              <Text style={styles.nextDateAddr}>12 rue des Arts · Paris 18e</Text>
            </View>
          </View>
          <View style={styles.nextActions}>
            <TouchableOpacity style={styles.nextBtnCancel}>
              <Text style={styles.nextBtnCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtnMaps}>
              <Text style={styles.nextBtnMapsText}>📍 Maps →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtnReport}>
              <Text style={styles.nextBtnReportText}>Reporter</Text>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* TABS */}
        <BlurView intensity={40} tint="light" style={styles.tabs}>
          {['À venir','Passés'].map((t) => (
            <TouchableOpacity key={t} style={styles.tab}
              onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabText, activeTab===t && styles.tabActive]}>{t}</Text>
              {activeTab===t && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </BlurView>

        {/* LISTE À VENIR */}
        {activeTab === 'À venir' && (
          <View>
            {UPCOMING.map((rdv) => (
              <BlurView key={rdv.id} intensity={58} tint="light" style={styles.rdvCard}>
                <View style={styles.rdvLeft}>
                  <View style={styles.rdvDateBox}>
                    <Text style={styles.rdvDateNum}>
                      {rdv.date.split(' ')[1]}
                    </Text>
                    <Text style={styles.rdvDateMois}>
                      {rdv.date.split(' ')[2].toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.rdvInfo}>
                  <Text style={styles.rdvSalon}>{rdv.salon}</Text>
                  <Text style={styles.rdvService}>{rdv.service}</Text>
                  <Text style={styles.rdvMeta}>
                    {rdv.barber} · {rdv.time} · {rdv.dur} min
                  </Text>
                  <View style={styles.rdvTags}>
                    <View style={styles.rdvTag}>
                      <Text style={styles.rdvTagText}>{rdv.type}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.rdvRight}>
                  <View style={[styles.rdvStatus,
                    {backgroundColor: statusColor(rdv.status)+'15',
                     borderColor: statusColor(rdv.status)+'30'}]}>
                    <Text style={[styles.rdvStatusText,
                      {color: statusColor(rdv.status)}]}>
                      {statusLabel(rdv.status)}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.rdvMoreBtn}>
                    <Text style={styles.rdvMoreText}>···</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            ))}

            {/* SUGGÉRER UN RDV */}
            <BlurView intensity={50} tint="light" style={styles.suggestCard}>
              <Text style={styles.suggestEmoji}>💡</Text>
              <View style={styles.suggestInfo}>
                <Text style={styles.suggestTitle}>Prochaine coupe dans 21 jours</Text>
                <Text style={styles.suggestSub}>Avec Kevin J. · King Style</Text>
              </View>
              <TouchableOpacity style={styles.suggestBtn}>
                <Text style={styles.suggestBtnText}>Réserver →</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {/* LISTE PASSÉS */}
        {activeTab === 'Passés' && (
          <View>
            {PAST.map((rdv) => (
              <BlurView key={rdv.id} intensity={55} tint="light"
                style={[styles.rdvCard, {opacity:0.75}]}>
                <View style={styles.rdvLeft}>
                  <View style={[styles.rdvDateBox, {backgroundColor:'rgba(28,28,30,0.06)'}]}>
                    <Text style={[styles.rdvDateNum, {color:'rgba(28,28,30,0.5)'}]}>
                      {rdv.date.split(' ')[1]}
                    </Text>
                    <Text style={[styles.rdvDateMois, {color:'rgba(28,28,30,0.4)'}]}>
                      {rdv.date.split(' ')[2].toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.rdvInfo}>
                  <Text style={styles.rdvSalon}>{rdv.salon}</Text>
                  <Text style={styles.rdvService}>{rdv.service}</Text>
                  <Text style={styles.rdvMeta}>{rdv.barber} · {rdv.time}</Text>
                  <Text style={styles.rdvNote}>
                    {'★'.repeat(rdv.note)}{'☆'.repeat(5-rdv.note)}
                  </Text>
                </View>
                <View style={styles.rdvRight}>
                  <View style={[styles.rdvStatus,
                    {backgroundColor:'rgba(28,28,30,0.06)',
                     borderColor:'rgba(28,28,30,0.1)'}]}>
                    <Text style={[styles.rdvStatusText,
                      {color:'rgba(28,28,30,0.4)'}]}>
                      Terminé
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.rdvRebookBtn}>
                    <Text style={styles.rdvRebookText}>Rebooker</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#EEF8FF' },
  blob1: { position:'absolute', top:-40, right:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(0,113,227,0.12)' },
  blob2: { position:'absolute', top:350, left:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(168,133,42,0.15)' },
  blob3: { position:'absolute', bottom:100, right:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(124,61,143,0.12)' },

  // HEADER
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:12 },
  headerTitle: { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },
  addBtn: { backgroundColor:'rgba(28,28,30,0.88)', borderRadius:12, paddingHorizontal:14, paddingVertical:8 },
  addBtnText: { fontSize:13, fontWeight:'700', color:'#fff' },

  // NEXT CARD
  nextCard: { marginHorizontal:16, borderRadius:20, overflow:'hidden', padding:16, borderWidth:0.5, borderColor:'rgba(124,61,143,0.3)', marginBottom:12 },
  nextTop: { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  nextBadge: { backgroundColor:'rgba(0,113,227,0.1)', borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:0.5, borderColor:'rgba(0,113,227,0.25)' },
  nextBadgeText: { fontSize:11, fontWeight:'600', color:'#0071E3' },
  nextStatus: { backgroundColor:'rgba(124,61,143,0.12)', borderRadius:20, paddingHorizontal:10, paddingVertical:4, borderWidth:0.5, borderColor:'rgba(124,61,143,0.28)' },
  nextStatusText: { fontSize:11, fontWeight:'600', color:'#7C3D8F' },
  nextSalon: { fontSize:17, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.3 },
  nextService: { fontSize:13, color:'rgba(28,28,30,0.55)', marginTop:2, marginBottom:12 },
  nextDateRow: { flexDirection:'row', gap:14, alignItems:'center', marginBottom:14 },
  nextDateCard: { width:54, height:54, borderRadius:16, backgroundColor:'rgba(168,133,42,0.15)', borderWidth:1.5, borderColor:'rgba(168,133,42,0.35)', alignItems:'center', justifyContent:'center' },
  nextDateNum: { fontSize:20, fontWeight:'800', color:'#A8852A', lineHeight:22 },
  nextDateMois: { fontSize:9, fontWeight:'700', color:'rgba(168,133,42,0.7)', letterSpacing:0.5 },
  nextDateInfo: { flex:1 },
  nextDateDay: { fontSize:15, fontWeight:'700', color:'#1C1C1E' },
  nextDateTime: { fontSize:13, color:'rgba(28,28,30,0.6)', marginTop:2 },
  nextDateAddr: { fontSize:11, color:'rgba(28,28,30,0.45)', marginTop:2 },
  nextActions: { flexDirection:'row', gap:7 },
  nextBtnCancel: { flex:1, backgroundColor:'rgba(192,57,43,0.08)', borderRadius:12, padding:10, alignItems:'center', borderWidth:0.5, borderColor:'rgba(192,57,43,0.2)' },
  nextBtnCancelText: { fontSize:12, fontWeight:'600', color:'#C0392B' },
  nextBtnMaps: { flex:1, backgroundColor:'rgba(0,113,227,0.1)', borderRadius:12, padding:10, alignItems:'center', borderWidth:0.5, borderColor:'rgba(0,113,227,0.22)' },
  nextBtnMapsText: { fontSize:12, fontWeight:'600', color:'#0071E3' },
  nextBtnReport: { flex:1, backgroundColor:'rgba(255,255,255,0.55)', borderRadius:12, padding:10, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  nextBtnReportText: { fontSize:12, fontWeight:'600', color:'rgba(28,28,30,0.6)' },

  // TABS
  tabs: { flexDirection:'row', overflow:'hidden', borderBottomWidth:0.5, borderBottomColor:'rgba(255,255,255,0.5)', marginBottom:4 },
  tab: { flex:1, paddingVertical:10, alignItems:'center', position:'relative' },
  tabText: { fontSize:13, fontWeight:'600', color:'rgba(28,28,30,0.5)' },
  tabActive: { color:'#A8852A' },
  tabLine: { position:'absolute', bottom:0, width:'60%', height:2, backgroundColor:'#A8852A', borderRadius:1 },

  // RDV CARDS
  rdvCard: { marginHorizontal:16, marginBottom:8, borderRadius:16, overflow:'hidden', padding:12, flexDirection:'row', gap:11, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  rdvLeft: { flexShrink:0 },
  rdvDateBox: { width:46, height:46, borderRadius:13, backgroundColor:'rgba(168,133,42,0.12)', borderWidth:1, borderColor:'rgba(168,133,42,0.28)', alignItems:'center', justifyContent:'center' },
  rdvDateNum: { fontSize:17, fontWeight:'800', color:'#A8852A', lineHeight:19 },
  rdvDateMois: { fontSize:8, fontWeight:'700', color:'rgba(168,133,42,0.7)', letterSpacing:0.3 },
  rdvInfo: { flex:1 },
  rdvSalon: { fontSize:13, fontWeight:'700', color:'#1C1C1E' },
  rdvService: { fontSize:12, color:'rgba(28,28,30,0.65)', marginTop:1 },
  rdvMeta: { fontSize:11, color:'rgba(28,28,30,0.45)', marginTop:2 },
  rdvTags: { flexDirection:'row', gap:5, marginTop:5 },
  rdvTag: { backgroundColor:'rgba(168,133,42,0.1)', borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  rdvTagText: { fontSize:9, color:'#A8852A', fontWeight:'600' },
  rdvNote: { fontSize:11, color:'#A8852A', marginTop:4 },
  rdvRight: { alignItems:'flex-end', gap:6, justifyContent:'space-between' },
  rdvStatus: { borderRadius:20, paddingHorizontal:8, paddingVertical:3, borderWidth:0.5 },
  rdvStatusText: { fontSize:10, fontWeight:'600' },
  rdvMoreBtn: { padding:4 },
  rdvMoreText: { fontSize:16, color:'rgba(28,28,30,0.35)', letterSpacing:1 },
  rdvRebookBtn: { backgroundColor:'rgba(168,133,42,0.12)', borderRadius:9, paddingHorizontal:9, paddingVertical:4, borderWidth:0.5, borderColor:'rgba(168,133,42,0.25)' },
  rdvRebookText: { fontSize:10, color:'#A8852A', fontWeight:'600' },

  // SUGGEST
  suggestCard: { marginHorizontal:16, marginTop:4, borderRadius:15, overflow:'hidden', padding:12, flexDirection:'row', alignItems:'center', gap:10, borderWidth:0.5, borderColor:'rgba(168,133,42,0.25)' },
  suggestEmoji: { fontSize:20 },
  suggestInfo: { flex:1 },
  suggestTitle: { fontSize:13, fontWeight:'600', color:'#1C1C1E' },
  suggestSub: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:2 },
  suggestBtn: { backgroundColor:'rgba(28,28,30,0.88)', borderRadius:11, paddingHorizontal:12, paddingVertical:7 },
  suggestBtnText: { fontSize:12, fontWeight:'700', color:'#fff' },
});
