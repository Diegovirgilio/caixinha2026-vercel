import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Credenciais do Supabase não configuradas!');
  console.error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

// Cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Variável de conveniência
export const isSupabaseConfigured = true;

// Verificar conexão
export const checkConnection = async () => {
  try {
    const { error } = await supabase.from('configuracoes').select('count').limit(1);
    if (error) {
      console.error('Erro de conexão:', error.message);
      return false;
    }
    console.log('✅ Conectado ao Supabase');
    return true;
  } catch (error) {
    console.error('Erro ao verificar conexão:', error);
    return false;
  }
};

export default supabase;
