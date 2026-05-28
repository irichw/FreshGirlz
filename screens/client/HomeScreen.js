import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar, Image
} from 'react-native';
const trendImages = {
  fade: require('../../assets/fade.jpg'),
  twists: require('../../assets/twists.jpg'),
  highfade: require('../../assets/highfade.jpg'),
};
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour Marcus 👋</Text>
            <Text style={styles.title}>
              Trouve ton <Text style={styles.gold}>Fresh</Text>Cut
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>MK</Text>
          </View>
        </View>

        {/* ── SEARCH ── */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>
            Salon, quartier, coupe...
          </Text>
        </View>

        {/* ── FILE ACTIVE ── */}
        <View style={styles.queueCard}>
          <View style={styles.queueTop}>
            <View style={styles.queueLive}>
              <View style={styles.liveDot} />
              <Text style={styles.queueLiveText}>Ta file active</Text>
            </View>
            <Text style={styles.queueSalon}>King Style</Text>
          </View>
          <View style={styles.queueBody}>
            <View>
              <Text style={styles.queueTimer}>
                8<Text style={styles.queueMin}>min</Text>
              </Text>
              <Text style={styles.queueSub}>d'attente</Text>
            </View>
            <View style={styles.queueSep} />
            <View>
              <Text style={styles.queuePos}>
                Tu es{' '}
                <Text style={styles.queuePosGreen}>2ème</Text>
              </Text>
              <Text style={styles.queueService}>Mid Fade · Kevin J.</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.queueBtn} activeOpacity={0.85}>
            <Text style={styles.queueBtnText}>✓ Confirmer ma présence</Text>
          </TouchableOpacity>
        </View>

        {/* ── PILLS ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {['Tout', 'Fade', 'Locs', 'Barbe', 'Design'].map((pill, i) => (
            <TouchableOpacity
              key={pill}
              style={[styles.pill, i === 0 && styles.pillActive]}
            >
              <Text style={[styles.pillText, i === 0 && styles.pillTextActive]}>
                {pill}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── BARBIERS À LA UNE ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>✨ Barbiers à la une</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredContent}
        >
          {[
            { initials: 'KJ', name: 'Kevin J.', salon: 'King Style', note: '4.9', wait: '~8min', match: '98%', color: '#C9A84C', badge: '⭐ Top', bg: '#3A1A06' },
            { initials: 'AM', name: 'Amed M.', salon: 'Fresh Cutz', note: '4.8', wait: '~22min', match: '91%', color: '#1A8A4A', badge: '🔥 Pop', bg: '#0A1A0A' },
            { initials: 'OS', name: 'Omar S.', salon: 'Kingdom', note: '4.7', wait: '~12min', match: '87%', color: '#6B3FA0', badge: '🆕 New', bg: '#0A0A1A' },
          ].map((b) => (
            <TouchableOpacity key={b.name} style={styles.featCard} activeOpacity={0.9}>
              <View style={[styles.featPhoto, { backgroundColor: b.bg }]}>
                <View style={[styles.featAvatar, { borderColor: b.color + '60' }]}>
                  <Text style={[styles.featAvatarText, { color: b.color }]}>
                    {b.initials}
                  </Text>
                </View>
                <View style={styles.featOverlay} />
                <View style={styles.featBadge}>
                  <Text style={styles.featBadgeText}>{b.badge}</Text>
                </View>
                <Text style={styles.featNameOver}>{b.name}</Text>
              </View>
              <View style={styles.featBody}>
                <Text style={styles.featSalon}>{b.salon}</Text>
                <Text style={styles.featNote}>★ {b.note}</Text>
                <View style={styles.featRow}>
                  <View style={styles.waitBadge}>
                    <Text style={styles.waitText}>{b.wait}</Text>
                  </View>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchText}>{b.match}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── TENDANCES ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🔥 Tendances</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Explorer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trendsGrid}>
          {[
            { rank: '1', name: 'Mid Fade + Design', count: '+34% · 1 247 coupes', bg: '#3A1A06', gold: true },
            { rank: '2', name: 'High Fade Skin', count: '847 coupes', bg: '#0A1A0A', gold: false },
            { rank: '3', name: 'Twists Box', count: '612 coupes', bg: '#1A0814', gold: false },
            { rank: '4', name: 'Line-up Design', count: '489 coupes', bg: '#1A1006', gold: false },
          ].map((t) => (
            <TouchableOpacity
              key={t.rank}
              style={[styles.trendCard, t.gold && styles.trendCardWide]}
              activeOpacity={0.9}
            >
              <View style={[styles.trendBg, { backgroundColor: t.bg }]}>
                <View style={[styles.trendRank, t.gold && styles.trendRankGold]}>
                  <Text style={styles.trendRankText}>{t.rank}</Text>
                </View>
              </View>
              <View style={styles.trendBody}>
                <Text style={styles.trendName}>{t.name}</Text>
                <Text style={styles.trendCount}>{t.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── SALONS PROCHES ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📍 Proches de toi</Text>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {[
          { initials: 'KS', name: 'King Style Barbershop', tags: 'Fade · Design · 4A/4B', stars: '★★★★★', wait: '~8 min', dist: '0.3 km', match: '98%', waitColor: '#1A8A4A', bg: '#3A1A06' },
          { initials: 'FC', name: 'Fresh Cutz', tags: 'Locs · Twists · 4C', stars: '★★★★☆', wait: '~22 min', dist: '1.1 km', match: '91%', waitColor: '#B06A00', bg: '#0A1A0A' },
          { initials: 'TK', name: 'The Kingdom Cuts', tags: 'Afro · Fade · Barbe', stars: '★★★★★', wait: '~45 min', dist: '2.4 km', match: '85%', waitColor: '#C0392B', bg: '#1A0A0A' },
        ].map((s) => (
          <TouchableOpacity key={s.name} style={styles.salonCard} activeOpacity={0.9}>
            <View style={[styles.salonPhoto, { backgroundColor: s.bg }]}>
              <Text style={styles.salonPhotoEmoji}>✂</Text>
            </View>
            <View style={styles.salonInfo}>
              <Text style={styles.salonName}>{s.name}</Text>
              <Text style={styles.salonTags}>{s.tags}</Text>
              <Text style={styles.salonStars}>{s.stars}</Text>
            </View>
            <View style={styles.salonRight}>
              <View style={[styles.waitPill, { backgroundColor: s.waitColor + '18' }]}>
                <Text style={[styles.waitPillText, { color: s.waitColor }]}>{s.wait}</Text>
              </View>
              <Text style={styles.salonDist}>{s.dist}</Text>
              <View style={styles.matchPill}>
                <Text style={styles.matchPillText}>{s.match}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EEF8FF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  trendBgWide: { width: 120, height: '100%' },

  // HEADER
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 12 },
  greeting: { fontSize: 12, color: 'rgba(28,28,30,0.55)' },
  title: { fontSize: 22, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5, marginTop: 2 },
  gold: { color: '#A8852A' },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(168,133,42,0.12)', borderWidth: 1.5, borderColor: 'rgba(168,133,42,0.28)', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  avatarText: { fontSize: 12, fontWeight: '800', color: '#A8852A' },

  // SEARCH
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 13, padding: 11, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  searchIcon: { fontSize: 14, opacity: 0.4 },
  searchPlaceholder: { fontSize: 13, color: 'rgba(28,28,30,0.35)' },

  // QUEUE
  queueCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: 'rgba(26,138,74,0.1)', borderRadius: 16, padding: 13, borderWidth: 0.5, borderColor: 'rgba(26,138,74,0.28)' },
  queueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  queueLive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#1A8A4A' },
  queueLiveText: { fontSize: 11, fontWeight: '600', color: '#1A8A4A' },
  queueSalon: { fontSize: 10, color: 'rgba(28,28,30,0.55)' },
  queueBody: { flexDirection: 'row', alignItems: 'center' },
  queueTimer: { fontSize: 30, fontWeight: '800', color: '#1A8A4A', lineHeight: 34 },
  queueMin: { fontSize: 13 },
  queueSub: { fontSize: 10, color: 'rgba(28,28,30,0.55)' },
  queueSep: { width: 1, backgroundColor: 'rgba(26,138,74,0.28)', alignSelf: 'stretch', marginHorizontal: 12 },
  queuePos: { fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  queuePosGreen: { color: '#1A8A4A', fontWeight: '700' },
  queueService: { fontSize: 10, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  queueBtn: { marginTop: 10, backgroundColor: 'rgba(26,138,74,0.2)', borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(26,138,74,0.28)' },
  queueBtnText: { fontSize: 12, fontWeight: '700', color: '#1A8A4A' },

  // PILLS
  pillsScroll: { marginTop: 10 },
  pillsContent: { paddingHorizontal: 16, gap: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  pillActive: { backgroundColor: 'rgba(28,28,30,0.88)', borderColor: 'rgba(28,28,30,0.88)' },
  pillText: { fontSize: 12, fontWeight: '500', color: 'rgba(28,28,30,0.6)' },
  pillTextActive: { color: '#fff' },

  // SECTION
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  sectionLink: { fontSize: 12, color: '#0071E3' },

  // FEATURED
  featuredContent: { paddingHorizontal: 16, gap: 10 },
  featCard: { width: 130, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  featPhoto: { height: 110, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  featAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  featAvatarText: { fontSize: 18, fontWeight: '800' },
  featOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 50, backgroundColor: 'rgba(0,0,0,0)' },
  featBadge: { position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(168,133,42,0.25)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.4)' },
  featBadgeText: { fontSize: 9, fontWeight: '700', color: '#A8852A' },
  featNameOver: { position: 'absolute', bottom: 7, left: 9, fontSize: 11, fontWeight: '700', color: '#fff' },
  featBody: { padding: 9 },
  featSalon: { fontSize: 11, fontWeight: '500', color: '#1C1C1E' },
  featNote: { fontSize: 10, color: '#A8852A', marginTop: 2 },
  featRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  waitBadge: { backgroundColor: 'rgba(26,138,74,0.12)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(26,138,74,0.28)' },
  waitText: { fontSize: 9, fontWeight: '600', color: '#1A8A4A' },
  matchBadge: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  matchText: { fontSize: 9, color: '#A8852A' },

  // TRENDS
  trendsGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  trendCard: { width: '47.5%', borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)' },
  trendCardWide: { width: '100%', flexDirection: 'row' },
  trendBg: { height: 75, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  trendCardWide_bg: { width: 110, height: '100%' },
  trendRank: { position: 'absolute', top: 6, left: 7, width: 20, height: 20, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  trendRankGold: { backgroundColor: '#A8852A' },
  trendRankText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  trendBody: { padding: 8 },
  trendName: { fontSize: 11, fontWeight: '700', color: '#1C1C1E' },
  trendCount: { fontSize: 9, color: 'rgba(28,28,30,0.55)', marginTop: 2 },

  // SALONS
  salonCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, overflow: 'hidden', flexDirection: 'row', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  salonPhoto: { width: 58, alignItems: 'center', justifyContent: 'center' },
  salonPhotoEmoji: { fontSize: 22, opacity: 0.25 },
  salonInfo: { flex: 1, padding: 10 },
  salonName: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },
  salonTags: { fontSize: 10, color: 'rgba(28,28,30,0.55)', marginTop: 2 },
  salonStars: { fontSize: 10, color: '#A8852A', marginTop: 2 },
  salonRight: { padding: 10, alignItems: 'flex-end', justifyContent: 'center', gap: 3 },
  waitPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  waitPillText: { fontSize: 10, fontWeight: '600' },
  salonDist: { fontSize: 9, color: 'rgba(28,28,30,0.35)' },
  matchPill: { backgroundColor: 'rgba(168,133,42,0.12)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  matchPillText: { fontSize: 9, color: '#A8852A' },
});