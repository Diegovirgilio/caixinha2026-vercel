import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Credenciais do Supabase não configuradas!');
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

// Cliente Supabase — com fallback para evitar crash no bundle
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const checkConnection = async () => {
  if (!supabase) {
    console.error('Supabase não inicializado — variáveis de ambiente ausentes');
    return false;
  }
  try {
    const { error } = await supabase.from('configuracoes').select('count').limit(1);
    if (error) { console.error('Erro de conexão:', error.message); return false; }
    console.log('✅ Conectado ao Supabase');
    return true;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return false;
  }
};

export default supabase;