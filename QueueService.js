import { supabase } from './supabase';
import { isWithinHours, todayDow } from './utils/hours';

const QUEUE_RULES = {
  MAX_ETA_TO_BOOK:    3600, // 1h   — limite géographique
  WALKIN_THRESHOLD:   120,  // 2min — walk-in direct position 1
  JUMP_THRESHOLD:     300,  // 5min — écart min pour doubler le premier
};

/**
 * Rejoindre une file — fonction centrale utilisée partout
 */
export async function joinQueue({ barberId, service = 'À définir', totalPrix = 0, totalDur = 0, etaSeconds = null, referenceUrl = null }) {
  try {
    // 1. Limite géographique
    if (etaSeconds !== null && etaSeconds > QUEUE_RULES.MAX_ETA_TO_BOOK) {
      return { success: false, error: 'eta_too_far' };
    }

    // 2. Session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'not_authenticated' };

    // 3. Client
    const { data: clientData } = await supabase
      .from('clientes')
      .select('id, name')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!clientData) return { success: false, error: 'no_client' };

    // 4. Déjà dans la file ?
    const { data: existing } = await supabase
      .from('queue')
      .select('id')
      .eq('client_id', clientData.id)
      .eq('barber_id', barberId)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) return { success: false, error: 'already_in_queue' };

    // 4b. Vérifier file verrouillée + horaires d'ouverture
    const { data: barberCheckData } = await supabase
      .from('coiffeuses')
      .select('salon_id, queue_locked, salons(id, is_open)')
      .eq('id', barberId)
      .maybeSingle();

    if (barberCheckData?.queue_locked) {
      return { success: false, error: 'queue_locked' };
    }

    if (barberCheckData?.salons) {
      const salonId = barberCheckData.salons.id;
      const { data: hoursRow } = await supabase
        .from('opening_hours')
        .select('is_closed, open_time, close_time')
        .eq('salon_id', salonId)
        .eq('day_of_week', todayDow())
        .maybeSingle();

      if (hoursRow) {
        // Une ligne existe en DB pour aujourd'hui → elle fait autorité
        if (!isWithinHours(hoursRow)) {
          return { success: false, error: 'outside_hours' };
        }
      }
      // Pas de ligne en DB pour aujourd'hui → autorisé par défaut
    }

    // 5. File active complète (triée par position) — inclut walkin
    const { data: activeQueue } = await supabase
      .from('queue')
      .select('id, position, status')
      .eq('barber_id', barberId)
      .in('status', ['active', 'in_progress', 'walkin'])
      .order('position', { ascending: true });

    // 6. Toujours en fin de file
    const lastPos = (activeQueue || []).reduce((max, e) => Math.max(max, e.position), 0);
    const insertPosition = lastPos + 1;

    // Calculer l'attente estimée = somme des durées des personnes déjà en file
    const { data: queueDurations } = await supabase
      .from('queue')
      .select('duration')
      .eq('barber_id', barberId)
      .in('status', ['active', 'in_progress']);
    const estimatedWait = (queueDurations || []).reduce((sum, e) => sum + (e.duration || 25), 0);

    // 7. Insert
    const { data: entry, error } = await supabase
      .from('queue')
      .insert({
        client_id: clientData.id,
        barber_id: barberId,
        client_name: clientData.name,
        service,
        position: insertPosition,
        status: 'active',
        estimated_wait: estimatedWait,
        decale_used: false,
        duration: totalDur,
        eta_seconds: insertPosition === 1 ? etaSeconds : null,
        reference_url: referenceUrl,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Notifier le Coiffeuse qu'un client vient de rejoindre
    const { data: barberUser } = await supabase
      .from('coiffeuses')
      .select('user_id')
      .eq('id', barberId)
      .single();
    if (barberUser?.user_id) {
      await supabase.from('notifications').insert({
        recipient_user_id: barberUser.user_id,
        title: 'Nouveau client en file',
        body: `${clientData.name} vient de rejoindre ta file`,
        type: 'new_client',
        data: { queue_id: entry.id, client_name: clientData.name },
        read: false,
      });
    }

    return { success: true, entry };

  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Vérifie si le user est dans n'importe quelle file active (tous coiffeuses)
 * Retourne { id, barber_id } ou null
 */
export async function checkAnyActiveQueue() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data: clientData } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (!clientData) return null;

    const { data } = await supabase
      .from('queue')
      .select('id, barber_id, service')
      .eq('client_id', clientData.id)
      .in('status', ['active', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data; // { id, barber_id, service } ou null
  } catch (e) {
    return null;
  }
}

/**
 * Vérifie si le user est déjà dans la file d'un Coiffeuse
 */
export async function checkAlreadyInQueue(barberId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data: clientData } = await supabase
    .from('clientes')
    .select('id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!clientData) return false;

  const { data } = await supabase
    .from('queue')
    .select('id')
    .eq('client_id', clientData.id)
    .eq('barber_id', barberId)
    .eq('status', 'active')
    .maybeSingle();

  return !!data;
}

/**
 * Quitter / annuler une place — recalcule positions et estimated_wait en cascade
 */
export async function leaveQueue(queueId) {
  try {
    const { data: leaving } = await supabase
      .from('queue')
      .select('barber_id, position, duration')
      .eq('id', queueId)
      .single();

    const { error } = await supabase
      .from('queue')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) throw error;

    if (leaving) {
      const { data: behind } = await supabase
        .from('queue')
        .select('id, position, estimated_wait')
        .eq('barber_id', leaving.barber_id)
        .in('status', ['active', 'in_progress'])
        .gt('position', leaving.position);

      if (behind?.length) {
        const leavingDuration = leaving.duration || 25;
        await Promise.all(
          behind.map(e =>
            supabase.from('queue').update({
              position: e.position - 1,
              estimated_wait: Math.max(0, (e.estimated_wait || 0) - leavingDuration),
              updated_at: new Date().toISOString(),
            }).eq('id', e.id)
          )
        );
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Récupère toute la file d'un Coiffeuse (pour le dashboard Coiffeuse)
 */
export async function getQueue(barberId) {
  try {
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .eq('barber_id', barberId)
      .in('status', ['active', 'in_progress', 'walkin'])
      .order('position', { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
