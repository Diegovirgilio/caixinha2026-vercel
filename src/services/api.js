import { supabase } from './supabase';

// ==================== COTISTAS ====================
export const cotistasApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('cotistas')
      .select('*')
      .eq('status', 'ativo')
      .order('nome');
    
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('cotistas')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getByUserId(userId) {
    const { data, error } = await supabase
      .from('cotistas')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async create(cotista) {
    const { data, error } = await supabase
      .from('cotistas')
      .insert(cotista)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('cotistas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('cotistas')
      .update({ status: 'inativo' })
      .eq('id', id);
    
    if (error) throw error;
  },

  async getResumo() {
    const { data, error } = await supabase
      .from('vw_resumo_cotistas')
      .select('*');
    
    if (error) throw error;
    return data;
  }
};

// ==================== MENSALIDADES ====================
export const mensalidadesApi = {
  async getAll(mes = null) {
    let query = supabase
      .from('mensalidades')
      .select(`
        *,
        cotista:cotistas(id, nome, cotas)
      `)
      .order('mes_referencia');
    
    if (mes) {
      query = query.eq('mes_referencia', mes);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getByCotista(cotistaId) {
    const { data, error } = await supabase
      .from('mensalidades')
      .select('*')
      .eq('cotista_id', cotistaId)
      .order('mes_referencia');
    
    if (error) throw error;
    return data;
  },

  async registrarPagamento(id, { valor_pago, data_pagamento, comprovante_url }) {
    // Buscar mensalidade atual
    const { data: mensalidade } = await supabase
      .from('mensalidades')
      .select('*')
      .eq('id', id)
      .single();

    const novoValorPago = (mensalidade?.valor_pago || 0) + valor_pago;
    const status = novoValorPago >= mensalidade?.valor_devido ? 'pago' : 'parcial';

    const { data, error } = await supabase
      .from('mensalidades')
      .update({
        valor_pago: novoValorPago,
        data_pagamento: data_pagamento || new Date().toISOString(),
        status,
        comprovante_url
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async gerarMensalidades(cotistaId, cotas, valorPorCota = 50) {
    const meses = [];
    for (let i = 1; i <= 11; i++) {
      meses.push({
        cotista_id: cotistaId,
        mes_referencia: `2026-${String(i).padStart(2, '0')}`,
        valor_devido: cotas * valorPorCota,
        valor_pago: 0,
        status: 'pendente'
      });
    }

    const { data, error } = await supabase
      .from('mensalidades')
      .upsert(meses, { onConflict: 'cotista_id,mes_referencia' })
      .select();
    
    if (error) throw error;
    return data;
  }
};

// ==================== EMPRÉSTIMOS ====================
export const emprestimosApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('emprestimos')
      .select('*, cotista:cotistas!emprestimos_cotista_id_fkey(id, nome, cotas)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByCotista(cotistaId) {
    const { data, error } = await supabase
      .from('emprestimos')
      .select('*')
      .eq('cotista_id', cotistaId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getPendentes() {
    const { data, error } = await supabase
      .from('emprestimos')
      .select(`
        *,
        cotista:cotistas(id, nome, cotas)
      `)
      .eq('status', 'pendente')
      .order('created_at');
    
    if (error) throw error;
    return data;
  },

  async solicitar({ cotista_id, valor, taxa_juros, chave_pix, cotista_nome, modalidade = 'normal' }) {
    const valor_juros = valor * (taxa_juros / 100);
    const valor_total = valor + valor_juros;

    const { data, error } = await supabase
      .from('emprestimos')
      .insert({
        cotista_id,
        valor_emprestimo: valor,
        taxa_juros,
        valor_juros,
        valor_total,
        chave_pix,
        modalidade,
        status: 'pendente'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Enviar alerta via Telegram
    try {
      const { alertaNovoEmprestimo } = await import('./telegram');
      await alertaNovoEmprestimo(cotista_nome || 'Cotista', valor);
    } catch (telegramError) {
      console.log('Erro ao enviar alerta Telegram:', telegramError);
    }
    
    return data;
  },

  async aprovar(id, aprovadorId) {
    // Calcular vencimento: mesmo dia do mês seguinte
    const hoje = new Date();
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
    
    const { data, error } = await supabase
      .from('emprestimos')
      .update({
        status: 'ativo',
        aprovado_por: aprovadorId,
        data_aprovacao: new Date().toISOString(),
        data_vencimento: vencimento.toISOString().split('T')[0]
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async rejeitar(id) {
    const { data, error } = await supabase
      .from('emprestimos')
      .update({
        status: 'rejeitado'
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async quitar(id) {
    const { data, error } = await supabase
      .from('emprestimos')
      .update({
        status: 'pago',
        data_quitacao: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Tabela 'rifas' removida do banco — rifas agora são gerenciadas via rifa_sorteios e mensalidades

// ==================== CDI ====================
export const cdiApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('cdi')
      .select('*')
      .order('mes_referencia');
    
    if (error) throw error;
    return data;
  },

  async create({ mes_referencia, valor, taxa }) {
    const { data, error } = await supabase
      .from('cdi')
      .upsert({ mes_referencia, valor, taxa }, { onConflict: 'mes_referencia' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('cdi')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// ==================== CONFIGURAÇÕES ====================
export const configApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*');
    
    if (error) throw error;
    
    // Converter para objeto
    return data.reduce((acc, item) => {
      acc[item.chave] = item.valor;
      return acc;
    }, {});
  },

  async get(chave) {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .single();
    
    if (error) throw error;
    return data?.valor;
  },

  async set(chave, valor) {
    const { error } = await supabase
      .from('configuracoes')
      .upsert({ chave, valor, updated_at: new Date().toISOString() });
    
    if (error) throw error;
  }
};

// Tabela notificacoes removida do banco

// ==================== DASHBOARD ====================
export const dashboardApi = {
  async getResumoGeral() {
    // Carrega apenas os dados necessários para o Dashboard
    const [cotistas, mensalidades, jurosEmprestimo, rifaSorteios, cdi] = await Promise.all([
      supabase.from('cotistas').select('id, cotas, is_admin').eq('status', 'ativo'),
      supabase.from('mensalidades').select('valor_pago, valor_devido, cotista_id'),
      supabase.from('juros_emprestimo').select('valor_juros, modalidade'),
      supabase.from('rifa_sorteios').select('valor_arrecadado, valor_premio, valor_caixinha'),
      supabase.from('cdi').select('valor')
    ]);

    const adminIds = (cotistas.data || []).filter(c => c.is_admin).map(c => c.id);
    const cotistasNaoAdmin = (cotistas.data || []).filter(c => !c.is_admin);
    const mensalidadesNaoAdmin = (mensalidades.data || []).filter(m => !adminIds.includes(m.cotista_id));

    const totalCotas = cotistasNaoAdmin.reduce((sum, c) => sum + (c.cotas || 0), 0);

    // Total investido = soma do valor_devido (mensalidades pagas, sem rifa)
    const totalInvestido = mensalidadesNaoAdmin.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);

    // Total juros = soma de todos os juros de empréstimo registrados
    const totalJuros = (jurosEmprestimo.data || []).reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);

    // Total rifas = sobra de caixinha dos sorteios (arrecadado - prêmios)
    const totalRifas = (rifaSorteios.data || []).reduce((sum, s) => sum + Number(s.valor_caixinha || 0), 0);

    const totalCDI = (cdi.data || []).reduce((sum, c) => sum + Number(c.valor || 0), 0);

    return {
      totalCotas,
      totalCotistas: cotistasNaoAdmin.length,
      totalInvestido,
      totalJuros,
      totalRifas,
      totalCDI,
      patrimonioTotal: totalInvestido + totalJuros + totalRifas + totalCDI
    };
  }
};

export default {
  cotistas: cotistasApi,
  mensalidades: mensalidadesApi,
  emprestimos: emprestimosApi,
  cdi: cdiApi,
  config: configApi,
  dashboard: dashboardApi
};
