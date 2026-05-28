import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';

const SERVICES = [
  { name:'Mid Fade + Design', count:14, pct:0.85 },
  { name:'Combo Fade + Barbe', count:10, pct:0.65 },
  { name:'High Fade Skin', count:7, pct:0.45 },
  { name:'Afro Shape', count:3, pct:0.2 },
];

const WEEK_DATA = [40, 55, 70, 45, 85, 60, 100];
const WEEK_LABELS = ['L','M','M','J','V','S','D'];

export default function StatsScreen() {
  const [period, setPeriod] = useState('Semaine');

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
          <Text style={styles.headerTitle}>Statistiques</Text>
        </View>

        {/* PÉRIODE */}
        <View style={styles.periodRow}>
          {['Jour','Semaine','Mois'].map((p) => (
            <TouchableOpacity key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}>
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* BIG STAT */}
        <BlurView intensity={65} tint="light" style={styles.bigStat}>
          <View style={styles.bigStatLeft}>
            <Text style={styles.bigStatLabel}>Clients cette {period.toLowerCase()}</Text>
            <Text style={styles.bigStatNum}>34</Text>
            <View style={styles.bigStatTrend}>
              <Text style={styles.trendUp}>↑ +6</Text>
              <Text style={styles.trendLabel}> vs {period.toLowerCase()} dernière</Text>
            </View>
          </View>

          {/* MINI BAR CHART */}
          <View style={styles.chart}>
            {WEEK_DATA.map((val, i) => (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.bar, {height: `${val}%`},
                  i === 6 && styles.barActive]} />
                <Text style={styles.barLabel}>{WEEK_LABELS[i]}</Text>
              </View>
            ))}
          </View>
        </BlurView>

        {/* KPIs GRID */}
        <View style={styles.kpiGrid}>
          {[
            { num:'4.9 ★', lbl:'Note moyenne', color:'#A8852A', sub:'Sur 284 avis' },
            { num:'96%', lbl:'Taux présence', color:'#7C3D8F', sub:'Confirmations' },
            { num:"23'", lbl:'Durée moy.', color:'#1C1C1E', sub:'Par coupe' },
            { num:'78%', lbl:'Clients fidèles', color:'#B06A00', sub:'Reviennent' },
          ].map((k) => (
            <BlurView key={k.lbl} intensity={55} tint="light" style={styles.kpiCard}>
              <Text style={[styles.kpiNum, {color: k.color}]}>{k.num}</Text>
              <Text style={styles.kpiLbl}>{k.lbl}</Text>
              <Text style={styles.kpiSub}>{k.sub}</Text>
            </BlurView>
          ))}
        </View>

        {/* TOP SERVICES */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Top prestations</Text>
          <Text style={styles.secSub}>Cette {period.toLowerCase()}</Text>
        </View>

        <BlurView intensity={60} tint="light" style={styles.servicesCard}>
          {SERVICES.map((s, i) => (
            <View key={s.name} style={[styles.serviceRow,
              i < SERVICES.length - 1 && styles.serviceRowBorder]}>
              <View style={styles.serviceLeft}>
                <View style={styles.serviceRank}>
                  <Text style={styles.serviceRankText}>{i + 1}</Text>
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{s.name}</Text>
                  <View style={styles.serviceBar}>
                    <View style={[styles.serviceBarFill, {width: `${s.pct * 100}%`}]} />
                  </View>
                </View>
              </View>
              <Text style={styles.serviceCount}>{s.count}x</Text>
            </View>
          ))}
        </BlurView>

        {/* HEURES DE POINTE */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Heures de pointe</Text>
        </View>

        <BlurView intensity={60} tint="light" style={styles.hoursCard}>
          <View style={styles.hoursChart}>
            {[
              { h:'10h', val:0.3 },
              { h:'11h', val:0.7 },
              { h:'12h', val:0.4 },
              { h:'13h', val:0.2 },
              { h:'14h', val:0.8 },
              { h:'15h', val:1.0 },
              { h:'16h', val:0.6 },
              { h:'17h', val:0.5 },
              { h:'18h', val:0.9 },
              { h:'19h', val:0.3 },
            ].map((h) => (
              <View key={h.h} style={styles.hourCol}>
                <View style={styles.hourBarWrap}>
                  <View style={[styles.hourBar, {height: `${h.val * 100}%`},
                    h.val >= 0.8 && styles.hourBarHot]} />
                </View>
                <Text style={styles.hourLabel}>{h.h}</Text>
              </View>
            ))}
          </View>
          <View style={styles.hoursLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor:'#A8852A'}]} />
              <Text style={styles.legendText}>Chargé</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, {backgroundColor:'rgba(28,28,30,0.15)'}]} />
              <Text style={styles.legendText}>Calme</Text>
            </View>
          </View>
        </BlurView>

        {/* PROFIL CLIENTS */}
        <View style={styles.secRow}>
          <Text style={styles.secTitle}>Profil de ta clientèle</Text>
        </View>

        <View style={styles.profileGrid}>
          {[
            { label:'Types de cheveux', items:[
              { name:'4A/4B', pct:'42%' },
              { name:'4C', pct:'35%' },
              { name:'3C/4A', pct:'23%' },
            ]},
            { label:'Tranches d\'âge', items:[
              { name:'18–25 ans', pct:'38%' },
              { name:'26–35 ans', pct:'45%' },
              { name:'35+ ans', pct:'17%' },
            ]},
          ].map((section) => (
            <BlurView key={section.label} intensity={55} tint="light" style={styles.profileCard}>
              <Text style={styles.profileLabel}>{section.label}</Text>
              {section.items.map((item) => (
                <View key={item.name} style={styles.profileItem}>
                  <Text style={styles.profileItemName}>{item.name}</Text>
                  <View style={styles.profileBarWrap}>
                    <View style={[styles.profileBar,
                      {width: item.pct}]} />
                  </View>
                  <Text style={styles.profileItemPct}>{item.pct}</Text>
                </View>
              ))}
            </BlurView>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#FAF4F8' },
  blob1: { position:'absolute', top:-40, right:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(168,133,42,0.18)' },
  blob2: { position:'absolute', top:400, left:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(201,80,122,0.12)' },
  blob3: { position:'absolute', bottom:100, right:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(124,61,143,0.12)' },

  header: { padding:16, paddingTop:12 },
  headerTitle: { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },

  // PÉRIODE
  periodRow: { paddingHorizontal:16, flexDirection:'row', gap:6, marginBottom:12 },
  periodBtn: { flex:1, padding:8, borderRadius:11, backgroundColor:'rgba(255,255,255,0.55)', alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  periodBtnActive: { backgroundColor:'#A8852A', borderColor:'#A8852A' },
  periodText: { fontSize:13, fontWeight:'600', color:'rgba(28,28,30,0.55)' },
  periodTextActive: { color:'#fff' },

  // BIG STAT
  bigStat: { marginHorizontal:16, borderRadius:18, overflow:'hidden', padding:16, flexDirection:'row', alignItems:'flex-end', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)', marginBottom:10 },
  bigStatLeft: { flex:1 },
  bigStatLabel: { fontSize:11, color:'rgba(28,28,30,0.5)', textTransform:'uppercase', letterSpacing:0.5 },
  bigStatNum: { fontSize:40, fontWeight:'800', color:'#1C1C1E', letterSpacing:-2, lineHeight:44, marginTop:4 },
  bigStatTrend: { flexDirection:'row', alignItems:'center', marginTop:5 },
  trendUp: { fontSize:13, fontWeight:'700', color:'#7C3D8F' },
  trendLabel: { fontSize:12, color:'rgba(28,28,30,0.5)' },
  chart: { flexDirection:'row', alignItems:'flex-end', gap:4, height:60, width:120 },
  barWrap: { flex:1, alignItems:'center', height:'100%', justifyContent:'flex-end' },
  bar: { width:'100%', backgroundColor:'rgba(168,133,42,0.2)', borderRadius:3 },
  barActive: { backgroundColor:'#A8852A' },
  barLabel: { fontSize:8, color:'rgba(28,28,30,0.35)', marginTop:3 },

  // KPIs
  kpiGrid: { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:7, marginBottom:4 },
  kpiCard: { width:'47.5%', borderRadius:14, overflow:'hidden', padding:12, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  kpiNum: { fontSize:22, fontWeight:'800' },
  kpiLbl: { fontSize:12, fontWeight:'600', color:'#1C1C1E', marginTop:4 },
  kpiSub: { fontSize:10, color:'rgba(28,28,30,0.45)', marginTop:2 },

  // SECTION
  secRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingTop:14, paddingBottom:8 },
  secTitle: { fontSize:17, fontWeight:'800', color:'#1C1C1E' },
  secSub: { fontSize:12, color:'rgba(28,28,30,0.45)' },

  // SERVICES
  servicesCard: { marginHorizontal:16, borderRadius:18, overflow:'hidden', padding:4, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  serviceRow: { flexDirection:'row', alignItems:'center', padding:11, gap:10 },
  serviceRowBorder: { borderBottomWidth:0.5, borderBottomColor:'rgba(255,255,255,0.6)' },
  serviceLeft: { flex:1, flexDirection:'row', gap:10, alignItems:'center' },
  serviceRank: { width:24, height:24, borderRadius:8, backgroundColor:'rgba(28,28,30,0.88)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  serviceRankText: { fontSize:11, fontWeight:'700', color:'#fff' },
  serviceInfo: { flex:1 },
  serviceName: { fontSize:13, fontWeight:'600', color:'#1C1C1E', marginBottom:5 },
  serviceBar: { height:4, backgroundColor:'rgba(28,28,30,0.08)', borderRadius:2, overflow:'hidden' },
  serviceBarFill: { height:'100%', backgroundColor:'#A8852A', borderRadius:2 },
  serviceCount: { fontSize:15, fontWeight:'800', color:'#A8852A', flexShrink:0 },

  // HEURES
  hoursCard: { marginHorizontal:16, borderRadius:18, overflow:'hidden', padding:14, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  hoursChart: { flexDirection:'row', alignItems:'flex-end', height:70, gap:5, marginBottom:8 },
  hourCol: { flex:1, alignItems:'center', height:'100%', justifyContent:'flex-end' },
  hourBarWrap: { width:'100%', height:'85%', justifyContent:'flex-end' },
  hourBar: { width:'100%', backgroundColor:'rgba(168,133,42,0.2)', borderRadius:3 },
  hourBarHot: { backgroundColor:'#A8852A' },
  hourLabel: { fontSize:8, color:'rgba(28,28,30,0.4)', marginTop:4 },
  hoursLegend: { flexDirection:'row', gap:16, justifyContent:'flex-end' },
  legendItem: { flexDirection:'row', alignItems:'center', gap:5 },
  legendDot: { width:8, height:8, borderRadius:4 },
  legendText: { fontSize:11, color:'rgba(28,28,30,0.5)' },

  // PROFIL
  profileGrid: { paddingHorizontal:16, flexDirection:'row', gap:8, marginBottom:10 },
  profileCard: { flex:1, borderRadius:16, overflow:'hidden', padding:12, borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  profileLabel: { fontSize:11, fontWeight:'700', color:'rgba(28,28,30,0.45)', textTransform:'uppercase', letterSpacing:0.4, marginBottom:10 },
  profileItem: { flexDirection:'row', alignItems:'center', gap:5, marginBottom:8 },
  profileItemName: { fontSize:11, color:'#1C1C1E', width:50, flexShrink:0 },
  profileBarWrap: { flex:1, height:5, backgroundColor:'rgba(28,28,30,0.08)', borderRadius:3, overflow:'hidden' },
  profileBar: { height:'100%', backgroundColor:'#A8852A', borderRadius:3 },
  profileItemPct: { fontSize:11, fontWeight:'600', color:'#A8852A', width:32, textAlign:'right', flexShrink:0 },
});
