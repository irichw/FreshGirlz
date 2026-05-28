import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Remplace ces valeurs par les credentials de ton projet Supabase FreshGirlz
// Créer un nouveau projet sur https://supabase.com et copie l'URL + la clé anon ici
const SUPABASE_URL = 'https://wpqivrznmuqzidpcaala.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rduw29PC4lztle2z88iZKA_d8CdU8Z5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

