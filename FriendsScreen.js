import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';

const STORIES = [
  { id:1, name:'Jordan', ini:'JB', bg:'#3A1A06', hasNew:true },
  { id:2, name:'Moussa', ini:'MO', bg:'#0A1A0A', hasNew:true },
  { id:3, name:'David', ini:'DA', bg:'#0A0A1A', hasNew:false },
  { id:4, name:'Karim', ini:'KA', bg:'#1A0814', hasNew:false },
  { id:5, name:'Théo', ini:'TH', bg:'#1A1006', hasNew:false },
];

const FEED = [
  {
    id:1, user:'Jordan B.', ini:'JB', bg:'#3A1A06',
    salon:'King Style', barber:'Kevin J.',
    service:'Mid Fade + Design', type:'4A/4B',
    time:'il y a 2h', likes:14, comments:3,
    liked:true, caption:'Fresh cut du samedi 🔥 #FreshGirlz #Fade'
  },
  {
    id:2, user:'Moussa O.', ini:'MO', bg:'#0A1A0A',
    salon:'Fresh Cutz', barber:'Amed M.',
    service:'Afro Shape', type:'4C',
    time:'il y a 5h', likes:8, comments:1,
    liked:false, caption:'Nikel sur 4C 💪 Amed le meilleur'
  },
  {
    id:3, user:'David A.', ini:'DA', bg:'#0A0A1A',
    salon:'Kingdom', barber:'Omar S.',
    service:'High Fade Skin', type:'4B',
    time:'hier', likes:22, comments:5,
    liked:false, caption:'Combo de folie chez Kingdom 👑'
  },
];

export default function FriendsScreen() {
  const [feed, setFeed] = useState(FEED);

  function toggleLike(id) {
    setFeed(prev => prev.map(p =>
      p.id === id
        ? {...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1}
        : p
    ));
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
          <Text style={styles.headerTitle}>Mes Amis</Text>
          <TouchableOpacity style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* STORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}>
          {STORIES.map((s) => (
            <TouchableOpacity key={s.id} style={styles.storyWrap}>
              <View style={[styles.storyRing, s.hasNew && styles.storyRingNew]}>
                <View style={[styles.storyAv, {backgroundColor: s.bg}]}>
                  <Text style={styles.storyAvText}>{s.ini}</Text>
                </View>
              </View>
              <Text style={styles.storyName}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FEED */}
        {feed.map((post) => (
          <BlurView key={post.id} intensity={60} tint="light" style={styles.postCard}>

            {/* HEAD */}
            <View style={styles.postHead}>
              <View style={[styles.postAv, {backgroundColor: post.bg}]}>
                <Text style={styles.postAvText}>{post.ini}</Text>
              </View>
              <View style={styles.postHeadInfo}>
                <Text style={styles.postUser}>{post.user}</Text>
                <Text style={styles.postMeta}>
                  {post.time} · <Text style={styles.postSalon}>{post.salon}</Text>
                </Text>
              </View>
              <TouchableOpacity style={styles.postMore}>
                <Text style={styles.postMoreText}>···</Text>
              </TouchableOpacity>
            </View>

            {/* PHOTO */}
            <View style={[styles.postPhoto, {backgroundColor: post.bg}]}>
              <Text style={styles.postPhotoEmoji}>✂</Text>
              <View style={styles.postPhotoOverlay} />
              <BlurView intensity={40} tint="dark" style={styles.postPhotoTag}>
                <Text style={styles.postPhotoTagText}>
                  {post.service} · {post.type}
                </Text>
              </BlurView>
            </View>

            {/* ACTIONS */}
            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => toggleLike(post.id)}>
                <Text style={[styles.actionLike, post.liked && styles.actionLiked]}>
                  {post.liked ? '♥' : '♡'} {post.likes}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionText}>💬 {post.comments}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={styles.actionText}>↗ Partager</Text>
              </TouchableOpacity>
            </View>

            {/* CAPTION */}
            <View style={styles.postCaption}>
              <Text style={styles.postCaptionText}>
                <Text style={styles.postCaptionUser}>{post.user} </Text>
                {post.caption}
              </Text>
            </View>

            {/* VOIR MÊME Coiffeuse */}
            <TouchableOpacity style={styles.sameBarberBtn}>
              <Text style={styles.sameBarberText}>
                ✂ Voir {post.barber} · {post.salon}
              </Text>
            </TouchableOpacity>

          </BlurView>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1 },
  wallpaper: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#FFF0EE' },
  blob1: { position:'absolute', top:-40, right:-40, width:260, height:260, borderRadius:130, backgroundColor:'rgba(192,57,43,0.12)' },
  blob2: { position:'absolute', top:300, left:-60, width:240, height:240, borderRadius:120, backgroundColor:'rgba(201,80,122,0.12)' },
  blob3: { position:'absolute', bottom:100, right:-30, width:220, height:220, borderRadius:110, backgroundColor:'rgba(168,133,42,0.12)' },

  // HEADER
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:12 },
  headerTitle: { fontSize:24, fontWeight:'800', color:'#1C1C1E', letterSpacing:-0.6 },
  addBtn: { backgroundColor:'rgba(28,28,30,0.88)', borderRadius:12, paddingHorizontal:14, paddingVertical:8 },
  addBtnText: { fontSize:13, fontWeight:'700', color:'#fff' },

  // STORIES
  storiesContent: { paddingHorizontal:16, gap:12, paddingBottom:14 },
  storyWrap: { alignItems:'center', gap:5 },
  storyRing: { width:56, height:56, borderRadius:28, padding:2.5, backgroundColor:'rgba(28,28,30,0.1)' },
  storyRingNew: { backgroundColor:'#A8852A' },
  storyAv: { width:'100%', height:'100%', borderRadius:25, alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'rgba(255,255,255,0.7)' },
  storyAvText: { fontSize:14, fontWeight:'800', color:'#fff' },
  storyName: { fontSize:10, color:'rgba(28,28,30,0.55)', fontWeight:'500' },

  // POST CARD
  postCard: { marginHorizontal:16, marginBottom:12, borderRadius:20, overflow:'hidden', borderWidth:0.5, borderColor:'rgba(255,255,255,0.85)' },
  postHead: { flexDirection:'row', alignItems:'center', gap:9, padding:12, paddingBottom:8 },
  postAv: { width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center', flexShrink:0 },
  postAvText: { fontSize:12, fontWeight:'800', color:'#fff' },
  postHeadInfo: { flex:1 },
  postUser: { fontSize:14, fontWeight:'600', color:'#1C1C1E' },
  postMeta: { fontSize:11, color:'rgba(28,28,30,0.5)', marginTop:1 },
  postSalon: { color:'#A8852A', fontWeight:'500' },
  postMore: { padding:4 },
  postMoreText: { fontSize:16, color:'rgba(28,28,30,0.35)', letterSpacing:1 },

  // PHOTO
  postPhoto: { height:200, alignItems:'center', justifyContent:'center', position:'relative' },
  postPhotoEmoji: { fontSize:60, opacity:0.15 },
  postPhotoOverlay: { position:'absolute', bottom:0, left:0, right:0, height:70, backgroundColor:'rgba(0,0,0,0.4)' },
  postPhotoTag: { position:'absolute', bottom:10, left:11, borderRadius:20, overflow:'hidden', paddingHorizontal:10, paddingVertical:4 },
  postPhotoTagText: { fontSize:11, color:'#fff', fontWeight:'600' },

  // ACTIONS
  postActions: { flexDirection:'row', gap:4, padding:10, paddingBottom:6, borderTopWidth:0.5, borderTopColor:'rgba(255,255,255,0.6)' },
  actionBtn: { paddingHorizontal:8, paddingVertical:4 },
  actionLike: { fontSize:13, color:'rgba(28,28,30,0.55)', fontWeight:'500' },
  actionLiked: { color:'#C0392B', fontWeight:'700' },
  actionText: { fontSize:13, color:'rgba(28,28,30,0.55)' },

  // CAPTION
  postCaption: { paddingHorizontal:12, paddingBottom:8 },
  postCaptionText: { fontSize:12, color:'rgba(28,28,30,0.7)', lineHeight:18 },
  postCaptionUser: { fontWeight:'700', color:'#1C1C1E' },

  // VOIR Coiffeuse
  sameBarberBtn: { marginHorizontal:12, marginBottom:12, backgroundColor:'rgba(168,133,42,0.1)', borderRadius:12, padding:9, alignItems:'center', borderWidth:0.5, borderColor:'rgba(168,133,42,0.25)' },
  sameBarberText: { fontSize:12, color:'#A8852A', fontWeight:'600' },
});
