import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Image, Modal, TouchableWithoutFeedback, Alert,
} from 'react-native';
import { supabase } from './supabase';
import { CoiffeuseTabBar } from './CoiffeuseHomeScreen';

// ─── constantes timeline ────────────────────────────────────────────────────
const H_START = 7;
const H_END   = 21;
const HOUR_H  = 68;
const TOTAL_H = (H_END - H_START + 1) * HOUR_H;
const HOURS   = Array.from({ length: H_END - H_START + 1 }, (_, i) => H_START + i);

const DOW_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ─── helpers date ────────────────────────────────────────────────────────────
// Retourne YYYY-MM-DD en heure locale (évite le décalage UTC)
function isoStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
// Heure locale d'un ISO UTC → YYYY-MM-DD local (pour grouper les RDV)
function localDate(iso) {
  const d = new Date(iso);
  return isoStr(d);
}
// Bornes UTC pour une plage de dates locales
function dayStartUTC(dateStr) { return new Date(dateStr + 'T00:00:00').toISOString(); }
function dayEndUTC(dateStr)   { return new Date(dateStr + 'T23:59:59.999').toISOString(); }

function fmtLabel(dateStr, view) {
  const d = new Date(dateStr + 'T12:00:00');
  if (view === 'mois') {
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            .replace(/^./, c => c.toUpperCase());
  }
  if (view === 'semaine') {
    const mon = weekStart(dateStr);
    const sun = new Date(mon.getTime() + 6 * 86400000);
    const monLabel = mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const sunLabel = sun.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${monLabel} – ${sunLabel}`;
  }
  const lbl = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return lbl.charAt(0).toUpperCase() + lbl.slice(1);
}

function weekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return new Date(d.getTime() - dow * 86400000);
}

function getWeekDays(dateStr) {
  const mon = weekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => isoStr(new Date(mon.getTime() + i * 86400000)));
}

function getMonthWeeks(dateStr) {
  const d  = new Date(dateStr + 'T12:00:00');
  const yr = d.getFullYear(), mo = d.getMonth();
  const first = new Date(yr, mo, 1);
  const last  = new Date(yr, mo + 1, 0);
  const startDow = (first.getDay() + 6) % 7;
  const weeks = [];
  let week = Array(startDow).fill(null);
  for (let day = 1; day <= last.getDate(); day++) {
    week.push(isoStr(new Date(yr, mo, day)));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

function navigateDelta(dateStr, view, delta) {
  const d = new Date(dateStr + 'T12:00:00');
  if (view === 'jour')    d.setDate(d.getDate() + delta);
  if (view === 'semaine') d.setDate(d.getDate() + delta * 7);
  if (view === 'mois')    d.setMonth(d.getMonth() + delta);
  return isoStr(d);
}

// ─── helpers RDV ─────────────────────────────────────────────────────────────
function fmtTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function endTime(iso, min) {
  return new Date(new Date(iso).getTime() + (min || 60) * 60000).toISOString();
}
function initials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
function apptLayout(appt) {
  const d = new Date(appt.scheduled_at);
  const startH = d.getHours() + d.getMinutes() / 60;
  const top    = Math.max(0, (startH - H_START) * HOUR_H);
  const height = Math.max(((appt.duration || 60) / 60) * HOUR_H - 6, 52);
  return { top, height };
}
function statusColor(s) {
  if (s === 'confirmed') return '#7C3D8F';
  if (s === 'pending')   return '#C88A2E';
  if (s === 'done')      return 'rgba(28,28,30,0.3)';
  return '#C0392B';
}
function statusBadge(s) {
  if (s === 'confirmed') return { bg: 'rgba(124,61,143,0.13)', text: '#7C3D8F',  label: 'Confirmé' };
  if (s === 'pending')   return { bg: 'rgba(200,138,46,0.14)', text: '#C88A2E',  label: 'En attente' };
  if (s === 'done')      return { bg: 'rgba(28,28,30,0.08)',   text: 'rgba(28,28,30,0.5)', label: 'Terminé' };
  return                        { bg: 'rgba(192,57,43,0.10)',  text: '#C0392B',  label: 'Annulé' };
}

// ════════════════════════════════════════════════════════════════════════════
export default function AgendaScreen({ navigation, route }) {
  const today = isoStr(new Date());
  const [view, setView]               = useState('jour');
  const [selectedDate, setSelectedDate] = useState(today);
  const [appointments, setAppointments] = useState([]);
  const [allPeriodAppts, setAllPeriodAppts] = useState([]);
  const [apptByDate, setApptByDate]   = useState({});
  const [unavailable, setUnavailable] = useState([]);
  const [barberId, setBarberId]       = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [refViewerUri, setRefViewerUri] = useState(null); // plein écran référence

  // ── chargement coiffeuse + navigation depuis notification
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('coiffeuses')
        .select('id').eq('user_id', user.id).maybeSingle();
      if (data?.id) {
        setBarberId(data.id);
        // Si on arrive depuis une notification avec un appointment_id
        const apptId = route?.params?.initialAppointmentId;
        if (apptId) {
          const { data: appt } = await supabase
            .from('appointments').select('scheduled_at').eq('id', apptId).maybeSingle();
          if (appt?.scheduled_at) {
            setSelectedDate(isoStr(new Date(appt.scheduled_at)));
          }
          setExpandedId(apptId);
        }
      }
    })();
  }, []);

  // ── RDV du jour sélectionné (vue Jour)
  const loadDay = useCallback(async (date) => {
    if (!barberId) return;
    const { data } = await supabase.from('appointments')
      .select('*')
      .eq('coiffeuse_id', barberId)
      .gte('scheduled_at', dayStartUTC(date))
      .lte('scheduled_at', dayEndUTC(date))
      .order('scheduled_at', { ascending: true });
    setAppointments(data || []);
  }, [barberId]);

  // ── tous les RDV d'une plage avec comptage pour les dots
  const loadPeriodAppts = useCallback(async (start, end) => {
    if (!barberId) return;
    const { data } = await supabase.from('appointments')
      .select('*')
      .eq('coiffeuse_id', barberId)
      .gte('scheduled_at', dayStartUTC(start))
      .lte('scheduled_at', dayEndUTC(end))
      .order('scheduled_at', { ascending: true });
    const appts = data || [];
    setAllPeriodAppts(appts);
    const counts = {};
    appts.forEach(a => {
      const d = localDate(a.scheduled_at);  // date locale, pas UTC
      counts[d] = (counts[d] || 0) + 1;
    });
    setApptByDate(counts);
  }, [barberId]);

  // ── jours indisponibles
  const loadUnavailable = useCallback(async (start, end) => {
    if (!barberId) return;
    const { data } = await supabase.from('unavailable_days')
      .select('date')
      .eq('coiffeuse_id', barberId)
      .gte('date', start)
      .lte('date', end);
    setUnavailable((data || []).map(r => r.date));
  }, [barberId]);

  // ── rechargement selon la vue
  useEffect(() => {
    if (!barberId) return;
    if (view === 'jour') {
      loadDay(selectedDate);
      loadUnavailable(selectedDate, selectedDate);
    } else if (view === 'semaine') {
      const days = getWeekDays(selectedDate);
      loadPeriodAppts(days[0], days[6]);
      loadUnavailable(days[0], days[6]);
    } else if (view === 'mois') {
      const d  = new Date(selectedDate + 'T12:00:00');
      const yr = d.getFullYear(), mo = d.getMonth();
      const start = isoStr(new Date(yr, mo, 1));
      const end   = isoStr(new Date(yr, mo + 1, 0));
      loadPeriodAppts(start, end);
      loadUnavailable(start, end);
    }
  }, [barberId, selectedDate, view]);

  // ── actions statut RDV
  function updateStatus(id, status) {
    if (status === 'cancelled') {
      Alert.alert(
        'Annuler ce rendez-vous ?',
        "La cliente sera notifiée de l'annulation.",
        [
          { text: 'Garder', style: 'cancel' },
          { text: 'Annuler le RDV', style: 'destructive', onPress: () => _doUpdateStatus(id, status) },
        ]
      );
      return;
    }
    _doUpdateStatus(id, status);
  }

  async function _doUpdateStatus(id, status) {
    // Récupère le RDV avant la mise à jour pour avoir cliente_id + infos
    const { data: appt } = await supabase
      .from('appointments')
      .select('cliente_id, client_name, service, scheduled_at, coiffeuses(name)')
      .eq('id', id)
      .maybeSingle();

    await supabase.from('appointments').update({ status }).eq('id', id);

    // Notifie la cliente si elle a un compte lié
    if (appt?.cliente_id) {
      const { data: clienteRow } = await supabase
        .from('clientes').select('user_id').eq('id', appt.cliente_id).maybeSingle();
      if (clienteRow?.user_id) {
        const barberName = appt.coiffeuses?.name || 'ta coiffeuse';
        const dateLabel  = new Date(appt.scheduled_at)
          .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeLabel  = new Date(appt.scheduled_at)
          .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        let title, body;
        if (status === 'confirmed') {
          title = 'RDV confirmé ✅';
          body  = `${barberName} a confirmé ton RDV du ${dateLabel} à ${timeLabel}`;
        } else if (status === 'cancelled') {
          title = 'RDV annulé ❌';
          body  = `${barberName} a annulé ton RDV du ${dateLabel} à ${timeLabel}`;
        } else if (status === 'done') {
          title = 'RDV terminé ✂';
          body  = `Ton RDV avec ${barberName} est terminé. Laisse un avis !`;
        }

        if (title) {
          supabase.from('notifications').insert({
            recipient_user_id: clienteRow.user_id,
            type:  `appointment_${status}`,
            title,
            body,
            data:  JSON.stringify({ screen: 'Profile' }),
            read:  false,
          });
        }
      }
    }

    if (view === 'jour') {
      loadDay(selectedDate);
    } else if (view === 'semaine') {
      const days = getWeekDays(selectedDate);
      loadPeriodAppts(days[0], days[6]);
    } else {
      const d  = new Date(selectedDate + 'T12:00:00');
      const yr = d.getFullYear(), mo = d.getMonth();
      loadPeriodAppts(isoStr(new Date(yr, mo, 1)), isoStr(new Date(yr, mo + 1, 0)));
    }
    setExpandedId(null);
  }

  // ── toggle indisponibilité
  const isUnavailable = unavailable.includes(selectedDate);
  async function toggleUnavailable() {
    setMenuVisible(false);
    if (isUnavailable) {
      await supabase.from('unavailable_days')
        .delete().eq('coiffeuse_id', barberId).eq('date', selectedDate);
      setUnavailable(u => u.filter(d => d !== selectedDate));
    } else {
      await supabase.from('unavailable_days')
        .insert({ coiffeuse_id: barberId, date: selectedDate });
      setUnavailable(u => [...u, selectedDate]);
    }
  }

  // ── navigation
  function navigate(delta) {
    setSelectedDate(prev => navigateDelta(prev, view, delta));
    setExpandedId(null);
  }

  // ═══════════════════════════════════════════
  // Rendus des vues
  // ═══════════════════════════════════════════

  function renderTimeline() {
    return (
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={[s.tlWrap, { height: TOTAL_H }]}>
          {HOURS.map(h => (
            <View key={h} style={[s.hourRow, { top: (h - H_START) * HOUR_H }]}>
              <Text style={s.hourLabel}>{String(h).padStart(2,'0')}:00</Text>
              <View style={s.hourLine} />
            </View>
          ))}

          {appointments.map(appt => {
            const { top, height } = apptLayout(appt);
            const badge = statusBadge(appt.status);
            const expanded = expandedId === appt.id;
            return (
              <TouchableOpacity key={appt.id} activeOpacity={0.85}
                onPress={() => setExpandedId(expanded ? null : appt.id)}
                style={[s.card, { top, minHeight: height, borderLeftColor: statusColor(appt.status) }]}>
                <View style={s.cardMain}>
                  {appt.client_photo_url
                    ? <Image source={{ uri: appt.client_photo_url }} style={s.avatar} />
                    : <View style={s.avatarFb}><Text style={s.avatarTxt}>{initials(appt.client_name)}</Text></View>
                  }
                  <View style={s.cardInfo}>
                    <Text style={s.cardName} numberOfLines={1}>{appt.client_name || 'Client'}</Text>
                    <Text style={s.cardSvc}  numberOfLines={1}>{appt.service || '—'}</Text>
                    <Text style={s.cardTime}>
                      {fmtTime(appt.scheduled_at)} – {fmtTime(endTime(appt.scheduled_at, appt.duration))}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.badgeTxt, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
                {expanded && (
                  <View>
                    {appt.notes ? (
                      <View style={s.notesBox}>
                        <Text style={s.notesLabel}>Notes de la cliente</Text>
                        <Text style={s.notesTxt}>{appt.notes}</Text>
                      </View>
                    ) : null}
                    {appt.reference_url && (
                      <TouchableOpacity
                        onPress={() => setRefViewerUri(appt.reference_url)}
                        style={s.refThumbWrap}>
                        <Image source={{ uri: appt.reference_url }} style={s.refThumb} resizeMode="cover" />
                        <View style={s.refThumbLabel}>
                          <Text style={s.refThumbLabelTxt}>📎 Référence · Appuie pour agrandir</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    <View style={s.actions}>
                      {appt.status === 'pending' && (
                        <TouchableOpacity style={[s.actBtn, s.actConfirm]}
                          onPress={() => updateStatus(appt.id, 'confirmed')}>
                          <Text style={[s.actTxt, { color: '#7C3D8F' }]}>✓ Confirmer</Text>
                        </TouchableOpacity>
                      )}
                      {appt.status === 'confirmed' && (
                        <TouchableOpacity style={[s.actBtn, s.actDone]}
                          onPress={() => updateStatus(appt.id, 'done')}>
                          <Text style={[s.actTxt, { color: '#A8852A' }]}>✂ Terminer</Text>
                        </TouchableOpacity>
                      )}
                      {(appt.status === 'confirmed' || appt.status === 'pending') && (
                        <TouchableOpacity style={[s.actBtn, s.actCancel]}
                          onPress={() => updateStatus(appt.id, 'cancelled')}>
                          <Text style={[s.actTxt, { color: '#C0392B' }]}>✕ Annuler</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {appointments.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>📅</Text>
              <Text style={s.emptyTitle}>Aucun RDV ce jour</Text>
              <Text style={s.emptySub}>Aucun rendez-vous programmé</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── liste groupée par jour (semaine & mois)
  function renderGroupedAppts(appts, emptyMsg) {
    if (appts.length === 0) {
      return <Text style={s.moisEmpty}>{emptyMsg}</Text>;
    }
    const grouped = {};
    const order   = [];
    appts.forEach(a => {
      const d = localDate(a.scheduled_at);  // date locale
      if (!grouped[d]) { grouped[d] = []; order.push(d); }
      grouped[d].push(a);
    });
    return order.map(dateKey => (
      <View key={dateKey}>
        <Text style={s.groupDateHeader}>
          {new Date(dateKey + 'T12:00:00')
            .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
            .replace(/^./, c => c.toUpperCase())}
          {unavailable.includes(dateKey) ? '  ·  Indisponible' : ''}
        </Text>
        {grouped[dateKey].map(appt => {
          const badge    = statusBadge(appt.status);
          const expanded = expandedId === appt.id;
          return (
            <TouchableOpacity key={appt.id}
              style={[s.moisCard, { borderLeftColor: statusColor(appt.status) }]}
              onPress={() => setExpandedId(expanded ? null : appt.id)}
              activeOpacity={0.85}>
              <View style={s.cardMain}>
                {appt.client_photo_url
                  ? <Image source={{ uri: appt.client_photo_url }} style={s.moisAvatar} />
                  : <View style={s.moisAvatarFb}><Text style={s.moisAvatarTxt}>{initials(appt.client_name)}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={s.moisName}>{appt.client_name || 'Client'}</Text>
                  <Text style={s.moisSvc}>{appt.service || '—'}</Text>
                  <Text style={s.moisTime}>
                    {fmtTime(appt.scheduled_at)} – {fmtTime(endTime(appt.scheduled_at, appt.duration))}
                  </Text>
                </View>
                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.badgeTxt, { color: badge.text }]}>{badge.label}</Text>
                </View>
              </View>
              {expanded && (
                <View>
                  {appt.notes ? (
                    <View style={s.notesBox}>
                      <Text style={s.notesLabel}>Notes de la cliente</Text>
                      <Text style={s.notesTxt}>{appt.notes}</Text>
                    </View>
                  ) : null}
                  {appt.reference_url && (
                    <TouchableOpacity
                      onPress={() => setRefViewerUri(appt.reference_url)}
                      style={s.refThumbWrap}>
                      <Image source={{ uri: appt.reference_url }} style={s.refThumb} resizeMode="cover" />
                      <View style={s.refThumbLabel}>
                        <Text style={s.refThumbLabelTxt}>📎 Référence · Appuie pour agrandir</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={s.actions}>
                    {appt.status === 'pending' && (
                      <TouchableOpacity style={[s.actBtn, s.actConfirm]}
                        onPress={() => updateStatus(appt.id, 'confirmed')}>
                        <Text style={[s.actTxt, { color: '#7C3D8F' }]}>✓ Confirmer</Text>
                      </TouchableOpacity>
                    )}
                    {appt.status === 'confirmed' && (
                      <TouchableOpacity style={[s.actBtn, s.actDone]}
                        onPress={() => updateStatus(appt.id, 'done')}>
                        <Text style={[s.actTxt, { color: '#A8852A' }]}>✂ Terminer</Text>
                      </TouchableOpacity>
                    )}
                    {(appt.status === 'confirmed' || appt.status === 'pending') && (
                      <TouchableOpacity style={[s.actBtn, s.actCancel]}
                        onPress={() => updateStatus(appt.id, 'cancelled')}>
                        <Text style={[s.actTxt, { color: '#C0392B' }]}>✕ Annuler</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    ));
  }

  function renderSemaine() {
    const weekDays = getWeekDays(selectedDate);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Bande 7 jours */}
        <View style={s.weekStrip}>
          {weekDays.map((d, i) => {
            const isSelected = d === selectedDate;
            const isToday    = d === today;
            const hasAppts   = !!apptByDate[d];
            const isUnavail  = unavailable.includes(d);
            const num = d.split('-')[2];
            return (
              <TouchableOpacity key={d} style={[
                s.weekDay,
                isSelected && s.weekDayActive,
                isUnavail  && !isSelected && s.weekDayUnavail,
              ]} onPress={() => setSelectedDate(d)}>
                <Text style={[s.weekDow, isSelected && s.weekDowActive]}>{DOW_SHORT[i]}</Text>
                <Text style={[s.weekNum, isSelected && s.weekNumActive, isToday && !isSelected && s.weekNumToday]}>
                  {num}
                </Text>
                {hasAppts && <View style={[s.weekDot, isSelected && s.weekDotActive]} />}
                {isUnavail && !isSelected && <Text style={s.unavailX}>—</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Tous les RDV de la semaine groupés par jour */}
        <View style={s.moisDaySection}>
          <Text style={s.periodTitle}>RDV de la semaine</Text>
          {renderGroupedAppts(allPeriodAppts, 'Aucun rendez-vous cette semaine')}
        </View>
      </ScrollView>
    );
  }

  function renderMois() {
    const weeks = getMonthWeeks(selectedDate);
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Entête jours */}
        <View style={s.calHeader}>
          {DOW_SHORT.map(d => (
            <Text key={d} style={s.calHeaderTxt}>{d}</Text>
          ))}
        </View>
        {/* Grille */}
        {weeks.map((week, wi) => (
          <View key={wi} style={s.calRow}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={s.calCell} />;
              const isSelected  = d === selectedDate;
              const isToday     = d === today;
              const count       = apptByDate[d] || 0;
              const isUnavail   = unavailable.includes(d);
              const num = d.split('-')[2];
              return (
                <TouchableOpacity key={d} style={[
                  s.calCell,
                  isSelected  && s.calCellActive,
                  isUnavail   && !isSelected && s.calCellUnavail,
                  isToday     && !isSelected && s.calCellToday,
                ]} onPress={() => setSelectedDate(d)}>
                  <Text style={[
                    s.calNum,
                    isSelected && s.calNumActive,
                    isToday    && !isSelected && s.calNumToday,
                    isUnavail  && !isSelected && s.calNumUnavail,
                  ]}>{num}</Text>
                  {count > 0 && (
                    <View style={s.calDots}>
                      {Array.from({ length: Math.min(count, 3) }).map((_, k) => (
                        <View key={k} style={[s.calDot, isSelected && s.calDotActive]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Tous les RDV du mois groupés par jour */}
        <View style={s.moisDaySection}>
          <Text style={s.periodTitle}>RDV du mois</Text>
          {renderGroupedAppts(allPeriodAppts, 'Aucun rendez-vous ce mois')}
        </View>
      </ScrollView>
    );
  }

  // ═══════════════════════════════════════════
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.wallpaper}>
        <View style={s.blob1} /><View style={s.blob2} />
        <View style={s.blob3} /><View style={s.blob4} />
      </View>

      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Agenda</Text>
        <View style={s.headerRight}>
          {/* Bouton + */}
          <TouchableOpacity style={s.addBtn}
            onPress={() => navigation.navigate('BookAppointment', { barberId, isBarber: true })}>
            <Text style={s.addBtnTxt}>+</Text>
          </TouchableOpacity>
          {/* Bouton ··· */}
          <TouchableOpacity style={s.menuBtn} onPress={() => setMenuVisible(true)}>
            <View style={s.dot} /><View style={s.dot} /><View style={s.dot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEGMENT */}
      <View style={s.segment}>
        {['jour','semaine','mois'].map(v => (
          <TouchableOpacity key={v}
            style={[s.segTab, view === v && s.segTabActive]}
            onPress={() => setView(v)}>
            <Text style={[s.segLabel, view === v && s.segLabelActive]}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* DATE NAV */}
      <View style={s.dateNav}>
        <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtn}>
          <Text style={s.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.dateLabel} numberOfLines={1}>{fmtLabel(selectedDate, view)}</Text>
        <TouchableOpacity onPress={() => navigate(+1)} style={s.navBtn}>
          <Text style={s.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Badge indisponible (vue jour) */}
      {view === 'jour' && isUnavailable && (
        <View style={s.unavailBanner}>
          <Text style={s.unavailBannerTxt}>🔒 Ce jour est marqué indisponible</Text>
        </View>
      )}

      {/* CONTENU */}
      {view === 'jour'    && renderTimeline()}
      {view === 'semaine' && renderSemaine()}
      {view === 'mois'    && renderMois()}

      {/* MENU MODAL */}
      <Modal visible={menuVisible} transparent animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={s.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.menuBox}>
                <Text style={s.menuDateLabel}>
                  {new Date(selectedDate + 'T12:00:00')
                    .toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
                    .replace(/^./, c => c.toUpperCase())}
                </Text>
                <View style={s.menuDivider} />
                <TouchableOpacity style={s.menuItem} onPress={toggleUnavailable}>
                  <Text style={s.menuItemIcon}>{isUnavailable ? '✅' : '🔒'}</Text>
                  <Text style={[s.menuItemTxt, isUnavailable && { color: '#7C3D8F' }]}>
                    {isUnavailable ? 'Rendre disponible' : 'Marquer indisponible'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('BookAppointment', { barberId, isBarber: true });
                  }}>
                  <Text style={s.menuItemIcon}>➕</Text>
                  <Text style={s.menuItemTxt}>Nouveau rendez-vous</Text>
                </TouchableOpacity>
                <View style={s.menuDivider} />
                <TouchableOpacity style={s.menuItem} onPress={() => setMenuVisible(false)}>
                  <Text style={[s.menuItemTxt, { color: 'rgba(28,28,30,0.4)', textAlign: 'center', flex: 1 }]}>
                    Fermer
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <CoiffeuseTabBar active="Agenda" navigation={navigation} />

      {/* ── MODAL PLEIN ÉCRAN RÉFÉRENCE ── */}
      <Modal
        visible={!!refViewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setRefViewerUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          {refViewerUri && (
            <Image
              source={{ uri: refViewerUri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            onPress={() => setRefViewerUri(null)}
            style={{ position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color: '#fff', fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 16 }}>
            Photo de référence de la cliente
          </Text>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1 },
  wallpaper: { position: 'absolute', inset: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.18)' },
  blob2: { position: 'absolute', top: 350, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', bottom: 100, right: -30, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(124,61,143,0.12)' },
  blob4: { position: 'absolute', bottom: 340, left: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(100,180,130,0.08)' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3D8F', alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { fontSize: 22, color: '#fff', lineHeight: 26, marginTop: -1 },
  menuBtn: { flexDirection: 'row', gap: 4, padding: 8 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#1C1C1E' },

  // Segment
  segment: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: 'rgba(190,160,215,0.22)', borderRadius: 14, padding: 3, marginBottom: 12 },
  segTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 11 },
  segTabActive: { backgroundColor: '#7C3D8F' },
  segLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(28,28,30,0.45)' },
  segLabelActive: { color: '#fff' },

  // Date nav
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navArrow: { fontSize: 28, color: '#1C1C1E', lineHeight: 32 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: '#1C1C1E', flex: 1, textAlign: 'center' },

  // Bannière indisponible
  unavailBanner: { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(192,57,43,0.08)', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 0.5, borderColor: 'rgba(192,57,43,0.2)' },
  unavailBannerTxt: { fontSize: 12, color: '#C0392B', fontWeight: '600', textAlign: 'center' },

  // Timeline
  tlWrap: { position: 'relative', marginLeft: 12, marginRight: 12 },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  hourLabel: { width: 46, fontSize: 11, fontWeight: '500', color: 'rgba(28,28,30,0.38)', textAlign: 'right', paddingRight: 10 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(28,28,30,0.1)' },

  // Carte RDV
  card: { position: 'absolute', left: 54, right: 0, backgroundColor: '#fff', borderRadius: 14, borderLeftWidth: 4, paddingHorizontal: 10, paddingVertical: 10, shadowColor: '#1C1C1E', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  avatarFb: { width: 40, height: 40, borderRadius: 20, flexShrink: 0, backgroundColor: 'rgba(124,61,143,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#7C3D8F' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  cardSvc: { fontSize: 12, color: 'rgba(28,28,30,0.55)', marginTop: 1 },
  cardTime: { fontSize: 11, color: 'rgba(28,28,30,0.42)', marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },

  // Référence photo dans la carte
  refThumbWrap:  { marginTop: 10, borderRadius: 10, overflow: 'hidden', height: 160 },
  refThumb:      { width: '100%', height: '100%' },
  refThumbLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', padding: 6 },
  refThumbLabelTxt: { fontSize: 10, color: '#fff', fontWeight: '600', textAlign: 'center' },

  // Actions dépliables
  actions: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(28,28,30,0.08)' },
  actBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5 },
  actConfirm: { backgroundColor: 'rgba(124,61,143,0.1)', borderColor: 'rgba(124,61,143,0.3)' },
  actDone:    { backgroundColor: 'rgba(168,133,42,0.1)', borderColor: 'rgba(168,133,42,0.25)' },
  actCancel:  { backgroundColor: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.2)' },
  actTxt: { fontSize: 11, fontWeight: '700' },

  // Vide
  empty: { position: 'absolute', top: 100, left: 54, right: 0, alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 32, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  emptySub: { fontSize: 12, color: 'rgba(28,28,30,0.4)', marginTop: 4 },

  // Semaine strip
  weekStrip: { flexDirection: 'row', paddingHorizontal: 12, gap: 4, marginBottom: 10 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.9)' },
  weekDayActive: { backgroundColor: '#7C3D8F', borderColor: '#7C3D8F' },
  weekDayUnavail: { backgroundColor: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.2)' },
  weekDow: { fontSize: 9, fontWeight: '600', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase' },
  weekDowActive: { color: 'rgba(255,255,255,0.7)' },
  weekNum: { fontSize: 16, fontWeight: '700', color: '#1C1C1E', marginTop: 2 },
  weekNumActive: { color: '#fff' },
  weekNumToday: { color: '#7C3D8F' },
  weekDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7C3D8F', marginTop: 3 },
  weekDotActive: { backgroundColor: 'rgba(255,255,255,0.8)' },
  unavailX: { fontSize: 9, color: '#C0392B', fontWeight: '700', marginTop: 2 },

  // Calendrier mois
  calHeader: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  calHeaderTxt: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase' },
  calRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 4 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10 },
  calCellActive: { backgroundColor: '#7C3D8F' },
  calCellToday: { backgroundColor: 'rgba(124,61,143,0.1)' },
  calCellUnavail: { backgroundColor: 'rgba(192,57,43,0.08)' },
  calNum: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  calNumActive: { color: '#fff' },
  calNumToday: { color: '#7C3D8F' },
  calNumUnavail: { color: '#C0392B', textDecorationLine: 'line-through' },
  calDots: { flexDirection: 'row', gap: 2, marginTop: 3 },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#7C3D8F' },
  calDotActive: { backgroundColor: 'rgba(255,255,255,0.8)' },

  // Section période (semaine & mois)
  moisDaySection: { marginTop: 16, paddingHorizontal: 16 },
  periodTitle: { fontSize: 11, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  groupDateHeader: { fontSize: 13, fontWeight: '700', color: '#7C3D8F', marginTop: 12, marginBottom: 6 },
  moisDayTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 10 },
  moisEmpty: { fontSize: 13, color: 'rgba(28,28,30,0.4)', fontStyle: 'italic', paddingVertical: 12 },
  moisCard: { backgroundColor: '#fff', borderRadius: 12, borderLeftWidth: 4, padding: 10, marginBottom: 8, shadowColor: '#1C1C1E', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 2 },
  moisAvatar: { width: 36, height: 36, borderRadius: 18 },
  moisAvatarFb: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,61,143,0.14)', alignItems: 'center', justifyContent: 'center' },
  moisAvatarTxt: { fontSize: 12, fontWeight: '700', color: '#7C3D8F' },
  moisName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  moisSvc: { fontSize: 11, color: 'rgba(28,28,30,0.55)', marginTop: 1 },
  moisTime: { fontSize: 11, color: 'rgba(28,28,30,0.42)', marginTop: 2 },

  // Notes
  notesBox:   { marginTop: 10, backgroundColor: 'rgba(168,133,42,0.07)', borderRadius: 8, padding: 8, borderWidth: 0.5, borderColor: 'rgba(168,133,42,0.2)' },
  notesLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(28,28,30,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  notesTxt:   { fontSize: 12, color: '#1C1C1E', lineHeight: 17 },

  // Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 16 },
  menuBox: { backgroundColor: '#fff', borderRadius: 16, width: 240, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16, elevation: 10 },
  menuDateLabel: { fontSize: 12, color: 'rgba(28,28,30,0.4)', fontWeight: '600', paddingHorizontal: 16, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(28,28,30,0.1)', marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemIcon: { fontSize: 16 },
  menuItemTxt: { fontSize: 15, color: '#1C1C1E', fontWeight: '500' },
});
