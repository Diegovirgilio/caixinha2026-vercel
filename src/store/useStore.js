import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { CONFIG } from '../utils/constants';

// ==================== AUTH STORE ====================
export const useAuthStore = create((set, get) => ({
  user: null,
  cotista: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Login com email e senha
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      // Buscar dados do cotista
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas')
        .select('*')
        .eq('user_id', data.user.id)
        .single();
      
      if (cotistaError) throw cotistaError;
      
      set({ user: data.user, cotista, isAuthenticated: true, isLoading: false });
      return { user: data.user, cotista };
    } catch (error) {
      console.error('Erro no login:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Login por nome (busca cotista pelo nome)
  loginByName: async (nome, senha) => {
    set({ isLoading: true, error: null });
    
    try {
      // Buscar cotista pelo nome
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas')
        .select('*')
        .ilike('nome', nome)
        .single();
      
      if (cotistaError || !cotista) {
        throw new Error('Usuário não encontrado');
      }
      
      if (!cotista.email) {
        throw new Error('Este usuário não possui email cadastrado. Faça login com email.');
      }
      
      // Fazer login com o email do cotista
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cotista.email,
        password: senha
      });
      
      if (error) throw error;
      
      set({ user: data.user, cotista, isAuthenticated: true, isLoading: false });
      return { user: data.user, cotista };
    } catch (error) {
      console.error('Erro no login por nome:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Registro de novo usuário
  register: async ({ email, password, nome, cotas }) => {
    set({ isLoading: true, error: null });
    
    try {
      // Verificar se nome já existe
      const { data: existente } = await supabase
        .from('cotistas')
        .select('nome')
        .ilike('nome', nome)
        .single();
      
      if (existente) {
        throw new Error(`Já existe um usuário com o nome "${nome}". Por favor, adicione seu sobrenome para diferenciar.`);
      }
      
      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      });
      
      if (authError) throw authError;
      
      // Criar registro na tabela cotistas (ainda não confirmado)
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas')
        .insert({
          user_id: authData.user?.id,
          nome,
          email,
          cotas: parseInt(cotas) || 1,
          is_admin: false,
          status: 'ativo',
          email_confirmado: false // Só será true após confirmar email
        })
        .select()
        .single();
      
      if (cotistaError) throw cotistaError;
      
      // Gerar mensalidades para o novo cotista
      const mensalidades = CONFIG.MESES.map(mes => ({
        cotista_id: cotista.id,
        mes_referencia: mes,
        valor_devido: (parseInt(cotas) || 1) * CONFIG.VALOR_POR_COTA,
        valor_pago: 0,
        status: 'pendente'
      }));
      
      await supabase.from('mensalidades').insert(mensalidades);
      
      set({ isLoading: false });
      return { user: authData.user, cotista };
    } catch (error) {
      console.error('Erro no registro:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Logout
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, cotista: null, isAuthenticated: false });
  },

  // Verificar autenticação
  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: cotista } = await supabase
          .from('cotistas')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        if (cotista) {
          set({ user: session.user, cotista, isAuthenticated: true });
          return true;
        }
      }
      
      set({ user: null, cotista: null, isAuthenticated: false });
      return false;
    } catch (error) {
      console.error('Erro ao verificar auth:', error);
      set({ user: null, cotista: null, isAuthenticated: false });
      return false;
    }
  },

  clearError: () => set({ error: null })
}));

// ==================== APP STORE ====================
export const useAppStore = create((set, get) => ({
  cotistas: [],
  mensalidades: {},
  emprestimos: [],
  rifas: [],
  cdi: [],
  comprovantes: [],
  comprovantes_pendentes: 0,
  config: { ...CONFIG },
  isLoading: false,
  isOnline: true,

  // ===== COTISTAS =====
  setCotistas: (cotistas) => set({ cotistas }),

  loadCotistas: async () => {
    try {
      // Buscar apenas cotistas com email confirmado (ou criados manualmente pelo admin)
      const { data, error } = await supabase
        .from('cotistas')
        .select('*')
        .or('email_confirmado.eq.true,user_id.is.null')
        .order('nome');
      
      if (error) throw error;
      set({ cotistas: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar cotistas:', error);
      return [];
    }
  },

  // ===== COMPROVANTES =====
  loadComprovantes: async () => {
    try {
      const { data, error } = await supabase
        .from('comprovantes')
        .select(`*, cotista:cotistas!comprovantes_cotista_id_fkey(id, nome, email)`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const pendentes = (data || []).filter(c => c.status === 'pendente').length;
      set({ comprovantes: data || [], comprovantes_pendentes: pendentes });
      return data;
    } catch (error) {
      console.error('Erro ao carregar comprovantes:', error);
      return [];
    }
  },

  enviarComprovante: async (comprovante) => {
    try {
      const { data, error } = await supabase
        .from('comprovantes')
        .insert(comprovante)
        .select()
        .single();
      
      if (error) throw error;
      
      await get().loadComprovantes();
      return data;
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      throw error;
    }
  },

  aprovarComprovante: async (comprovanteId, adminId, valorAprovado) => {
    try {
      // Buscar comprovante
      const { data: comprovante } = await supabase
        .from('comprovantes')
        .select('*')
        .eq('id', comprovanteId)
        .single();
      
      if (!comprovante) throw new Error('Comprovante não encontrado');

      // Atualizar comprovante
      const { error: updateError } = await supabase
        .from('comprovantes')
        .update({
          status: 'aprovado',
          validado_por: adminId,
          data_validacao: new Date().toISOString()
        })
        .eq('id', comprovanteId);
      
      if (updateError) throw updateError;

      // Atualizar mensalidade ou empréstimo
      if (comprovante.tipo === 'mensalidade') {
        const { data: mensalidade } = await supabase
          .from('mensalidades')
          .select('*')
          .eq('id', comprovante.referencia_id)
          .single();
        
        if (mensalidade) {
          const novoValorPago = (mensalidade.valor_pago || 0) + valorAprovado;
          const status = novoValorPago >= mensalidade.valor_devido ? 'pago' : 'parcial';
          
          await supabase
            .from('mensalidades')
            .update({
              valor_pago: novoValorPago,
              status,
              data_pagamento: new Date().toISOString()
            })
            .eq('id', comprovante.referencia_id);
        }
      } else if (comprovante.tipo === 'emprestimo') {
        const { data: emprestimo } = await supabase
          .from('emprestimos')
          .select('*')
          .eq('id', comprovante.referencia_id)
          .single();
        
        if (emprestimo) {
          const novoValorPago = (emprestimo.valor_pago || 0) + valorAprovado;
          const status = novoValorPago >= emprestimo.valor_total ? 'pago' : 'ativo';
          
          await supabase
            .from('emprestimos')
            .update({
              valor_pago: novoValorPago,
              status,
              data_quitacao: status === 'pago' ? new Date().toISOString() : null
            })
            .eq('id', comprovante.referencia_id);
        }
      }

      await get().loadComprovantes();
      await get().loadMensalidades();
      await get().loadEmprestimos();
      return true;
    } catch (error) {
      console.error('Erro ao aprovar comprovante:', error);
      throw error;
    }
  },

  rejeitarComprovante: async (comprovanteId, adminId, motivo) => {
    try {
      const { error } = await supabase
        .from('comprovantes')
        .update({
          status: 'rejeitado',
          motivo_rejeicao: motivo,
          validado_por: adminId,
          data_validacao: new Date().toISOString()
        })
        .eq('id', comprovanteId);
      
      if (error) throw error;
      
      await get().loadComprovantes();
      return true;
    } catch (error) {
      console.error('Erro ao rejeitar comprovante:', error);
      throw error;
    }
  },

  // ===== MENSALIDADES =====
  setMensalidades: (mensalidades) => set({ mensalidades }),

  loadMensalidades: async () => {
    try {
      const { data, error } = await supabase
        .from('mensalidades')
        .select(`*, cotista:cotistas(id, nome, cotas)`)
        .order('mes_referencia');
      
      if (error) throw error;
      
      // Agrupar por mês
      const agrupado = {};
      (data || []).forEach(m => {
        if (!agrupado[m.mes_referencia]) {
          agrupado[m.mes_referencia] = [];
        }
        agrupado[m.mes_referencia].push(m);
      });
      
      set({ mensalidades: agrupado });
      return agrupado;
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
      return {};
    }
  },

  registrarPagamento: async (mensalidadeId, valor) => {
    try {
      // Buscar mensalidade atual
      const { data: atual } = await supabase
        .from('mensalidades')
        .select('*')
        .eq('id', mensalidadeId)
        .single();
      
      if (atual) {
        const novoValorPago = (atual.valor_pago || 0) + valor;
        const status = novoValorPago >= atual.valor_devido ? 'pago' : 'parcial';
        
        const { error } = await supabase
          .from('mensalidades')
          .update({
            valor_pago: novoValorPago,
            status,
            data_pagamento: new Date().toISOString()
          })
          .eq('id', mensalidadeId);
        
        if (!error) {
          await get().loadMensalidades();
        }
      }
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      throw error;
    }
  },

  // ===== EMPRÉSTIMOS =====
  setEmprestimos: (emprestimos) => set({ emprestimos }),

  loadEmprestimos: async () => {
    try {
      const { data, error } = await supabase
        .from('emprestimos')
        .select(`*, cotista:cotistas!emprestimos_cotista_id_fkey(id, nome, cotas)`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      set({ emprestimos: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar empréstimos:', error);
      return [];
    }
  },

  solicitarEmprestimo: async (dados) => {
    try {
      const valorJuros = dados.valor * (dados.taxa_juros / 100);
      const valorTotal = dados.valor + valorJuros;
      
      const { data, error } = await supabase
        .from('emprestimos')
        .insert({
          cotista_id: dados.cotista_id,
          valor_emprestimo: dados.valor,
          tipo: dados.tipo,
          parcelas: dados.tipo === 'parcelado' ? dados.parcelas : 1,
          taxa_juros: dados.taxa_juros,
          valor_juros: valorJuros,
          valor_total: valorTotal,
          valor_parcela: dados.tipo === 'parcelado' ? valorTotal / dados.parcelas : valorTotal,
          motivo: dados.motivo,
          status: 'pendente'
        })
        .select()
        .single();
      
      if (error) throw error;
      await get().loadEmprestimos();
      return data;
    } catch (error) {
      console.error('Erro ao solicitar empréstimo:', error);
      throw error;
    }
  },

  aprovarEmprestimo: async (id, aprovadorId) => {
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({
          status: 'ativo',
          aprovado_por: aprovadorId,
          data_aprovacao: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao aprovar empréstimo:', error);
      throw error;
    }
  },

  rejeitarEmprestimo: async (id) => {
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({ status: 'rejeitado' })
        .eq('id', id);
      
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao rejeitar empréstimo:', error);
      throw error;
    }
  },

  quitarEmprestimo: async (id) => {
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({
          status: 'pago',
          data_quitacao: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao quitar empréstimo:', error);
      throw error;
    }
  },

  // ===== RIFAS =====
  setRifas: (rifas) => set({ rifas }),

  loadRifas: async () => {
    try {
      const { data, error } = await supabase
        .from('rifas')
        .select('*')
        .order('data', { ascending: false });
      
      if (error) throw error;
      set({ rifas: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar rifas:', error);
      return [];
    }
  },

  addRifa: async (rifa) => {
    try {
      const { error } = await supabase
        .from('rifas')
        .insert(rifa);
      
      if (error) throw error;
      await get().loadRifas();
    } catch (error) {
      console.error('Erro ao adicionar rifa:', error);
      throw error;
    }
  },

  // ===== CDI =====
  setCdi: (cdi) => set({ cdi }),

  loadCdi: async () => {
    try {
      const { data, error } = await supabase
        .from('cdi')
        .select('*')
        .order('mes_referencia');
      
      if (error) throw error;
      set({ cdi: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar CDI:', error);
      return [];
    }
  },

  addCdi: async (cdiItem) => {
    try {
      const { error } = await supabase
        .from('cdi')
        .upsert(cdiItem, { onConflict: 'mes_referencia' });
      
      if (error) throw error;
      await get().loadCdi();
    } catch (error) {
      console.error('Erro ao adicionar CDI:', error);
      throw error;
    }
  },

  // ===== INICIALIZAÇÃO =====
  initializeData: () => {
    // Não faz nada - dados vêm do Supabase
  },

  loadAllData: async () => {
    set({ isLoading: true });
    
    try {
      await Promise.all([
        get().loadCotistas(),
        get().loadMensalidades(),
        get().loadEmprestimos(),
        get().loadRifas(),
        get().loadCdi(),
        get().loadComprovantes()
      ]);
      set({ isOnline: true });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      set({ isOnline: false });
    } finally {
      set({ isLoading: false });
    }
  },

  // ===== CÁLCULOS =====
  getTotalCotas: () => {
    const { cotistas } = get();
    return cotistas.reduce((sum, c) => sum + (c.cotas || 0), 0);
  },

  getTotalInvestido: () => {
    const { mensalidades } = get();
    let total = 0;
    Object.values(mensalidades).forEach(mes => {
      if (Array.isArray(mes)) {
        mes.forEach(m => {
          total += Number(m.valor_pago || 0);
        });
      }
    });
    return total;
  },

  getInvestidoByCotista: (cotistaId) => {
    const { mensalidades } = get();
    let total = 0;
    Object.values(mensalidades).forEach(mes => {
      if (Array.isArray(mes)) {
        const registro = mes.find(m => m.cotista_id === cotistaId);
        if (registro) total += Number(registro.valor_pago || 0);
      }
    });
    return total;
  },

  getLimiteEmprestimo: (cotistaId) => {
    const investido = get().getInvestidoByCotista(cotistaId);
    return investido * 0.8;
  }
}));

// ==================== UI STORE ====================
export const useUIStore = create((set) => ({
  showPixModal: false,
  showChangePasswordModal: false,
  showNotifications: false,
  currentTab: '',
  sidebarOpen: true,
  
  setShowPixModal: (show) => set({ showPixModal: show }),
  setShowChangePasswordModal: (show) => set({ showChangePasswordModal: show }),
  setShowNotifications: (show) => set({ showNotifications: show }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open })
}));

export default { useAuthStore, useAppStore, useUIStore };
