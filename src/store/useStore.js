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
  rifas: [],
  cdi: [],
  comprovantes: [],
  comprovantes_pendentes: 0,
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
        get().loadConfiguracoes(),
        get().loadCotistas(),
        get().loadMensalidades(),
        get().loadEmprestimos(),
        get().loadRifas(),
        get().loadCdi(),
        get().loadComprovantes(),
        get().loadRifaNumeros(),
        get().loadRifaSorteios()
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
    const { mensalidades, cotistas } = get();
    const cotista = cotistas.find(c => c.id === cotistaId);
    let total = 0;
    
    Object.values(mensalidades).forEach(mes => {
      if (Array.isArray(mes)) {
        const registro = mes.find(m => m.cotista_id === cotistaId);
        if (registro) {
          // Valor pago da mensalidade
          total += Number(registro.valor_pago || 0);
          // Se participa da rifa, adiciona valor da rifa (R$ 20 por cota)
          if (cotista?.participa_rifa && registro.valor_pago > 0) {
            total += (cotista.cotas || 0) * 20;
          }
        }
      }
    });
    return total;
  },

  getLimiteEmprestimo: (cotistaId) => {
    const investido = get().getInvestidoByCotista(cotistaId);
    const { configuracoes } = get();
    const percentual = parseFloat(configuracoes.limite_emprestimo_percent || 80) / 100;
    return investido * percentual;
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
      const quantidade = cotas * 2; // 2 números por cota
      
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
      const numerosNecessarios = cotasNovas * 2;
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
      const numerosAtivos = (rifaNumeros || []).filter(n => n.ativo);
      
      // Calcular valores
      const totalCotas = participantes.reduce((sum, c) => sum + (c.cotas || 0), 0);
      const valorArrecadado = totalCotas * 20; // R$ 20 por cota
      const valorPremio = valorArrecadado * 0.20; // 20%
      const valorCaixinha = valorArrecadado * 0.80; // 80%
      
      // Extrair números da Federal (5 prêmios)
      const premios = [
        resultadoFederal.primeiro,
        resultadoFederal.segundo,
        resultadoFederal.terceiro,
        resultadoFederal.quarto,
        resultadoFederal.quinto
      ];
      
      let numeroVencedor = null;
      let cotistaVencedor = null;
      const premiosVerificados = [];
      
      // 1. Verificar últimos 3 dígitos
      for (const premio of premios) {
        const ultimos3 = premio.slice(-3);
        premiosVerificados.push({ premio, tipo: 'ultimos3', numero: ultimos3 });
        
        const match = numerosAtivos.find(n => n.numero === ultimos3);
        if (match) {
          numeroVencedor = ultimos3;
          cotistaVencedor = match.cotista_id;
          break;
        }
      }
      
      // 2. Se não achou, verificar primeiros 3 dígitos
      if (!numeroVencedor) {
        for (const premio of premios) {
          const primeiros3 = premio.slice(0, 3);
          premiosVerificados.push({ premio, tipo: 'primeiros3', numero: primeiros3 });
          
          const match = numerosAtivos.find(n => n.numero === primeiros3);
          if (match) {
            numeroVencedor = primeiros3;
            cotistaVencedor = match.cotista_id;
            break;
          }
        }
      }
      
      // Registrar sorteio
      const sorteioData = {
        mes_referencia: mesReferencia,
        data_sorteio: dataSorteio,
        numero_vencedor: numeroVencedor,
        cotista_vencedor_id: cotistaVencedor,
        valor_arrecadado: valorArrecadado,
        valor_premio: cotistaVencedor ? valorPremio : 0,
        valor_caixinha: cotistaVencedor ? valorCaixinha : valorArrecadado,
        resultado_federal: resultadoFederal,
        premios_verificados: premiosVerificados
      };
      
      const { error: sorteioError } = await supabase
        .from('rifa_sorteios')
        .insert(sorteioData);
      
      if (sorteioError) throw sorteioError;
      
      // Se houve vencedor, processar vitória
      if (cotistaVencedor && numeroVencedor) {
        // Remover número vencedor
        await supabase
          .from('rifa_numeros')
          .delete()
          .eq('cotista_id', cotistaVencedor)
          .eq('numero', numeroVencedor);
        
        // Remover 1 número aleatório adicional
        const numerosRestantes = numerosAtivos.filter(
          n => n.cotista_id === cotistaVencedor && n.numero !== numeroVencedor
        );
        
        if (numerosRestantes.length > 0) {
          const numeroAleatorio = numerosRestantes[Math.floor(Math.random() * numerosRestantes.length)];
          await supabase.from('rifa_numeros').delete().eq('id', numeroAleatorio.id);
        }
        
        // Verificar se cotista ainda tem números
        await get().loadRifaNumeros();
        const numerosAtualizados = get().getNumerosRifaByCotista(cotistaVencedor);
        
        if (numerosAtualizados.length === 0) {
          await supabase
            .from('cotistas')
            .update({ participa_rifa: false })
            .eq('id', cotistaVencedor);
          
          await get().loadCotistas();
        }
      }
      
      await get().loadRifaSorteios();
      
      return {
        vencedor: cotistaVencedor,
        numero: numeroVencedor,
        premio: cotistaVencedor ? valorPremio : 0,
        caixinha: cotistaVencedor ? valorCaixinha : valorArrecadado
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
