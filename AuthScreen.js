import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, TextInput, Alert, Keyboard, ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { supabase } from './supabase';

export default function AuthScreen({ navigation, onGuestMode }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  const [barberType, setBarberType] = useState('independante'); // 'independante' | 'employee' | 'gerante'
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    Keyboard.dismiss();
    if (!email || !password) {
      Alert.alert('Erreur', 'Email et mot de passe requis');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        Alert.alert('Erreur', 'Le prénom est requis');
        return;
      }
      if (role === 'coiffeuse' && barberType === 'employee' && !inviteCode.trim()) {
        Alert.alert('Erreur', "Le code d'invitation est requis");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Valider le code d'invitation AVANT de créer le compte
        let inviteData = null;
        if (role === 'coiffeuse' && barberType === 'employee') {
          const { data: invite } = await supabase
            .from('salon_invites')
            .select('id, salon_id')
            .eq('code', inviteCode.trim().toUpperCase())
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          if (!invite) {
            Alert.alert('Code invalide', "Ce code est invalide ou a déjà été utilisé.");
            setLoading(false);
            return;
          }
          inviteData = invite;
        }

        // Créer le compte auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim(), role, barber_type: role === 'coiffeuse' ? barberType : null } },
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (!userId) return; // confirmation email requise

        if (role === 'coiffeuse') {
          if (barberType === 'independante') {
            await supabase.from('coiffeuses').insert({
              user_id:      userId,
              name:         name.trim(),
              profile_type: 'independante',
              role:         'coiffeuse',
            });
          } else if (barberType === 'gerante') {
            // Pas d'INSERT ici — CreateSalonScreen crée le salon + la coiffeuse
          } else {
            // employee — lié au salon via invitation
            await supabase.from('coiffeuses').insert({
              user_id:      userId,
              name:         name.trim(),
              salon_id:     inviteData.salon_id,
              role:         'coiffeuse',
              profile_type: 'employee',
            });
            await supabase
              .from('salon_invites')
              .update({ is_used: true })
              .eq('id', inviteData.id);
          }
        }
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  const isBarberSignup = mode === 'signup' && role === 'coiffeuse';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.wallpaper}>
        <View style={styles.blob1} />
        <View style={styles.blob2} />
        <View style={styles.blob3} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* LOGO */}
        <View style={styles.logoSection}>
          <Text style={styles.logoEmoji}>👑</Text>
          <Text style={styles.logoTitle}>
            Fresh<Text style={styles.gold}>Girlz</Text>
          </Text>
          <Text style={styles.logoSub}>
            {mode === 'login' ? 'Contente de te revoir ✨' : 'Rejoins la communauté afro 💅'}
          </Text>
        </View>

        {/* FORMULAIRE */}
        <BlurView intensity={65} tint="light" style={styles.form} pointerEvents="box-none">

          {/* TOGGLE LOGIN / SIGNUP */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
              onPress={() => setMode('login')}>
              <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
                Connexion
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
              onPress={() => setMode('signup')}>
              <Text style={[styles.modeBtnText, mode === 'signup' && styles.modeBtnTextActive]}>
                Inscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* PRÉNOM */}
          {mode === 'signup' && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Prénom</Text>
              <TextInput
                style={styles.input}
                placeholder="Ton prénom"
                placeholderTextColor="rgba(28,28,30,0.3)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* EMAIL */}
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="ton@email.com"
              placeholderTextColor="rgba(28,28,30,0.3)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* MOT DE PASSE */}
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="rgba(28,28,30,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* RÔLE */}
          {mode === 'signup' && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Tu es...</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'client' && styles.roleBtnActive]}
                  onPress={() => setRole('client')}>
                  <Text style={styles.roleEmoji}>💅</Text>
                  <Text style={[styles.roleBtnText, role === 'client' && styles.roleBtnTextActive]}>
                    Cliente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, role === 'coiffeuse' && styles.roleBtnActive]}
                  onPress={() => setRole('coiffeuse')}>
                  <Text style={styles.roleEmoji}>✂️</Text>
                  <Text style={[styles.roleBtnText, role === 'coiffeuse' && styles.roleBtnTextActive]}>
                    Coiffeuse
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* SOUS-TYPE Coiffeuse */}
          {isBarberSignup && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Ton profil</Text>
              <View style={styles.barberTypeCol}>
                <TouchableOpacity
                  style={[styles.barberTypeBtn, barberType === 'independante' && styles.barberTypeBtnActive]}
                  onPress={() => setBarberType('independante')}
                  activeOpacity={0.8}>
                  <Text style={styles.barberTypeIcon}>💅</Text>
                  <View style={styles.barberTypeTxtWrap}>
                    <Text style={[styles.barberTypeTitle, barberType === 'independante' && styles.barberTypeTitleActive]}>
                      Indépendante
                    </Text>
                    <Text style={styles.barberTypeSub}>À domicile, chez toi ou en déplacement</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.barberTypeBtn, barberType === 'employee' && styles.barberTypeBtnActive]}
                  onPress={() => setBarberType('employee')}
                  activeOpacity={0.8}>
                  <Text style={styles.barberTypeIcon}>✂️</Text>
                  <View style={styles.barberTypeTxtWrap}>
                    <Text style={[styles.barberTypeTitle, barberType === 'employee' && styles.barberTypeTitleActive]}>
                      En salon
                    </Text>
                    <Text style={styles.barberTypeSub}>Employée ou freelance dans un salon</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.barberTypeBtn, barberType === 'gerante' && styles.barberTypeBtnActive]}
                  onPress={() => setBarberType('gerante')}
                  activeOpacity={0.8}>
                  <Text style={styles.barberTypeIcon}>🏪</Text>
                  <View style={styles.barberTypeTxtWrap}>
                    <Text style={[styles.barberTypeTitle, barberType === 'gerante' && styles.barberTypeTitleActive]}>
                      Gérante de salon
                    </Text>
                    <Text style={styles.barberTypeSub}>Créer et gérer mon salon</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CODE D'INVITATION — Coiffeuse en salon */}
          {isBarberSignup && barberType === 'employee' && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputLabel}>Code d'invitation</Text>
              <TextInput
                style={[styles.input, styles.inputCode]}
                placeholder="Ex : ABC123"
                placeholderTextColor="rgba(28,28,30,0.3)"
                value={inviteCode}
                onChangeText={v => setInviteCode(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
              />
              <Text style={styles.inputHint}>
                Demande ce code au gérant de ton salon
              </Text>
            </View>
          )}

          {/* BOUTON PRINCIPAL */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnLoading]}
            onPress={handleAuth}
            disabled={loading}>
            <Text style={styles.submitBtnText}>
              {loading ? '⏳ Chargement...' :
               mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
            </Text>
          </TouchableOpacity>

          {/* MOT DE PASSE OUBLIÉ */}
          {mode === 'login' && (
            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotBtnText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

        </BlurView>

        {/* CONTINUER SANS COMPTE */}
        <TouchableOpacity style={styles.skipBtn} onPress={onGuestMode}>
          <Text style={styles.skipBtnText}>Continuer sans compte →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20, justifyContent: 'center', paddingBottom: 40 },
  wallpaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FAF4F8' },
  blob1: { position: 'absolute', top: -40, right: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(168,133,42,0.2)' },
  blob2: { position: 'absolute', bottom: 100, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(201,80,122,0.12)' },
  blob3: { position: 'absolute', top: 300, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124,61,143,0.12)' },

  logoSection: { alignItems: 'center', marginBottom: 28 },
  logoEmoji: { fontSize: 48, marginBottom: 8 },
  logoTitle: { fontSize: 36, fontWeight: '800', color: '#1C1C1E', letterSpacing: -1.5 },
  gold: { color: '#7C3D8F' },
  logoSub: { fontSize: 15, color: 'rgba(28,28,30,0.5)', marginTop: 5 },

  form: { borderRadius: 22, overflow: 'hidden', padding: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.85)', marginBottom: 14 },

  modeRow: { flexDirection: 'row', backgroundColor: 'rgba(28,28,30,0.06)', borderRadius: 14, padding: 3, marginBottom: 20 },
  modeBtn: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(28,28,30,0.45)' },
  modeBtnTextActive: { color: '#1C1C1E' },

  inputWrap: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(28,28,30,0.5)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 7 },
  input: { backgroundColor: 'rgba(28,28,30,0.05)', borderRadius: 13, padding: 13, fontSize: 15, color: '#1C1C1E', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  inputCode: { textAlign: 'center', fontSize: 22, fontWeight: '700', letterSpacing: 6 },
  inputHint: { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginTop: 5, textAlign: 'center' },

  // RÔLE CLIENT / Coiffeuse
  roleRow: { flexDirection: 'row', gap: 8 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12, borderRadius: 13, backgroundColor: 'rgba(28,28,30,0.05)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)' },
  roleBtnActive: { backgroundColor: 'rgba(124,61,143,0.12)', borderColor: 'rgba(124,61,143,0.35)' },
  roleEmoji: { fontSize: 18 },
  roleBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(28,28,30,0.5)' },
  roleBtnTextActive: { color: '#7C3D8F' },

  // SOUS-TYPE Coiffeuse
  barberTypeCol: { gap: 8 },
  barberTypeBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(28,28,30,0.04)', borderWidth: 0.5, borderColor: 'rgba(28,28,30,0.1)', gap: 12 },
  barberTypeBtnActive: { backgroundColor: 'rgba(124,61,143,0.1)', borderColor: 'rgba(124,61,143,0.35)' },
  barberTypeIcon: { fontSize: 24 },
  barberTypeTxtWrap: { flex: 1 },
  barberTypeTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(28,28,30,0.5)' },
  barberTypeTitleActive: { color: '#7C3D8F' },
  barberTypeSub: { fontSize: 11, color: 'rgba(28,28,30,0.4)', marginTop: 2 },

  submitBtn: { backgroundColor: 'rgba(28,28,30,0.88)', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 6 },
  submitBtnLoading: { opacity: 0.6 },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  forgotBtn: { alignItems: 'center', marginTop: 12 },
  forgotBtnText: { fontSize: 13, color: 'rgba(28,28,30,0.45)' },
  skipBtn: { alignItems: 'center', padding: 12 },
  skipBtnText: { fontSize: 14, color: 'rgba(28,28,30,0.45)', fontWeight: '500' },
});

