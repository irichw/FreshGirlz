/**
 * Convertit "HH:MM" ou "HH:MM:SS" en minutes depuis minuit.
 * "00:00" en position de fermeture = fin de journée = 1440 min.
 */
function toMin(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Retourne true si l'heure actuelle est dans la plage d'ouverture.
 * Gère le cas close_time = "00:00" (minuit) comme fin de journée (1440 min).
 */
export function isWithinHours(hoursRow) {
  if (!hoursRow || hoursRow.is_closed) return false;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const openMin = toMin(hoursRow.open_time) ?? 0;
  let closeMin = toMin(hoursRow.close_time) ?? 1440;

  // "00:00" comme fermeture = minuit de fin de journée
  if (closeMin === 0) closeMin = 1440;

  return nowMin >= openMin && nowMin <= closeMin;
}

/** day_of_week de la convention app : 0=Lun … 6=Dim */
export function todayDow() {
  return (new Date().getDay() + 6) % 7;
}
