import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { CONFIG } from '../utils/constants';

// =====================================================
// AUTH STORE — autenticação e sessão do usuário
// =====================================================
export const useAuthStore = create((set, get) => ({
  user: null,
  cotista: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  // Login com email e senha (admins)
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas').select('*').eq('user_id', data.user.id).single();
      if (cotistaError) throw cotistaError;
      if (cotista.status === 'pendente') {
        await supabase.auth.signOut();
        throw new Error('Seu cadastro ainda não foi aprovado pelo administrador. Aguarde a aprovação.');
      }
      set({ user: data.user, cotista, isAuthenticated: true, isLoading: false });
      return { user: data.user, cotista };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Login por nome — cotistas usam nome + senha em vez de email
  loginByName: async (nome, senha) => {
    set({ isLoading: true, error: null });
    try {
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas').select('*').ilike('nome', nome).single();
      if (cotistaError || !cotista) throw new Error('Usuário não encontrado');
      if (cotista.status === 'pendente') throw new Error('Seu cadastro ainda não foi aprovado pelo administrador. Aguarde a aprovação.');
      if (!cotista.email) throw new Error('Este usuário não possui credenciais. Contate o administrador.');
      const { data, error } = await supabase.auth.signInWithPassword({ email: cotista.email, password: senha });
      if (error) throw error;
      set({ user: data.user, cotista, isAuthenticated: true, isLoading: false });
      return { user: data.user, cotista };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // Registro de novo cotista — status pendente até admin aprovar
  register: async ({ password, nome, cotas, telefone, participa_rifa }) => {
    set({ isLoading: true, error: null });
    try {
      const { data: existenteNome } = await supabase
        .from('cotistas').select('nome').ilike('nome', nome).single();
      if (existenteNome) throw new Error(`Já existe um usuário com o nome "${nome}". Por favor, use nome e sobrenome.`);

      // Email fictício baseado no nome (Supabase Auth exige email)
      const emailFake = `${nome.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: emailFake, password });
      if (authError) throw authError;

      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas')
        .insert({
          user_id: authData.user?.id, nome, email: emailFake,
          cotas: parseInt(cotas) || 1, telefone: telefone || null,
          participa_rifa: participa_rifa || false, is_admin: false, status: 'pendente'
        }).select().single();
      if (cotistaError) throw cotistaError;

      try {
        const { alertaNovoCadastro } = await import('../services/telegram');
        await alertaNovoCadastro(nome, cotas);
      } catch (e) { console.log('Telegram indisponível:', e); }

      set({ isLoading: false });
      return { user: authData.user, cotista };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, cotista: null, isAuthenticated: false });
  },

  // Verifica sessão ativa ao recarregar a página
  checkAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: cotista } = await supabase
          .from('cotistas').select('*').eq('user_id', session.user.id).single();
        if (cotista) {
          set({ user: session.user, cotista, isAuthenticated: true });
          return true;
        }
      }
      set({ user: null, cotista: null, isAuthenticated: false });
      return false;
    } catch (error) {
      set({ user: null, cotista: null, isAuthenticated: false });
      return false;
    }
  },

  clearError: () => set({ error: null })
}));

// =====================================================
// APP STORE — dados principais da caixinha
// =====================================================
export const useAppStore = create((set, get) => ({
  cotistas: [],
  mensalidades: {},       // agrupado por mês: { 'YYYY-MM': [mensalidade, ...] }
  emprestimos: [],
  emprestimos_pendentes: 0,
  cdi: [],
  comprovantes: [],
  comprovantes_pendentes: 0,
  juros_atraso: [],
  juros_emprestimo: [],
  rifaNumeros: [],
  rifaSorteios: [],
  configuracoes: {},
  config: { ...CONFIG },
  isLoading: false,
  isOnline: true,

  // =====================================================
  // CONFIGURAÇÕES
  // =====================================================

  loadConfiguracoes: async () => {
    try {
      const { data, error } = await supabase.from('configuracoes').select('*');
      if (error) throw error;
      // Converte array [{chave, valor}] em objeto {chave: valor}
      const config = {};
      (data || []).forEach(c => { config[c.chave] = c.valor; });
      set({ configuracoes: config });
      return config;
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      return {};
    }
  },

  updateConfiguracao: async (chave, valor) => {
    try {
      const { error } = await supabase
        .from('configuracoes')
        .update({ valor, updated_at: new Date().toISOString() })
        .eq('chave', chave);
      if (error) throw error;
      await get().loadConfiguracoes();
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  },

  // =====================================================
  // COTISTAS
  // =====================================================

  loadCotistas: async () => {
    try {
      const { data, error } = await supabase.from('cotistas').select('*').order('nome');
      if (error) throw error;
      set({ cotistas: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar cotistas:', error);
      return [];
    }
  },

  // =====================================================
  // COMPROVANTES
  // =====================================================

  loadComprovantes: async () => {
    try {
      const { data, error } = await supabase
        .from('comprovantes')
        .select('*, cotista:cotistas!comprovantes_cotista_id_fkey(id, nome, email)')
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
        .from('comprovantes').insert(comprovante).select().single();
      if (error) throw error;
      try {
        const { alertaNovoComprovante } = await import('../services/telegram');
        const cotista = get().cotistas.find(c => c.id === comprovante.cotista_id);
        await alertaNovoComprovante(cotista?.nome || 'Desconhecido', comprovante.valor_informado, comprovante.tipo);
      } catch (e) { console.log('Telegram indisponível:', e); }
      await get().loadComprovantes();
      return data;
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      throw error;
    }
  },

  // Aprovar comprovante — aplica os efeitos no empréstimo ou mensalidade
  aprovarComprovante: async (comprovanteId, adminId, valorAprovado, jurosAtraso = 0) => {
    try {
      const { data: comprovante } = await supabase
        .from('comprovantes').select('*').eq('id', comprovanteId).single();
      if (!comprovante) throw new Error('Comprovante não encontrado');

      // Marca comprovante como aprovado imediatamente
      await supabase.from('comprovantes').update({
        status: 'aprovado', validado_por: adminId, data_validacao: new Date().toISOString()
      }).eq('id', comprovanteId);

      // Verifica duplicata via juros_emprestimo — evita reprocessar se já existe registro
      // Não usa status do comprovante pois o update acima já o alterou para 'aprovado'
      const { data: jurosExistente } = await supabase
        .from('juros_emprestimo')
        .select('id')
        .eq('comprovante_id', comprovanteId)
        .maybeSingle();
      const jaTemAprovado = !!jurosExistente;

      // Registra juros de atraso se houver
      if (jurosAtraso > 0) {
        await supabase.from('juros_atraso').insert({
          cotista_id: comprovante.cotista_id, comprovante_id: comprovanteId,
          tipo: comprovante.tipo, valor_juros: jurosAtraso,
          mes_referencia: comprovante.mes_referencia, registrado_por: adminId
        });
      }

      // Valor efetivo para o cotista (descontando juros de atraso)
      const valorParaCotista = valorAprovado - jurosAtraso;

      // ── MENSALIDADE ──
      if (comprovante.tipo === 'mensalidade') {
        if (!jaTemAprovado) {
          const { data: mensalidade } = await supabase
            .from('mensalidades')
            .select('*, cotista:cotistas(id, cotas, participa_rifa)')
            .eq('id', comprovante.referencia_id).single();

          if (mensalidade) {
            // Valor total inclui rifa se cotista participar
            let valorTotalDevido = Number(mensalidade.valor_devido || 0);
            if (mensalidade.cotista?.participa_rifa) {
              valorTotalDevido += (mensalidade.cotista.cotas || 0) * 20;
            }
            const novoValorPago = (mensalidade.valor_pago || 0) + valorParaCotista;
            const status = novoValorPago >= valorTotalDevido ? 'pago' : 'parcial';
            await supabase.from('mensalidades').update({
              valor_pago: novoValorPago, status, data_pagamento: new Date().toISOString()
            }).eq('id', comprovante.referencia_id);
          }
        }

      // ── EMPRÉSTIMO ──
      } else if (comprovante.tipo === 'emprestimo') {
        if (jaTemAprovado) {
          console.warn('Comprovante já aprovado — processamento do empréstimo ignorado.');
        } else {
          const { data: emprestimo } = await supabase
            .from('emprestimos').select('*').eq('id', comprovante.referencia_id).single();

          if (emprestimo) {
            const modalidade = emprestimo.modalidade || 'normal';
            const principalAtual = Number(emprestimo.principal_restante || emprestimo.valor_emprestimo || 0);

            // Detecta tipo de pagamento pela observação do comprovante
            const obs = comprovante.observacao || '';
            let tipoPagamento = 'quitacao', taxaJuros = 20;
            if (obs.includes('Só Juros'))   { tipoPagamento = 'soJuros'; taxaJuros = 30; }
            else if (obs.includes('Parcial')) { tipoPagamento = 'parcial'; taxaJuros = 30; }

            // Calcula juros e principal abatido conforme tipo
            let valorJuros = 0, principalAbatido = 0;
            let novoPrincipal = principalAtual, novoStatus = 'ativo';

            if (tipoPagamento === 'soJuros') {
              // Paga só juros — principal não muda
              valorJuros = valorParaCotista;

            } else if (tipoPagamento === 'parcial') {
              // Paga juros + parte do principal
              const jurosCalculado = principalAtual * (taxaJuros / 100);
              valorJuros = Math.min(jurosCalculado, valorParaCotista);
              principalAbatido = Math.max(0, valorParaCotista - valorJuros);
              novoPrincipal = Math.max(0, principalAtual - principalAbatido);
              novoStatus = novoPrincipal <= 0 ? 'pago' : 'ativo';

            } else {
              // Quitação total
              valorJuros = principalAtual * (taxaJuros / 100);
              principalAbatido = principalAtual;
              novoPrincipal = 0;
              novoStatus = 'pago';
            }

            // Registra juros — proteção anti-duplicata já garantida pelo jaTemAprovado acima
            if (valorJuros > 0) {
              if (!jaTemAprovado) {
                await supabase.from('juros_emprestimo').insert({
                  emprestimo_id: emprestimo.id, cotista_id: emprestimo.cotista_id,
                  comprovante_id: comprovanteId, modalidade, tipo_pagamento: tipoPagamento,
                  valor_juros: valorJuros, valor_principal_abatido: principalAbatido,
                  taxa_juros: taxaJuros, mes_referencia: new Date().toISOString().slice(0, 7),
                  registrado_por: adminId
                });
              }
            }

            // Avança vencimento em 1 mês mantendo o dia fixo (ex: dia 5 → sempre dia 5)
            // Se data_vencimento for null, usa hoje + 1 mês como base
            let novoVencimento = emprestimo.data_vencimento || null;
            if (novoStatus === 'ativo') {
              // Adiciona T00:00:00 para evitar conversão UTC que causa 1 dia a menos
              const baseStr = emprestimo.data_vencimento
                ? (emprestimo.data_vencimento.includes('T') ? emprestimo.data_vencimento : emprestimo.data_vencimento + 'T00:00:00')
                : new Date().toISOString();
              const base = new Date(baseStr);
              if (!isNaN(base.getTime())) {
                const y = base.getFullYear();
                const m = String(base.getMonth() + 2).padStart(2, '0');
                const d = String(base.getDate()).padStart(2, '0');
                novoVencimento = `${y}-${m}-${d}`;
              }
            }

            // Status do comprovante reflete o tipo para facilitar histórico
            const statusComprovante = tipoPagamento === 'quitacao' ? 'aprovado'
              : tipoPagamento === 'soJuros' ? 'juros' : 'parcial';
            await supabase.from('comprovantes').update({ status: statusComprovante }).eq('id', comprovanteId);

            await supabase.from('emprestimos').update({
              principal_restante: novoPrincipal, status: novoStatus,
              data_quitacao: novoStatus === 'pago' ? new Date().toISOString() : null,
              data_vencimento: novoStatus === 'ativo' ? novoVencimento : emprestimo.data_vencimento
            }).eq('id', comprovante.referencia_id);
          }
        }
      }

      await Promise.all([
        get().loadComprovantes(), get().loadJurosAtraso(),
        get().loadJurosEmprestimo(), get().loadMensalidades(), get().loadEmprestimos()
      ]);
      return true;
    } catch (error) {
      console.error('Erro ao aprovar comprovante:', error);
      throw error;
    }
  },

  // Rejeitar comprovante — desfaz efeitos no empréstimo se já estava processado
  rejeitarComprovante: async (comprovanteId, adminId, motivo) => {
    try {
      const { data: comprovante } = await supabase
        .from('comprovantes').select('*').eq('id', comprovanteId).single();

      // Rollback do empréstimo se comprovante já estava processado
      if (['aprovado', 'juros', 'parcial'].includes(comprovante?.status) && comprovante?.tipo === 'emprestimo') {
        const { data: jurosReg } = await supabase
          .from('juros_emprestimo').select('*').eq('comprovante_id', comprovanteId).maybeSingle();

        if (jurosReg) {
          const { data: emp } = await supabase
            .from('emprestimos').select('*').eq('id', comprovante.referencia_id).single();

          if (emp) {
            // Restaura principal somando o que foi abatido
            const principalRestaurado = Number(emp.principal_restante || 0) + Number(jurosReg.valor_principal_abatido || 0);

            // Recua vencimento em 1 mês (desfaz o avanço da aprovação)
            let vencimentoRestaurado = emp.data_vencimento;
            if (emp.data_vencimento && jurosReg.tipo_pagamento !== 'quitacao') {
              const vStr = emp.data_vencimento.includes('T') ? emp.data_vencimento : emp.data_vencimento + 'T00:00:00';
              const v = new Date(vStr);
              v.setMonth(v.getMonth() - 1);
              vencimentoRestaurado = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
            }

            await supabase.from('emprestimos').update({
              principal_restante: principalRestaurado, status: 'ativo',
              data_quitacao: null, data_vencimento: vencimentoRestaurado
            }).eq('id', comprovante.referencia_id);

            // Remove juros vinculados ao comprovante rejeitado
            await supabase.from('juros_emprestimo').delete().eq('comprovante_id', comprovanteId);
          }
        }
      }

      await supabase.from('comprovantes').update({
        status: 'rejeitado', motivo_rejeicao: motivo,
        validado_por: adminId, data_validacao: new Date().toISOString()
      }).eq('id', comprovanteId);

      await Promise.all([get().loadComprovantes(), get().loadEmprestimos(), get().loadJurosEmprestimo()]);
      return true;
    } catch (error) {
      console.error('Erro ao rejeitar comprovante:', error);
      throw error;
    }
  },

  // =====================================================
  // MENSALIDADES
  // =====================================================

  loadMensalidades: async () => {
    try {
      const { data, error } = await supabase
        .from('mensalidades')
        .select('*, cotista:cotistas(id, nome, cotas)')
        .order('mes_referencia');
      if (error) throw error;
      // Agrupa por mês: { 'YYYY-MM': [...] }
      const agrupado = {};
      (data || []).forEach(m => {
        if (!agrupado[m.mes_referencia]) agrupado[m.mes_referencia] = [];
        agrupado[m.mes_referencia].push(m);
      });
      set({ mensalidades: agrupado });
      return agrupado;
    } catch (error) {
      console.error('Erro ao carregar mensalidades:', error);
      return {};
    }
  },

  // =====================================================
  // EMPRÉSTIMOS
  // =====================================================

  loadEmprestimos: async () => {
    try {
      const { data, error } = await supabase
        .from('emprestimos')
        .select('*, cotista:cotistas!emprestimos_cotista_id_fkey(id, nome, cotas)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const pendentes = (data || []).filter(e => e.status === 'pendente').length;
      set({ emprestimos: data || [], emprestimos_pendentes: pendentes });
      return data;
    } catch (error) {
      console.error('Erro ao carregar empréstimos:', error);
      return [];
    }
  },

  aprovarEmprestimo: async (id, aprovadorId) => {
    try {
      // Vencimento: mesmo dia do mês seguinte — string manual evita bug de timezone UTC
      const hoje = new Date();
      const vencimento = `${hoje.getFullYear()}-${String(hoje.getMonth() + 2).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const { error } = await supabase.from('emprestimos').update({
        status: 'ativo', aprovado_por: aprovadorId,
        data_aprovacao: new Date().toISOString(),
        data_vencimento: vencimento
      }).eq('id', id);
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao aprovar empréstimo:', error);
      throw error;
    }
  },

  rejeitarEmprestimo: async (id) => {
    try {
      const { error } = await supabase.from('emprestimos').update({ status: 'rejeitado' }).eq('id', id);
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao rejeitar empréstimo:', error);
      throw error;
    }
  },

  quitarEmprestimo: async (id) => {
    try {
      const { error } = await supabase.from('emprestimos').update({
        status: 'pago', data_quitacao: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      await get().loadEmprestimos();
    } catch (error) {
      console.error('Erro ao quitar empréstimo:', error);
      throw error;
    }
  },

  // =====================================================
  // CDI
  // =====================================================

  loadCdi: async () => {
    try {
      const { data, error } = await supabase.from('cdi').select('*').order('mes_referencia');
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
      const { error } = await supabase.from('cdi').upsert(cdiItem, { onConflict: 'mes_referencia' });
      if (error) throw error;
      await get().loadCdi();
    } catch (error) {
      console.error('Erro ao adicionar CDI:', error);
      throw error;
    }
  },

  // =====================================================
  // JUROS DE ATRASO — registrado quando mensalidade atrasa
  // =====================================================

  loadJurosAtraso: async () => {
    try {
      const { data, error } = await supabase
        .from('juros_atraso')
        .select('*, cotista:cotistas!juros_atraso_cotista_id_fkey(id, nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ juros_atraso: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar juros por atraso:', error);
      return [];
    }
  },

  registrarJurosAtraso: async (dados) => {
    try {
      const { data, error } = await supabase.from('juros_atraso').insert(dados).select().single();
      if (error) throw error;
      await get().loadJurosAtraso();
      return data;
    } catch (error) {
      console.error('Erro ao registrar juros por atraso:', error);
      throw error;
    }
  },

  // Soma total de juros de atraso (usado no Dashboard e ExtratoCotista)
  getTotalJurosAtraso: () => {
    return (get().juros_atraso || []).reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);
  },

  // =====================================================
  // JUROS DE EMPRÉSTIMO — histórico de pagamentos de juros
  // =====================================================

  loadJurosEmprestimo: async () => {
    try {
      const { data, error } = await supabase
        .from('juros_emprestimo')
        .select('*, cotista:cotistas!juros_emprestimo_cotista_id_fkey(id, nome), emprestimo:emprestimos(id, cotista_id, valor_emprestimo, modalidade)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ juros_emprestimo: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar juros de empréstimo:', error);
      return [];
    }
  },

  // =====================================================
  // HELPERS — utilitários de cálculo compartilhados
  // =====================================================

  // Retorna apenas cotistas não-admin e ativos
  getCotistasAtivos: () => {
    return (get().cotistas || []).filter(c => !c.is_admin && c.status === 'ativo');
  },

  // Total de cotas de cotistas não-admin (base para % de participação)
  getTotalCotas: () => {
    return (get().cotistas || [])
      .filter(c => !c.is_admin)
      .reduce((sum, c) => sum + (c.cotas || 0), 0);
  },

  // Total investido por todos (fallback do Dashboard quando API falha)
  getTotalInvestido: () => {
    const { mensalidades, cotistas } = get();
    const adminIds = (cotistas || []).filter(c => c.is_admin).map(c => c.id);
    return Object.values(mensalidades).flat()
      .filter(m => !adminIds.includes(m.cotista_id))
      .reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
  },

  // Total investido por um cotista específico (só mensalidades, sem rifa)
  // Usa valor_devido para excluir rifa — consistente com ExtratoCotista
  getInvestidoByCotista: (cotistaId) => {
    return Object.values(get().mensalidades)
      .flat()
      .filter(m => m.cotista_id === cotistaId && (m.status === 'pago' || m.status === 'parcial'))
      .reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);
  },

  // Limite disponível para novo empréstimo — desconta empréstimos já ativos da mesma modalidade
  getLimiteEmprestimo: (cotistaId, modalidade = 'normal') => {
    const investido = get().getInvestidoByCotista(cotistaId);
    const { cotistas, emprestimos } = get();
    const cotista = cotistas.find(c => c.id === cotistaId);

    // Percentual configurado por cotista individualmente
    const percentual = modalidade === 'caixinha'
      ? (cotista?.limite_emprestimo_caixinha || 100) / 100
      : (cotista?.limite_emprestimo || 80) / 100;

    const limiteTotal = investido * percentual;
    const emprestimosAtivos = (emprestimos || [])
      .filter(e => e.cotista_id === cotistaId && (e.status === 'ativo' || e.status === 'pendente') && (e.modalidade || 'normal') === modalidade)
      .reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);

    return Math.max(0, limiteTotal - emprestimosAtivos);
  },

  // =====================================================
  // RIFAS — números e sorteios mensais
  // =====================================================

  loadRifaNumeros: async () => {
    try {
      const { data, error } = await supabase
        .from('rifa_numeros').select('*, cotista:cotistas(id, nome)').eq('ativo', true).order('numero');
      if (error) throw error;
      set({ rifaNumeros: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar números da rifa:', error);
      return [];
    }
  },

  loadRifaSorteios: async () => {
    try {
      const { data, error } = await supabase
        .from('rifa_sorteios').select('*, cotista_vencedor:cotistas(id, nome)')
        .order('mes_referencia', { ascending: false });
      if (error) throw error;
      set({ rifaSorteios: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar sorteios:', error);
      return [];
    }
  },

  // Retorna números da rifa de um cotista específico
  getNumerosRifaByCotista: (cotistaId) => {
    return (get().rifaNumeros || []).filter(n => n.cotista_id === cotistaId);
  },

  // Ativa rifa para cotista gerando 5 números únicos por cota
  ativarRifaCotista: async (cotistaId, cotas) => {
    try {
      const quantidade = cotas * 5;
      const existentes = new Set((get().rifaNumeros || []).map(n => n.numero));
      const novos = [];
      while (novos.length < quantidade) {
        const numero = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        if (!existentes.has(numero) && !novos.includes(numero)) novos.push(numero);
      }
      await supabase.from('rifa_numeros').insert(novos.map(numero => ({ cotista_id: cotistaId, numero, ativo: true })));
      await supabase.from('cotistas').update({ participa_rifa: true }).eq('id', cotistaId);
      await Promise.all([get().loadRifaNumeros(), get().loadCotistas()]);
      return novos;
    } catch (error) {
      console.error('Erro ao ativar rifa:', error);
      throw error;
    }
  },

  // Desativa rifa removendo todos os números do cotista
  desativarRifaCotista: async (cotistaId) => {
    try {
      await supabase.from('rifa_numeros').delete().eq('cotista_id', cotistaId);
      await supabase.from('cotistas').update({ participa_rifa: false }).eq('id', cotistaId);
      await Promise.all([get().loadRifaNumeros(), get().loadCotistas()]);
    } catch (error) {
      console.error('Erro ao desativar rifa:', error);
      throw error;
    }
  },

  // Ajusta números quando cotista muda quantidade de cotas
  ajustarNumerosRifa: async (cotistaId, cotasAntigas, cotasNovas) => {
    try {
      const numerosAtuais = get().getNumerosRifaByCotista(cotistaId);
      const necessarios = cotasNovas * 5;
      const diferenca = necessarios - numerosAtuais.length;

      if (diferenca > 0) {
        const existentes = new Set((get().rifaNumeros || []).map(n => n.numero));
        const novos = [];
        while (novos.length < diferenca) {
          const numero = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
          if (!existentes.has(numero) && !novos.includes(numero)) novos.push(numero);
        }
        await supabase.from('rifa_numeros').insert(novos.map(numero => ({ cotista_id: cotistaId, numero, ativo: true })));
      } else if (diferenca < 0) {
        // Remove números excedentes mantendo sempre pelo menos 1
        const paraRemover = numerosAtuais
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.min(Math.abs(diferenca), numerosAtuais.length - 1));
        if (paraRemover.length > 0) {
          await supabase.from('rifa_numeros').delete().in('id', paraRemover.map(n => n.id));
        }
      }
      await get().loadRifaNumeros();
    } catch (error) {
      console.error('Erro ao ajustar números:', error);
      throw error;
    }
  },

  // Realiza sorteio mensal baseado no resultado da Loteria Federal
  realizarSorteio: async (mesReferencia, dataSorteio, resultadoFederal) => {
    try {
      const { rifaNumeros, cotistas } = get();
      const participantes = (cotistas || []).filter(c => c.participa_rifa && !c.is_admin);
      let numerosAtivos = [...(rifaNumeros || []).filter(n => n.ativo)];

      const totalCotas = participantes.reduce((sum, c) => sum + (c.cotas || 0), 0);
      const valorArrecadado = totalCotas * 20; // R$20 por cota

      // Verifica vencedores pelos últimos 3 dígitos dos prêmios federais
      const premiosFederal = [
        { nome: 'primeiro', numero: resultadoFederal.primeiro, valor: 200 },
        { nome: 'segundo',  numero: resultadoFederal.segundo,  valor: 100 },
        { nome: 'terceiro', numero: resultadoFederal.terceiro, valor: 50 }
      ];

      const vencedores = [];
      for (const premio of premiosFederal) {
        const ultimos3 = premio.numero.slice(-3).padStart(3, '0');
        const match = numerosAtivos.find(n => n.numero === ultimos3);
        if (match) {
          vencedores.push({ posicao: premio.nome, cotista_id: match.cotista_id, numero: ultimos3, valor: premio.valor });
          numerosAtivos = numerosAtivos.filter(n => n.id !== match.id); // evita ganhar 2x com mesmo número
        }
      }

      const totalPremiosGanhos = vencedores.reduce((sum, v) => sum + v.valor, 0);
      const valorFinalCaixinha = valorArrecadado - totalPremiosGanhos;

      await supabase.from('rifa_sorteios').insert({
        mes_referencia: mesReferencia, data_sorteio: dataSorteio,
        cotista_vencedor_id: vencedores[0]?.cotista_id || null,
        valor_arrecadado: valorArrecadado, valor_premio: totalPremiosGanhos,
        valor_caixinha: valorFinalCaixinha, vencedores
      });

      // 1º e 2º lugar perdem números (3º mantém)
      for (const vencedor of vencedores) {
        if (vencedor.posicao === 'primeiro' || vencedor.posicao === 'segundo') {
          const numerosDoVencedor = (rifaNumeros || []).filter(n => n.cotista_id === vencedor.cotista_id && n.ativo);
          if (numerosDoVencedor.length <= 1) continue;
          await supabase.from('rifa_numeros').delete()
            .eq('cotista_id', vencedor.cotista_id).eq('numero', vencedor.numero);
          const restantes = numerosDoVencedor.filter(n => n.numero !== vencedor.numero);
          const qtdRemover = Math.min(3, restantes.length - 1);
          if (qtdRemover > 0) {
            const ids = restantes.sort(() => Math.random() - 0.5).slice(0, qtdRemover).map(n => n.id);
            await supabase.from('rifa_numeros').delete().in('id', ids);
          }
        }
      }

      await Promise.all([get().loadRifaNumeros(), get().loadCotistas(), get().loadRifaSorteios()]);
      return { vencedores, totalPremios: totalPremiosGanhos, caixinha: valorFinalCaixinha };
    } catch (error) {
      console.error('Erro ao realizar sorteio:', error);
      throw error;
    }
  },

  // =====================================================
  // CARREGAMENTO INICIAL — carrega todos os dados paralelo
  // =====================================================

  loadAllData: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().loadConfiguracoes(),
        get().loadCotistas(),
        get().loadMensalidades(),
        get().loadEmprestimos(),
        get().loadCdi(),
        get().loadComprovantes(),
        get().loadRifaNumeros(),
        get().loadRifaSorteios(),
        get().loadJurosAtraso(),
        get().loadJurosEmprestimo()
      ]);
      set({ isOnline: true });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      set({ isOnline: false });
    } finally {
      set({ isLoading: false });
    }
  }
}));

// =====================================================
// UI STORE — estado da interface (modais, toasts, sidebar)
// =====================================================
export const useUIStore = create((set) => ({
  showPixModal: false,
  showChangePasswordModal: false,
  currentTab: '',
  sidebarOpen: true,
  toast: null, // { tipo: 'success'|'error'|'info'|'warning', mensagem: string }

  setShowPixModal: (show) => set({ showPixModal: show }),
  setShowChangePasswordModal: (show) => set({ showChangePasswordModal: show }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Exibe toast temporário na interface
  showToast: (mensagem, tipo = 'success', duracao = 3000) => {
    set({ toast: { tipo, mensagem } });
    if (duracao > 0) setTimeout(() => set({ toast: null }), duracao);
  },
  hideToast: () => set({ toast: null })
}));

export default { useAuthStore, useAppStore, useUIStore };
