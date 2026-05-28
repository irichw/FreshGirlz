import { useState, useEffect } from 'react';

import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';

export default function CoiffeuseActionScreen({ navigation }) {
  const [queuePaused, setQueuePaused] = useState(false);
  const [autoTimer, setAutoTimer] = useState(30);

useEffect(() => {
  const countdown = setInterval(() => {
    setAutoTimer(prev => {
      if (prev <= 1) {
        clearInterval(countdown);
        // Auto-passage au client suivant
        handleAutoNext();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(countdown);
}, []);

function handleAutoNext() {
  Alert.alert(
    '⏰ Client suivant automatique',
    'Jordan B. est maintenant le prochain client.',
    [{ text: 'OK' }]
  );
}

  function handleNextClient() {
    Alert.alert(
      'Client suivant ?',
      'Marcus K. sera retiré de la file.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => {
          Alert.alert('✓', 'Jordan B. est maintenant le prochain !');
        }}
      ]
    );
  }

  function handlePause() {
    setQueuePaused(!queuePaused);
    Alert.alert(
      queuePaused ? '▶ File reprise' : '⏸ File en pause',
      queuePaused
        ? 'Les nouveaux clients peuvent rejoindre.'
        : 'Plus aucun nouveau client ne peut rejoindre.'
    );
  }

  function handleClose() {
    Alert.alert(
      '🔒 Fermer la file ?',
      'Tous les clients en attente seront notifiés.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Fermer', style: 'destructive', onPress: () => {
          navigation.goBack();
        }}
      ]
    );
  }

  function handlePhoto() {
    Alert.alert('📸 Photo', 'Fonctionnalité photo disponible après publication.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      {/* HEADER */}
      <View style={styles.autoTimerBar}>
  <View style={[styles.autoTimerFill, {width: `${(autoTimer / 30) * 100}%`}]} />
</View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Actions</Text>
        <Text style={styles.sub}>Coupe de Marcus K. en cours</Text>
      </View>

      {/* CLIENT EN COURS */}
      <BlurView intensity={65} tint="light" style={styles.currentCard}>
        <View style={styles.currentLeft}>
          <View style={styles.currentAv}>
            <Text style={styles.currentAvText}>MK</Text>
          </View>
          <View>
            <Text style={styles.currentName}>Marcus K.</Text>
            <Text style={styles.currentService}>Mid Fade + Design · 4A/4B</Text>
          </View>
        </View>
        <View style={styles.currentTimer}>
          <Text style={styles.currentTimerNum}>18:42</Text>
          <Text style={styles.currentTimerLbl}>en cours</Text>
        </View>
      </BlurView>

      {/* 4 GRANDES ACTIONS */}
      <View style={styles.actionsGrid}>

        {/* CLIENT SUIVANT */}
        <TouchableOpacity style={[styles.actionBtn, styles.actionNext]}
          onPress={handleNextClient} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>→</Text>
          <Text style={[styles.actionTitle, {color:'#7C3D8F'}]}>Client suivant</Text>
          <Text style={[styles.actionSub, {color:'rgba(124,61,143,0.65)'}]}>
            Jordan B. · Combo Fade
          </Text>
        </TouchableOpacity>

        {/* PAUSE FILE */}
        <TouchableOpacity style={[styles.actionBtn,
          queuePaused ? styles.actionResume : styles.actionPause]}
          onPress={handlePause} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>{queuePaused ? '▶' : '⏸'}</Text>
          <Text style={[styles.actionTitle,
            {color: queuePaused ? '#7C3D8F' : '#B06A00'}]}>
            {queuePaused ? 'Reprendre' : 'Pause file'}
          </Text>
          <Text style={[styles.actionSub,
            {color: queuePaused ? 'rgba(124,61,143,0.65)' : 'rgba(176,106,0,0.65)'}]}>
            {queuePaused ? 'Réouvrir aux clients' : 'Bloquer nouveaux clients'}
          </Text>
        </TouchableOpacity>

        {/* PHOTO */}
        <TouchableOpacity style={[styles.actionBtn, styles.actionPhoto]}
          onPress={handlePhoto} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>📸</Text>
          <Text style={[styles.actionTitle, {color:'#6B3FA0'}]}>Photo coupe</Text>
          <Text style={[styles.actionSub, {color:'rgba(107,63,160,0.65)'}]}>
            Book public ou privée
          </Text>
        </TouchableOpacity>

        {/* FERMER FILE */}
        <TouchableOpacity style={[styles.actionBtn, styles.actionClose]}
          onPress={handleClose} activeOpacity={0.85}>
          <Text style={styles.actionIcon}>🔒</Text>
          <Text style={[styles.actionTitle, {color:'#C0392B'}]}>Fermer file</Text>
          <Text style={[styles.actionSub, {color:'rgba(192,57,43,0.65)'}]}>
            Fin de journée
          </Text>
        </TouchableOpacity>

      </View>

      {/* CLIENTS EN ATTENTE */}
      <View style={styles.secRow}>
        <Text style={styles.secTitle}>Clients en attente</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>3</Text>
        </View>
      </View>

      {[
        { ini:'JB', name:'Jordan B.', service:'Combo Fade + Barbe', wait:'~20 min', status:'En route', color:'#B06A00' },
        { ini:'DA', name:'David A.', service:'High Fade · 4C', wait:'~40 min', status:'Confirmé ✓', color:'#7C3D8F' },
        { ini:'OS', name:'Omar S.', service:'Afro Shape', wait:'~60 min', status:'En attente', color:'rgba(28,28,30,0.4)' },
      ].map((client, i) => (
        <BlurView key={i} intensity={55} tint="light" style={styles.clientCard}>
          <View style={styles.clientPos}>
            <Text style={styles.clientPosText}>{i + 2}</Text>
          </View>
          <View style={styles.clientAv}>
            <Text style={styles.clientAvText}>{client.ini}</Text>
          </View>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>{client.name}</Text>
            <Text style={styles.clientService}>{client.service}</Text>
          </View>
          <View style={styles.clientRight}>
            <Text style={[styles.clientWait, {color: client.color}]}>{client.wait}</Text>
            <View style={[styles.clientStatus, {borderColor: client.color + '40', backgroundColor: client.color + '15'}]}>
              <Text style={[styles.clientStatusText, {color: client.color}]}>{client.status}</Text>
            </View>
          </View>
        </BlurView>
      ))}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#F0FAEE' },
  blob1: { position:'absolute', top:-40, left:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(124,61,143,0.2)' },
  blob2: { position:'absolute', top:300, right:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(168,133,42,0.18)' },
  blob3: { position:'absolute', bottom:50, left:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(201,80,122,0.12)' },
autoTimerBar: { height:2, backgroundColor:'rgba(28,28,30,0.06)', marginHorizontal:16, borderRadius:1, marginBottom:10 },
autoTimerFill: { height:'100%', backgroundColor:'rgba(168,133,42,0.4)', borderRadius:1 },
  header: { padding:16, paddingTop:12 },
  back: { fontSize:14, color:'#0071E3', marginBottom:8 },
  title: { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },
  sub: { fontSize:13, color:'rgba(28,28,30,0.5)', marginTop:3 },

  currentCard: { marginHorizontal:16, borderRadius:16, overflow:'hidden', padding:13, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderWidth:0.5, borderColor:'rgba(124,61,143,0.3)', marginBottom:12 },
  currentLeft: { flexDirection:'row', gap:10, alignItems:'center' },
  currentAv: { width:42, height:42, borderRadius:13, backgroundColor:'rgba(168,133,42,0.15)', borderWidth:1.5, borderColor:'rgba(168,133,42,0.35)', alignItems:'center', justifyContent:'center' },
  currentAvText: { fontSize:14, fontWeight:'800', color:'#A8852A' },
  currentName: { fontSize:14, fontWeight:'700', color:'#1C1C1E' },
  currentService: { fontSize:11, color:'rgba(28,28,30,0.55)', marginTop:1 },
  currentTimer: { alignItems:'flex-end' },
  currentTimerNum: { fontSize:20, fontWeight:'800', color:'#7C3D8F' },
  currentTimerLbl: { fontSize:10, color:'rgba(28,28,30,0.45)' },

  actionsGrid: { paddingHorizontal:16, flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12 },
  actionBtn: { width:'47.5%', borderRadius:18, padding:14, borderWidth:0.5 },
  actionNext: { backgroundColor:'rgba(124,61,143,0.12)', borderColor:'rgba(124,61,143,0.3)' },
  actionPause: { backgroundColor:'rgba(176,106,0,0.1)', borderColor:'rgba(176,106,0,0.25)' },
  actionResume: { backgroundColor:'rgba(124,61,143,0.08)', borderColor:'rgba(124,61,143,0.25)' },
  actionPhoto: { backgroundColor:'rgba(107,63,160,0.08)', borderColor:'rgba(107,63,160,0.22)' },
  actionClose: { backgroundColor:'rgba(192,57,43,0.08)', borderColor:'rgba(192,57,43,0.2)' },
  actionIcon: { fontSize:24, marginBottom:7 },
  actionTitle: { fontSize:14, fontWeight:'700' },
  actionSub: { fontSize:11, marginTop:3, lineHeight:15 },

  secRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingBottom:8 },
  secTitle: { fontSize:16, fontWeight:'800', color:'#1C1C1E' },
  liveBadge: { flexDirection:'row', alignItems:'center', gap:5 },
  liveDot: { width:7, height:7, borderRadius:4, backgroundColor:'#7C3D8F' },
  liveText: { fontSize:12, color:'#7C3D8F', fontWeight:'600' },

  clientCard: { marginHorizontal:16, marginBottom:7, borderRadius:14, overflow:'hidden', padding:11, flexDirection:'row', gap:8, alignItems:'center', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  clientPos: { width:24, height:24, borderRadius:8, backgroundColor:'rgba(28,28,30,0.06)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  clientPosText: { fontSize:11, fontWeight:'700', color:'rgba(28,28,30,0.5)' },
  clientAv: { width:32, height:32, borderRadius:9, backgroundColor:'rgba(168,133,42,0.12)', alignItems:'center', justifyContent:'center', flexShrink:0 },
  clientAvText: { fontSize:11, fontWeight:'700', color:'#A8852A' },
  clientInfo: { flex:1 },
  clientName: { fontSize:13, fontWeight:'600', color:'#1C1C1E' },
  clientService: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:1 },
  clientRight: { alignItems:'flex-end', gap:4 },
  clientWait: { fontSize:12, fontWeight:'600' },
  clientStatus: { borderRadius:20, paddingHorizontal:7, paddingVertical:2, borderWidth:0.5 },
  clientStatusText: { fontSize:9, fontWeight:'600' },
});
