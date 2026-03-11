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
      
      // Verificar se foi aprovado pelo admin
      if (cotista.status === 'pendente') {
        await supabase.auth.signOut();
        throw new Error('Seu cadastro ainda não foi aprovado pelo administrador. Aguarde a aprovação.');
      }
      
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
      
      // Verificar se foi aprovado
      if (cotista.status === 'pendente') {
        throw new Error('Seu cadastro ainda não foi aprovado pelo administrador. Aguarde a aprovação.');
      }
      
      if (!cotista.email) {
        throw new Error('Este usuário não possui credenciais. Contate o administrador.');
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

  // Registro de novo usuário (nome + senha, aguarda aprovação)
  register: async ({ password, nome, cotas, telefone, participa_rifa }) => {
    set({ isLoading: true, error: null });
    
    try {
      // Verificar se nome já existe
      const { data: existenteNome } = await supabase
        .from('cotistas')
        .select('nome')
        .ilike('nome', nome)
        .single();
      
      if (existenteNome) {
        throw new Error(`Já existe um usuário com o nome "${nome}". Por favor, use nome e sobrenome.`);
      }
      
      // Criar email fake baseado no nome (para Supabase Auth)
      const emailFake = `${nome.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
      
      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailFake,
        password
      });
      
      if (authError) throw authError;
      
      // Criar registro na tabela cotistas com status PENDENTE
      const { data: cotista, error: cotistaError } = await supabase
        .from('cotistas')
        .insert({
          user_id: authData.user?.id,
          nome,
          email: emailFake,
          cotas: parseInt(cotas) || 1,
          telefone: telefone || null,
          participa_rifa: participa_rifa || false,
          is_admin: false,
          status: 'pendente' // Aguarda aprovação do admin
        })
        .select()
        .single();
      
      if (cotistaError) throw cotistaError;
      
      // NÃO gera mensalidades aqui - será gerado quando admin aprovar
      
      // Enviar alerta via Telegram
      try {
        const { alertaNovoCadastro } = await import('../services/telegram');
        await alertaNovoCadastro(nome, cotas);
      } catch (telegramError) {
        console.log('Erro ao enviar alerta Telegram:', telegramError);
      }
      
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
  emprestimos_pendentes: 0,
  rifas: [],
  cdi: [],
  comprovantes: [],
  comprovantes_pendentes: 0,
  juros_atraso: [],
  juros_emprestimo: [],
  configuracoes: {},
  config: { ...CONFIG },
  isLoading: false,
  isOnline: true,

  // ===== CONFIGURAÇÕES =====
  loadConfiguracoes: async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*');
      
      if (error) throw error;
      
      const config = {};
      (data || []).forEach(c => {
        config[c.chave] = c.valor;
      });
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
      return true;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      throw error;
    }
  },

  // ===== COTISTAS =====
  setCotistas: (cotistas) => set({ cotistas }),

  loadCotistas: async () => {
    try {
      const { data, error } = await supabase
        .from('cotistas')
        .select('*')
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
      
      // Enviar alerta via Telegram
      try {
        const { alertaNovoComprovante } = await import('../services/telegram');
        const cotistas = get().cotistas;
        const cotista = cotistas.find(c => c.id === comprovante.cotista_id);
        await alertaNovoComprovante(
          cotista?.nome || 'Desconhecido',
          comprovante.valor_informado,
          comprovante.tipo
        );
      } catch (telegramError) {
        console.log('Erro ao enviar alerta Telegram:', telegramError);
      }
      
      await get().loadComprovantes();
      return data;
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      throw error;
    }
  },

  aprovarComprovante: async (comprovanteId, adminId, valorAprovado, jurosAtraso = 0) => {
    try {
      // Buscar comprovante
      const { data: comprovante } = await supabase
        .from('comprovantes')
        .select('*')
        .eq('id', comprovanteId)
        .single();
      
      if (!comprovante) throw new Error('Comprovante não encontrado');

      // Verificar se já existe outro comprovante APROVADO para mesma referencia_id e cotista_id
      const { data: comprovantesExistentes } = await supabase
        .from('comprovantes')
        .select('id')
        .eq('cotista_id', comprovante.cotista_id)
        .eq('referencia_id', comprovante.referencia_id)
        .eq('tipo', comprovante.tipo)
        .eq('status', 'aprovado');
      
      const jaTemAprovado = comprovantesExistentes && comprovantesExistentes.length > 0;

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

      // Registrar juros por atraso se houver
      if (jurosAtraso > 0) {
        await supabase
          .from('juros_atraso')
          .insert({
            cotista_id: comprovante.cotista_id,
            comprovante_id: comprovanteId,
            tipo: comprovante.tipo,
            valor_juros: jurosAtraso,
            mes_referencia: comprovante.mes_referencia,
            registrado_por: adminId
          });
      }

      // Valor que vai para o cotista (desconta juros)
      const valorParaCotista = valorAprovado - jurosAtraso;

      // Para mensalidades: só atualiza se NÃO tinha comprovante aprovado antes
      // Para empréstimos: SEMPRE atualiza (pode ter múltiplos pagamentos)
      if (comprovante.tipo === 'mensalidade') {
        if (!jaTemAprovado) {
          const { data: mensalidade } = await supabase
            .from('mensalidades')
            .select('*, cotista:cotistas(id, cotas, participa_rifa)')
            .eq('id', comprovante.referencia_id)
            .single();
          
          if (mensalidade) {
            // Calcular valor total devido incluindo rifa
            let valorTotalDevido = Number(mensalidade.valor_devido || 0);
            if (mensalidade.cotista?.participa_rifa) {
              valorTotalDevido += (mensalidade.cotista.cotas || 0) * 20;
            }
            
            const novoValorPago = (mensalidade.valor_pago || 0) + valorParaCotista;
            const status = novoValorPago >= valorTotalDevido ? 'pago' : 'parcial';
            
            await supabase
              .from('mensalidades')
              .update({
                valor_pago: novoValorPago,
                status,
                data_pagamento: new Date().toISOString()
              })
              .eq('id', comprovante.referencia_id);
          }
        }
      } else if (comprovante.tipo === 'emprestimo') {
        // Empréstimo: SEMPRE atualiza (múltiplos pagamentos permitidos)
        console.log('=== APROVANDO EMPRÉSTIMO ===');
        console.log('Comprovante:', comprovante);
        console.log('referencia_id:', comprovante.referencia_id);
        
        const { data: emprestimo, error: fetchError } = await supabase
          .from('emprestimos')
          .select('*')
          .eq('id', comprovante.referencia_id)
          .single();
        
        if (fetchError) {
          console.error('Erro ao buscar empréstimo:', fetchError);
        }
        
        console.log('Empréstimo encontrado:', emprestimo);
        
        if (emprestimo) {
          const modalidade = emprestimo.modalidade || 'normal';
          const principalAtual = Number(emprestimo.principal_restante || emprestimo.valor_emprestimo || 0);
          
          // Extrair tipo de pagamento da observação
          // Formato: "Tipo: Quitação Total (20%)" ou "Tipo: Só Juros (30%)" ou "Tipo: Juros + Parcial (30%)"
          const observacao = comprovante.observacao || '';
          let tipoPagamento = 'quitacao';
          let taxaJuros = 20;
          
          if (observacao.includes('Só Juros')) {
            tipoPagamento = 'soJuros';
            taxaJuros = 30;
          } else if (observacao.includes('Parcial')) {
            tipoPagamento = 'parcial';
            taxaJuros = 30;
          } else if (observacao.includes('Quitação')) {
            tipoPagamento = 'quitacao';
            taxaJuros = 20;
          }
          
          // Calcular juros e principal abatido
          let valorJuros = 0;
          let principalAbatido = 0;
          let novoPrincipal = principalAtual;
          let novoStatus = 'ativo';
          
          if (tipoPagamento === 'soJuros') {
            // Só juros: todo valor vai para juros, principal continua
            valorJuros = valorParaCotista;
            principalAbatido = 0;
            novoPrincipal = principalAtual;
            novoStatus = 'ativo';
            
          } else if (tipoPagamento === 'parcial') {
            // Parcial: juros + parte do principal
            const jurosCalculado = principalAtual * (taxaJuros / 100);
            valorJuros = Math.min(jurosCalculado, valorParaCotista);
            principalAbatido = Math.max(0, valorParaCotista - valorJuros);
            novoPrincipal = Math.max(0, principalAtual - principalAbatido);
            novoStatus = novoPrincipal <= 0 ? 'pago' : 'ativo';
            
          } else {
            // Quitação: juros + todo principal
            valorJuros = principalAtual * (taxaJuros / 100);
            principalAbatido = principalAtual;
            novoPrincipal = 0;
            novoStatus = 'pago';
          }
          
          console.log('Aprovando empréstimo:', {
            tipoPagamento,
            modalidade,
            principalAtual,
            valorParaCotista,
            valorJuros,
            principalAbatido,
            novoPrincipal,
            novoStatus,
            taxaJuros
          });
          
          // Registrar juros na tabela juros_emprestimo
          if (valorJuros > 0) {
            const mesRef = new Date().toISOString().slice(0, 7);
            await supabase
              .from('juros_emprestimo')
              .insert({
                emprestimo_id: emprestimo.id,
                cotista_id: emprestimo.cotista_id,
                comprovante_id: comprovanteId,
                modalidade,
                tipo_pagamento: tipoPagamento,
                valor_juros: valorJuros,
                valor_principal_abatido: principalAbatido,
                taxa_juros: taxaJuros,
                mes_referencia: mesRef,
                registrado_por: adminId
              });
          }
          
          // Atualizar empréstimo
          // Calcular novo vencimento: vencimento atual + 1 mês
          let novoVencimento = emprestimo.data_vencimento;
          if (novoStatus === 'ativo' && emprestimo.data_vencimento) {
            const vencimentoAtual = new Date(emprestimo.data_vencimento);
            novoVencimento = new Date(vencimentoAtual.getFullYear(), vencimentoAtual.getMonth() + 1, vencimentoAtual.getDate());
          }
          
          const dadosUpdate = {
            principal_restante: novoPrincipal,
            status: novoStatus,
            data_quitacao: novoStatus === 'pago' ? new Date().toISOString() : null,
            data_vencimento: novoStatus === 'ativo' ? novoVencimento.toISOString().split('T')[0] : emprestimo.data_vencimento
          };
          
          console.log('=== ATUALIZANDO EMPRÉSTIMO ===');
          console.log('ID:', comprovante.referencia_id);
          console.log('Dados para update:', dadosUpdate);
          
          const { data: updateResult, error: empError } = await supabase
            .from('emprestimos')
            .update(dadosUpdate)
            .eq('id', comprovante.referencia_id)
            .select();
          
          console.log('Resultado update:', updateResult);
          
          if (empError) {
            console.error('Erro ao atualizar empréstimo:', empError);
          } else {
            console.log('Empréstimo atualizado com sucesso!');
          }
        } else {
          console.error('Empréstimo não encontrado com ID:', comprovante.referencia_id);
        }
      }

      await get().loadComprovantes();
      await get().loadJurosAtraso();
      await get().loadJurosEmprestimo();
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
      
      // Contar pendentes
      const pendentes = (data || []).filter(e => e.status === 'pendente').length;
      
      set({ emprestimos: data || [], emprestimos_pendentes: pendentes });
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

  // ===== JUROS POR ATRASO =====
  loadJurosAtraso: async () => {
    try {
      const { data, error } = await supabase
        .from('juros_atraso')
        .select(`*, cotista:cotistas!juros_atraso_cotista_id_fkey(id, nome)`)
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
      const { data, error } = await supabase
        .from('juros_atraso')
        .insert(dados)
        .select()
        .single();
      
      if (error) throw error;
      await get().loadJurosAtraso();
      return data;
    } catch (error) {
      console.error('Erro ao registrar juros por atraso:', error);
      throw error;
    }
  },

  getTotalJurosAtraso: () => {
    const { juros_atraso } = get();
    return (juros_atraso || []).reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);
  },

  // ===== JUROS DE EMPRÉSTIMO =====
  loadJurosEmprestimo: async () => {
    try {
      const { data, error } = await supabase
        .from('juros_emprestimo')
        .select(`*, cotista:cotistas!juros_emprestimo_cotista_id_fkey(id, nome), emprestimo:emprestimos(id, cotista_id, valor_emprestimo, modalidade)`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      set({ juros_emprestimo: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar juros de empréstimo:', error);
      return [];
    }
  },

  registrarJurosEmprestimo: async (dados) => {
    try {
      const { data, error } = await supabase
        .from('juros_emprestimo')
        .insert(dados)
        .select()
        .single();
      
      if (error) throw error;
      await get().loadJurosEmprestimo();
      return data;
    } catch (error) {
      console.error('Erro ao registrar juros de empréstimo:', error);
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
        get().loadConfiguracoes(),
        get().loadCotistas(),
        get().loadMensalidades(),
        get().loadEmprestimos(),
        get().loadRifas(),
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
  },

  // ===== CÁLCULOS =====
  getTotalCotas: () => {
    const { cotistas } = get();
    return cotistas.reduce((sum, c) => sum + (c.cotas || 0), 0);
  },

  getTotalInvestido: () => {
    const { mensalidades, cotistas } = get();
    // IDs dos admins para excluir
    const adminIds = (cotistas || []).filter(c => c.is_admin).map(c => c.id);
    
    let total = 0;
    Object.values(mensalidades).forEach(mes => {
      if (Array.isArray(mes)) {
        mes.forEach(m => {
          // Excluir mensalidades de admins
          if (!adminIds.includes(m.cotista_id)) {
            total += Number(m.valor_pago || 0);
          }
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
        if (registro) {
          // Valor pago já inclui mensalidade + rifa (se participar)
          total += Number(registro.valor_pago || 0);
        }
      }
    });
    return total;
  },

  getLimiteEmprestimo: (cotistaId, modalidade = 'normal') => {
    const investido = get().getInvestidoByCotista(cotistaId);
    const { cotistas, emprestimos } = get();
    const cotista = cotistas.find(c => c.id === cotistaId);
    
    // Usa limite conforme modalidade
    let percentual;
    if (modalidade === 'caixinha') {
      percentual = (cotista?.limite_emprestimo_caixinha || 100) / 100;
    } else {
      percentual = (cotista?.limite_emprestimo || 80) / 100;
    }
    
    const limiteTotal = investido * percentual;
    
    // Descontar empréstimos ativos e pendentes DA MESMA MODALIDADE
    const emprestimosAtivos = (emprestimos || [])
      .filter(e => 
        e.cotista_id === cotistaId && 
        (e.status === 'ativo' || e.status === 'pendente') &&
        (e.modalidade || 'normal') === modalidade
      )
      .reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);
    
    return Math.max(0, limiteTotal - emprestimosAtivos);
  },

  // ===== SISTEMA DE RIFAS =====
  rifaNumeros: [],
  rifaSorteios: [],

  // Carregar números da rifa
  loadRifaNumeros: async () => {
    try {
      const { data, error } = await supabase
        .from('rifa_numeros')
        .select('*, cotista:cotistas(id, nome)')
        .eq('ativo', true)
        .order('numero');
      
      if (error) throw error;
      set({ rifaNumeros: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar números da rifa:', error);
      return [];
    }
  },

  // Carregar sorteios
  loadRifaSorteios: async () => {
    try {
      const { data, error } = await supabase
        .from('rifa_sorteios')
        .select('*, cotista_vencedor:cotistas(id, nome)')
        .order('mes_referencia', { ascending: false });
      
      if (error) throw error;
      set({ rifaSorteios: data || [] });
      return data;
    } catch (error) {
      console.error('Erro ao carregar sorteios:', error);
      return [];
    }
  },

  // Obter números de um cotista
  getNumerosRifaByCotista: (cotistaId) => {
    const { rifaNumeros } = get();
    return (rifaNumeros || []).filter(n => n.cotista_id === cotistaId);
  },

  // Ativar rifa para cotista (gera números)
  ativarRifaCotista: async (cotistaId, cotas) => {
    try {
      const quantidade = cotas * 5; // 5 números por cota
      
      // Gerar números únicos
      const numerosGerados = [];
      const { rifaNumeros } = get();
      const numerosExistentes = new Set((rifaNumeros || []).map(n => n.numero));
      
      while (numerosGerados.length < quantidade) {
        const numero = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        if (!numerosExistentes.has(numero) && !numerosGerados.includes(numero)) {
          numerosGerados.push(numero);
        }
      }
      
      // Inserir números no banco
      const numerosParaInserir = numerosGerados.map(numero => ({
        cotista_id: cotistaId,
        numero,
        ativo: true
      }));
      
      const { error: insertError } = await supabase
        .from('rifa_numeros')
        .insert(numerosParaInserir);
      
      if (insertError) throw insertError;
      
      // Atualizar flag do cotista
      const { error: updateError } = await supabase
        .from('cotistas')
        .update({ participa_rifa: true })
        .eq('id', cotistaId);
      
      if (updateError) throw updateError;
      
      // Recarregar dados
      await get().loadRifaNumeros();
      await get().loadCotistas();
      
      return numerosGerados;
    } catch (error) {
      console.error('Erro ao ativar rifa:', error);
      throw error;
    }
  },

  // Desativar rifa para cotista (deleta números)
  desativarRifaCotista: async (cotistaId) => {
    try {
      // Deletar todos os números do cotista
      const { error: deleteError } = await supabase
        .from('rifa_numeros')
        .delete()
        .eq('cotista_id', cotistaId);
      
      if (deleteError) throw deleteError;
      
      // Atualizar flag do cotista
      const { error: updateError } = await supabase
        .from('cotistas')
        .update({ participa_rifa: false })
        .eq('id', cotistaId);
      
      if (updateError) throw updateError;
      
      // Recarregar dados
      await get().loadRifaNumeros();
      await get().loadCotistas();
    } catch (error) {
      console.error('Erro ao desativar rifa:', error);
      throw error;
    }
  },

  // Ajustar números quando cotas mudam
  ajustarNumerosRifa: async (cotistaId, cotasAntigas, cotasNovas) => {
    try {
      const numerosAtuais = get().getNumerosRifaByCotista(cotistaId);
      const numerosNecessarios = cotasNovas * 5; // 5 números por cota
      const diferenca = numerosNecessarios - numerosAtuais.length;
      
      if (diferenca > 0) {
        // Precisa gerar mais números
        const { rifaNumeros } = get();
        const numerosExistentes = new Set((rifaNumeros || []).map(n => n.numero));
        const numerosGerados = [];
        
        while (numerosGerados.length < diferenca) {
          const numero = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
          if (!numerosExistentes.has(numero) && !numerosGerados.includes(numero)) {
            numerosGerados.push(numero);
          }
        }
        
        const numerosParaInserir = numerosGerados.map(numero => ({
          cotista_id: cotistaId,
          numero,
          ativo: true
        }));
        
        await supabase.from('rifa_numeros').insert(numerosParaInserir);
      } else if (diferenca < 0) {
        // Precisa remover números
        const numerosParaRemover = numerosAtuais
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.abs(diferenca));
        
        for (const num of numerosParaRemover) {
          await supabase.from('rifa_numeros').delete().eq('id', num.id);
        }
      }
      
      await get().loadRifaNumeros();
    } catch (error) {
      console.error('Erro ao ajustar números:', error);
      throw error;
    }
  },

  // Realizar sorteio
  realizarSorteio: async (mesReferencia, dataSorteio, resultadoFederal) => {
    try {
      const { rifaNumeros, cotistas } = get();
      
      // Participantes ativos
      const participantes = (cotistas || []).filter(c => c.participa_rifa && !c.is_admin);
      let numerosAtivos = [...(rifaNumeros || []).filter(n => n.ativo)];
      
      // Calcular valores
      const totalCotas = participantes.reduce((sum, c) => sum + (c.cotas || 0), 0);
      const valorArrecadado = totalCotas * 20; // R$ 20 por cota
      
      // Prêmios fixos
      const premiosValores = [200, 100, 50]; // 1º, 2º, 3º lugar
      const totalPremios = premiosValores.reduce((a, b) => a + b, 0); // R$ 350
      const valorCaixinha = valorArrecadado - totalPremios;
      
      // Extrair números da Federal (3 prêmios: 1º, 2º, 3º)
      const premiosFederal = [
        { nome: 'primeiro', numero: resultadoFederal.primeiro, valor: 200 },
        { nome: 'segundo', numero: resultadoFederal.segundo, valor: 100 },
        { nome: 'terceiro', numero: resultadoFederal.terceiro, valor: 50 }
      ];
      
      const vencedores = [];
      const premiosVerificados = [];
      
      // Verificar cada prêmio (pode ter até 3 vencedores)
      for (const premio of premiosFederal) {
        // Extrair últimos 3 dígitos e garantir formato com zeros à esquerda
        const ultimos3 = premio.numero.slice(-3).padStart(3, '0');
        premiosVerificados.push({ premio: premio.numero, numero: ultimos3, valor: premio.valor });
        
        const match = numerosAtivos.find(n => n.numero === ultimos3);
        if (match) {
          vencedores.push({
            posicao: premio.nome,
            cotista_id: match.cotista_id,
            numero: ultimos3,
            valor: premio.valor
          });
          
          // Remover número usado para não ganhar 2x com mesmo número
          numerosAtivos = numerosAtivos.filter(n => n.id !== match.id);
        }
      }
      
      // Calcular totais
      const totalPremiosGanhos = vencedores.reduce((sum, v) => sum + v.valor, 0);
      const valorFinalCaixinha = valorArrecadado - totalPremiosGanhos;
      
      // Registrar sorteio
      const sorteioData = {
        mes_referencia: mesReferencia,
        data_sorteio: dataSorteio,
        numero_vencedor: vencedores.length > 0 ? vencedores.map(v => v.numero).join(', ') : null,
        cotista_vencedor_id: vencedores.length > 0 ? vencedores[0].cotista_id : null, // Primeiro vencedor
        valor_arrecadado: valorArrecadado,
        valor_premio: totalPremiosGanhos,
        valor_caixinha: valorFinalCaixinha,
        resultado_federal: resultadoFederal,
        premios_verificados: premiosVerificados,
        vencedores: vencedores // Lista completa de vencedores
      };
      
      const { error: sorteioError } = await supabase
        .from('rifa_sorteios')
        .insert(sorteioData);
      
      if (sorteioError) throw sorteioError;
      
      // Processar vencedores do 1º e 2º lugar (perdem números)
      // 3º lugar NÃO perde números
      for (const vencedor of vencedores) {
        // Só aplica regra para 1º e 2º lugar
        if (vencedor.posicao === 'primeiro' || vencedor.posicao === 'segundo') {
          // Buscar números atuais do vencedor
          const numerosDoVencedor = (rifaNumeros || []).filter(
            n => n.cotista_id === vencedor.cotista_id && n.ativo
          );
          
          // Se tem apenas 1 número, NÃO aplica a regra
          if (numerosDoVencedor.length <= 1) {
            continue;
          }
          
          // Remover número vencedor
          await supabase
            .from('rifa_numeros')
            .delete()
            .eq('cotista_id', vencedor.cotista_id)
            .eq('numero', vencedor.numero);
          
          // Calcular quantos números aleatórios remover (máximo 3, mas mínimo 1 deve sobrar)
          const numerosRestantes = numerosDoVencedor.filter(n => n.numero !== vencedor.numero);
          const quantidadeRemover = Math.min(3, numerosRestantes.length - 1); // -1 para garantir que sobre pelo menos 1
          
          if (quantidadeRemover > 0) {
            // Embaralhar e pegar os primeiros N para remover
            const numerosParaRemover = numerosRestantes
              .sort(() => Math.random() - 0.5)
              .slice(0, quantidadeRemover);
            
            for (const num of numerosParaRemover) {
              await supabase.from('rifa_numeros').delete().eq('id', num.id);
            }
          }
        }
      }
      
      // Recarregar dados
      await get().loadRifaNumeros();
      await get().loadCotistas();
      await get().loadRifaSorteios();
      
      return {
        vencedores,
        totalPremios: totalPremiosGanhos,
        caixinha: valorFinalCaixinha
      };
    } catch (error) {
      console.error('Erro ao realizar sorteio:', error);
      throw error;
    }
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
