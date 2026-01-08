import { supabase } from './supabase';

export const authService = {
  // ==================== REGISTRO ====================
  async register({ email, password, nome, cotas }) {
    // 1. Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          cotas
        }
      }
    });

    if (authError) throw authError;

    // 2. Criar registro na tabela cotistas
    if (authData.user) {
      const { error: cotistaError } = await supabase
        .from('cotistas')
        .insert({
          user_id: authData.user.id,
          nome,
          email,
          cotas: cotas || 1,
          is_admin: false,
          status: 'ativo'
        });

      if (cotistaError) {
        console.error('Erro ao criar cotista:', cotistaError);
        // Não falha o registro, apenas loga
      }
    }

    return authData;
  },

  // ==================== LOGIN ====================
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Buscar dados do cotista
    if (data.user) {
      const { data: cotista } = await supabase
        .from('cotistas')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      return { ...data, cotista };
    }

    return data;
  },

  // ==================== LOGIN POR NOME (Legado) ====================
  async loginByName(nome, senha) {
    // Buscar cotista pelo nome
    const { data: cotista, error } = await supabase
      .from('cotistas')
      .select('*')
      .ilike('nome', nome)
      .single();

    if (error || !cotista) {
      throw new Error('Usuário não encontrado');
    }

    // Se o cotista tem email, tentar login normal
    if (cotista.email) {
      return this.login(cotista.email, senha);
    }

    // Caso contrário, criar um email temporário e vincular
    // (Modo de transição para usuários antigos)
    const tempEmail = `${nome.toLowerCase().replace(/\s+/g, '.')}@caixinha.local`;
    
    try {
      // Tentar login com email temporário
      return await this.login(tempEmail, senha);
    } catch {
      // Se não existe, criar a conta
      const { data: authData } = await supabase.auth.signUp({
        email: tempEmail,
        password: senha
      });

      if (authData?.user) {
        // Vincular ao cotista existente
        await supabase
          .from('cotistas')
          .update({ 
            user_id: authData.user.id,
            email: tempEmail 
          })
          .eq('id', cotista.id);
      }

      return { user: authData?.user, cotista };
    }
  },

  // ==================== LOGOUT ====================
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // ==================== SESSÃO ATUAL ====================
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  // ==================== USUÁRIO ATUAL ====================
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    if (user) {
      // Buscar dados do cotista
      const { data: cotista } = await supabase
        .from('cotistas')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return { user, cotista };
    }

    return null;
  },

  // ==================== ALTERAR SENHA ====================
  async changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  },

  // ==================== RESETAR SENHA ====================
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) throw error;
  },

  // ==================== LISTENER DE AUTH ====================
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

export default authService;
