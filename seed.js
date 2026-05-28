// ============================================================
// FreshGirlz — Script de données de test
// node seed.js
//
// ⚠️  Avant de lancer : désactive la confirmation email dans
//     Supabase Dashboard → Authentication → Providers → Email
//     → décocher "Confirm email"
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wpqivrznmuqzidpcaala.supabase.co',
  'sb_publishable_rduw29PC4lztle2z88iZKA_d8CdU8Z5',
);

const NANA_EMAIL  = 'nana.hair@test.local';
const NANA_PASS   = 'FreshGirlz2024!';
const SOFIA_EMAIL = 'sofia.martin@test.local';
const SOFIA_PASS  = 'FreshGirlz2024!';

// Images placeholder (cohérentes, ne nécessitent pas d'auth)
const NANA_AVATAR  = 'https://randomuser.me/api/portraits/women/47.jpg';
const SOFIA_AVATAR = 'https://randomuser.me/api/portraits/women/26.jpg';

// Photos du book — picsum donne des images stables par seed
const BOOK = [
  { url: 'https://picsum.photos/seed/fghair1/400/520', caption: 'Knotless Boho',      cat: 'tresses', likes: 48 },
  { url: 'https://picsum.photos/seed/fghair2/400/520', caption: 'Box Braids XL',      cat: 'tresses', likes: 34 },
  { url: 'https://picsum.photos/seed/fghair3/400/520', caption: 'Locks naturels',     cat: 'locks',   likes: 61 },
  { url: 'https://picsum.photos/seed/fghair4/400/520', caption: 'Two-strand twist',   cat: 'twist',   likes: 22 },
  { url: 'https://picsum.photos/seed/fghair5/400/520', caption: 'Cornrows créatifs',  cat: 'tresses', likes: 17 },
  { url: 'https://picsum.photos/seed/fghair6/400/520', caption: 'Knotless midi',      cat: 'tresses', likes: 55 },
];

const PRESTATIONS = [
  { nom: 'Knotless Braids',    categorie: 'tresses', emoji: '🧵', prix_min: 80,  prix_max: 120, duree_min: 240, duree_max: 360, description: 'Tresses sans nœuds légères et naturelles.' },
  { nom: 'Box Braids',         categorie: 'tresses', emoji: '🧵', prix_min: 60,  prix_max: 100, duree_min: 180, duree_max: 300, description: 'Tresses box classiques, petites ou grandes.' },
  { nom: 'Locks Installation', categorie: 'locks',   emoji: '🌀', prix_min: 150, prix_max: 200, duree_min: 300, duree_max: 480, description: 'Pose de locks démarrées ou par twist.' },
  { nom: 'Twist',              categorie: 'twist',   emoji: '🌿', prix_min: 50,  prix_max: 70,  duree_min: 120, duree_max: 180, description: 'Twist two-strand sur cheveux naturels.' },
  { nom: 'Cornrows',           categorie: 'tresses', emoji: '🧵', prix_min: 40,  prix_max: 60,  duree_min: 90,  duree_max: 150, description: 'Tresses collées, motifs simples ou élaborés.' },
];

const AVIS = [
  { note: 5, commentaire: 'Nana est une vraie artiste ! Mes knotless sont parfaites, elle a été super attentionnée. Je recommande les yeux fermés ✨' },
  { note: 5, commentaire: 'Deuxième visite et toujours aussi satisfaite. Les tresses tiennent bien, elle prend soin du cuir chevelu. Top !' },
  { note: 4, commentaire: 'Beau travail sur mes box braids. Petit bémol sur l\'attente mais le résultat vaut la peine 🌸' },
];

// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ok(msg)   { console.log('   ✅', msg); }
function warn(msg) { console.warn('   ⚠️ ', msg); }

async function signUpOrIn(email, pass, meta) {
  const { data: up, error: upErr } = await supabase.auth.signUp({
    email, password: pass, options: { data: meta },
  });
  if (!upErr && up.session) return up.user;

  // Déjà inscrit ou confirmation email active → connexion directe
  const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (siErr) throw new Error(`Auth ${email} : ${siErr.message}`);
  return si.user;
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌸 FreshGirlz — Seed\n' + '─'.repeat(46));

  // ══════════════════════════════════════
  // 1. COIFFEUSE : Nana Hair
  // ══════════════════════════════════════
  console.log('\n👑 Coiffeuse : Nana Hair');

  const nanaUser = await signUpOrIn(NANA_EMAIL, NANA_PASS, { name: 'Nana Hair', role: 'coiffeuse' });
  ok('Compte créé/trouvé → ' + nanaUser.id);

  await sleep(900); // délai trigger Supabase

  // Mise à jour profil coiffeuse
  const { error: e1 } = await supabase
    .from('coiffeuses')
    .update({
      name:         'Nana Hair',
      bio:          'Spécialiste tresses africaines & locks depuis 5 ans 🌿\nBasée à Paris, je donne vie à tes coiffures de rêve.',
      avatar_url:   NANA_AVATAR,
      adresse:      '12 rue des Abbesses',
      ville:        'Paris',
      latitude:     48.8843,
      longitude:    2.3367,
      instagram:    'nanahair_paris',
      specialites:  ['tresses', 'locks', 'twist'],
      is_available: true,
      booking_mode: 'request',
      rating:       4.9,
      nb_avis:      3,
      role:         'manager',
    })
    .eq('user_id', nanaUser.id);

  if (e1) warn('Update profil : ' + e1.message); else ok('Profil mis à jour');

  // Récupérer l'ID coiffeuse
  const { data: nanaProfil } = await supabase
    .from('coiffeuses').select('id').eq('user_id', nanaUser.id).maybeSingle();

  if (!nanaProfil) {
    console.error('\n❌ Profil coiffeuse introuvable (trigger non déclenché ?)');
    console.error('   → Vérifier le trigger on_auth_user_created dans Supabase\n');
    process.exit(1);
  }
  const nanaId = nanaProfil.id;
  ok('ID coiffeuse : ' + nanaId);

  // Prestations
  console.log('\n✂️  Prestations :');
  for (const p of PRESTATIONS) {
    const { error } = await supabase.from('prestations').insert({ ...p, coiffeuse_id: nanaId });
    if (error) warn(p.nom + ' : ' + error.message); else ok(p.nom);
  }

  // Photos du book
  console.log('\n📸 Book photos :');
  for (const ph of BOOK) {
    const { error } = await supabase.from('book_photos').insert({
      coiffeuse_id: nanaId,
      photo_url:    ph.url,
      caption:      ph.caption,
      categorie:    ph.cat,
      likes:        ph.likes,
    });
    if (error) warn(ph.caption + ' : ' + error.message); else ok(ph.caption);
  }

  // ══════════════════════════════════════
  // 2. CLIENTE : Sofia Martin
  // ══════════════════════════════════════
  console.log('\n💅 Cliente : Sofia Martin');

  await supabase.auth.signOut();
  const sofiaUser = await signUpOrIn(SOFIA_EMAIL, SOFIA_PASS, { name: 'Sofia Martin', role: 'client' });
  ok('Compte créé/trouvé → ' + sofiaUser.id);

  await sleep(900);

  const { error: e2 } = await supabase
    .from('clientes')
    .update({
      name:        'Sofia Martin',
      bio:         'Fan de tresses et de looks naturels 💫',
      avatar_url:  SOFIA_AVATAR,
      fresh_score: 85,
    })
    .eq('user_id', sofiaUser.id);

  if (e2) warn('Update profil : ' + e2.message); else ok('Profil mis à jour');

  const { data: sofiaProfil } = await supabase
    .from('clientes').select('id').eq('user_id', sofiaUser.id).maybeSingle();

  if (!sofiaProfil) {
    console.error('\n❌ Profil cliente introuvable\n');
    process.exit(1);
  }
  const sofiaId = sofiaProfil.id;
  ok('ID cliente : ' + sofiaId);

  // Avis de Sofia sur Nana
  console.log('\n⭐ Avis de Sofia sur Nana Hair :');
  for (const a of AVIS) {
    const { error } = await supabase.from('avis').insert({
      coiffeuse_id: nanaId,
      cliente_id:   sofiaId,
      note:         a.note,
      commentaire:  a.commentaire,
    });
    if (error) warn('Avis : ' + error.message); else ok(`${a.note} ★ — "${a.commentaire.slice(0, 40)}..."`);
  }

  // Taguer Sofia sur la première photo du book
  const { data: firstPhoto } = await supabase
    .from('book_photos').select('id').eq('coiffeuse_id', nanaId).limit(1).maybeSingle();
  if (firstPhoto) {
    await supabase.from('book_photos').update({ cliente_id: sofiaId }).eq('id', firstPhoto.id);
    ok('Sofia taguée sur la 1ère photo du book');
  }

  await supabase.auth.signOut();

  // ══════════════════════════════════════
  // Résumé
  // ══════════════════════════════════════
  console.log('\n' + '═'.repeat(46));
  console.log('🎉 Seed terminé avec succès !\n');
  console.log('  👑 Coiffeuse  →  ' + NANA_EMAIL);
  console.log('  💅 Cliente    →  ' + SOFIA_EMAIL);
  console.log('  🔑 Mot de passe (commun) : FreshGirlz2024!');
  console.log('\n  Pour observer le rendu :');
  console.log('  • Connecte-toi comme Sofia → Profil public de Nana');
  console.log('  • Connecte-toi comme Nana  → Dashboard coiffeuse');
  console.log('═'.repeat(46) + '\n');
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  console.log('\n💡 Causes possibles :');
  console.log('  1. La confirmation email est activée');
  console.log('     → Supabase Dashboard → Auth → Providers → Email');
  console.log('       → désactiver "Confirm email"\n');
  console.log('  2. Le schéma SQL n\'a pas encore été exécuté');
  console.log('     → Colle supabase_schema.sql dans l\'éditeur SQL Supabase\n');
  console.log('  3. Les policies RLS bloquent l\'insertion');
  console.log('     → Vérifie que toutes les policies sont créées\n');
  process.exit(1);
});
