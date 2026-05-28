/**
 * Calcule le FreshScore d'un client (0-100)
 */
export function calculateFreshScore({
  lastCutDate,      // Date de la dernière coupe
  totalCuts,        // Nombre total de coupes
  reviewsLeft,      // Nombre d'avis laissés
  photosShared,     // Nombre de photos partagées
  hasReference,     // Boolean - a une coupe de référence
  presenceRate,     // % de présences confirmées (0-1)
  cancellations,    // Nombre d'annulations tardives
  decalagesUsed,    // Nombre de décalages utilisés
  followedBarbers,  // Nombre de coiffeuses suivis
  likesGiven,       // Nombre de coupes likées
  likesReceived,    // Likes reçus sur ses coupes
  timesUsedAsRef,   // Fois où sa coupe a été utilisée en référence
  platformAvgCuts, 
}) {

  // 1. FRAÎCHEUR (30 pts)
  let freshness = 0;
if (lastCutDate) {
  const daysSince = Math.floor((new Date() - new Date(lastCutDate)) / (1000 * 60 * 60 * 24));
  if (daysSince <= 6) {
    freshness = 30;
  } else if (daysSince <= 14) {
    freshness = 30 - (daysSince - 6);
  } else {
    freshness = Math.max(0, 22 - (daysSince - 14) * 1.5);
  }
  freshness = Math.round(freshness);
}

  // 2. VOLUME (10 pts)
let volume = 0;
if (platformAvgCuts > 0) {
  volume = Math.min(10, Math.round((totalCuts / platformAvgCuts) * 10));
} else {
  volume = totalCuts > 0 ? 5 : 0; // fallback si pas encore de moyenne
}

  // 3. ENGAGEMENT (15 pts)
let engagement = 0;

// Avis laissés (6 pts) — max si tu as laissé un avis pour chaque coupe
const reviewRate = totalCuts > 0 ? Math.min(1, reviewsLeft / totalCuts) : 0;
engagement += Math.round(reviewRate * 6);

// Photos partagées (5 pts max)
engagement += Math.min(5, photosShared);

// Coupe de référence définie (4 pts)
engagement += hasReference ? 4 : 0;

  // 4. COMPORTEMENT EN FILE (10 pts)
  let behaviour = 0;
  // Taux de présence (6 pts max)
  behaviour += Math.round(presenceRate * 6);
  // Pénalité annulations tardives
  behaviour -= Math.min(4, cancellations * 1);
  // Pénalité décalages
  behaviour -= Math.min(2, decalagesUsed * 0.5);
  behaviour = Math.max(0, behaviour);

  // 5. SOCIAL (15 pts)
  let social = 0;
  // coiffeuses suivis (7 pts max)
  social += Math.min(7, followedBarbers * 2);
  // Coupes likées (8 pts max)
  social += Math.min(8, likesGiven * 0.5);

  // 6. POPULARITÉ (20 pts)
  let popularity = 0;
  // Likes reçus (12 pts max)
  popularity += Math.min(12, likesReceived * 0.5);
  // Utilisé en référence (8 pts max)
  popularity += Math.min(8, timesUsedAsRef * 2);

  // TOTAL
  const total = Math.round(freshness + volume + engagement + behaviour + social + popularity);
  return Math.min(100, Math.max(0, total));
}

/**
 * Retourne le niveau et label selon le score
 */
export function getFreshLevel(score) {
  if (score >= 91) return { label: 'Fresh', emoji: '👑', color: '#A8852A' };
  if (score >= 76) return { label: 'Elite', emoji: '🔥', color: '#7C3D8F' };
  if (score >= 61) return { label: 'Sharp', emoji: '✂️', color: '#0071E3' };
  if (score >= 41) return { label: 'Basic', emoji: '👌', color: '#1C1C1E' };
  return { label: 'Rookie', emoji: '🪫', color: 'rgba(28,28,30,0.5)' };
}
