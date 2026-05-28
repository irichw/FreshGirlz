import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar
} from 'react-native';

export default function SalonScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── HERO ── */}
        <View style={styles.hero}>
          <View style={styles.heroBg}>
            <Text style={styles.heroBgEmoji}>✂</Text>
          </View>
          <View style={styles.heroOverlay} />
          <View style={styles.heroTopNav}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn}>
              <Text style={styles.shareBtnText}>⬆</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroLogo}>
              <Text style={styles.heroLogoText}>KS</Text>
            </View>
            <View>
              <Text style={styles.heroName}>King Style Barbershop</Text>
              <Text style={styles.heroAddr}>12 rue des Arts · Paris 18e</Text>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>● Ouvert jusqu'à 19h30</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── SCORES ── */}
        <View style={styles.scoresRow}>
          {[
            { num: '4.9', lbl: '★ Note' },
            { num: '284', lbl: 'Avis' },
            { num: '3', lbl: 'Barbiers' },
            { num: "~8'", lbl: 'Attente' },
          ].map((s) => (
            <View key={s.lbl} style={styles.scoreCell}>
              <Text style={styles.scoreNum}>{s.num}</Text>
              <Text style={styles.scoreLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* ── TABS ── */}
        <View style={styles.tabs}>
          {['Book', 'Catalogue', 'Équipe', 'Avis'].map((t, i) => (
            <TouchableOpacity key={t} style={styles.tab}>
              <Text style={[styles.tabText, i === 0 && styles.tabTextActive]}>
                {t}
              </Text>
              {i === 0 && <View style={styles.tabLine} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── BOOK PHOTOS ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📸 Coupes récentes</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Tout voir</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.photosGrid}>
          <View style={[styles.photoMain, { backgroundColor: '#3A1A06' }]}>
            <Text style={styles.photoEmoji}>✂</Text>
            <View style={styles.photoOverlay} />
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>🔥 Top</Text>
            </View>
            <View style={styles.photoCaption}>
              <Text style={styles.photoCaptionTitle}>Mid Fade + Design</Text>
              <Text style={styles.photoCaptionSub}>Kevin J. · 28 jan</Text>
            </View>
          </View>
          <View style={styles.photoCol}>
            <View style={[styles.photoSmall, { backgroundColor: '#0A1A0A' }]}>
              <Text style={styles.photoEmoji}>💈</Text>
            </View>
            <View style={[styles.photoSmall, { backgroundColor: '#0A0A1A' }]}>
              <Text style={styles.photoEmoji}>🌀</Text>
            </View>
          </View>
        </View>

        {/* ── FILE EN DIRECT ── */}
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <View style={styles.queueLive}>
              <View style={styles.liveDot} />
              <Text style={styles.queueLiveText}>File en direct</Text>
            </View>
            <Text style={styles.queueWait}>~8 min</Text>
          </View>
          <View style={styles.queueSlots}>
            {[
              { num: '1', label: 'En cours...', time: '', active: false },
              { num: '2', label: 'Toi', time: '~8 min', active: true },
              { num: '3', label: '—', time: '~25min', active: false },
            ].map((slot) => (
              <View key={slot.num} style={styles.queueSlot}>
                <View style={[styles.slotNum, slot.active && styles.slotNumActive]}>
                  <Text style={[styles.slotNumText, slot.active && styles.slotNumTextActive]}>
                    {slot.num}
                  </Text>
                </View>
                <Text style={[styles.slotLabel, slot.active && styles.slotLabelActive]}>
                  {slot.label}
                </Text>
                <Text style={[styles.slotTime, slot.active && styles.slotTimeActive]}>
                  {slot.time}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── BOUTONS ACTION ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnQueue}>
            <Text style={styles.btnQueueText}>File (~8min)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnBook}>
            <Text style={styles.btnBookText}>Réserver →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFAEE' },

  // HERO
  hero: { height: 200, position: 'relative' },
  heroBg: { position: 'absolute', inset: 0, backgroundColor: '#2C1A06', alignItems: 'center', justifyContent: 'center' },
  heroBgEmoji: { fontSize: 80, opacity: 0.08 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.5)' },
  heroTopNav: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 16, color: '#fff' },
  shareBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  shareBtnText: { fontSize: 14, color: '#fff' },
  heroContent: { position: 'absolute', bottom: 14, left: 14, right: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  heroLogo: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  heroLogoText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroName: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroAddr: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroBadge: { backgroundColor: 'rgba(26,138,74,0.3)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4, borderWidth: 0.5, borderColor: 'rgba(26,138,74,0.4)' },
  heroBadgeText: { fontSize: 9, color: '#7EE8A2', fontWeight: '600' },

  // SCORES
  scoresRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.5)', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.6)' },
  scoreCell: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.5)' },
  scoreNum: { fontSize: 17, fontWeight: '800', color: '#A8852A' },
  scoreLbl: { fontSize: 9, color: 'rgba(28,28,30,0.55)', marginTop: 2 },

  // TABS
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.4)' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 11, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  tabTextActive: { color: '#A8852A' },
  tabLine: { position: 'absolute', bottom: 0, width: '60%', height: 2, backgroundColor: '#A8852A', borderRadius: 1 },

  // SECTION
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  sectionLink: { fontSize: 11, color: '#0071E3' },

  // PHOTOS
  photosGrid: { paddingHorizontal: 16, flexDirection: 'row', gap: 6, height: 140 },
  photoMain: { flex: 2, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.5)' },
  photoCol: { flex: 1, gap: 6 },
  photoSmall: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.5)' },
  photoEmoji: { fontSize: 22, opacity: 0.2 },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(0,0,0,0.6)' },
  photoBadge: { position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.3)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  photoBadgeText: { fontSize: 9, fontWeight: '700', color: '#A8852A' },
  photoCaption: { position: 'absolute', bottom: 8, left: 9 },
  photoCaptionTitle: { fontSize: 10, fontWeight: '700', color: '#fff' },
  photoCaptionSub: { fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  // QUEUE
  queueCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: 'rgba(26,138,74,0.1)', borderRadius: 16, padding: 13, borderWidth: 0.5, borderColor: 'rgba(26,138,74,0.28)' },
  queueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  queueLive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1A8A4A' },
  queueLiveText: { fontSize: 11, fontWeight: '600', color: '#1A8A4A' },
  queueWait: { fontSize: 11, fontWeight: '600', color: '#1A8A4A' },
  queueSlots: { gap: 6 },
  queueSlot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotNum: { width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.8)' },
  slotNumActive: { backgroundColor: 'rgba(26,138,74,0.25)', borderColor: 'rgba(26,138,74,0.4)' },
  slotNumText: { fontSize: 10, fontWeight: '700', color: 'rgba(28,28,30,0.5)' },
  slotNumTextActive: { color: '#1A8A4A' },
  slotLabel: { flex: 1, fontSize: 12, color: 'rgba(28,28,30,0.5)' },
  slotLabelActive: { color: '#1C1C1E', fontWeight: '500' },
  slotTime: { fontSize: 10, color: 'rgba(28,28,30,0.4)' },
  slotTimeActive: { color: '#1A8A4A', fontWeight: '600' },

  // ACTIONS
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  btnQueue: { flex: 1, backgroundColor: 'rgba(26,138,74,0.12)', borderRadius: 13, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(26,138,74,0.28)' },
  btnQueueText: { fontSize: 12, fontWeight: '700', color: '#1A8A4A' },
  btnBook: { flex: 2, backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 13, padding: 12, alignItems: 'center' },
  btnBookText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});