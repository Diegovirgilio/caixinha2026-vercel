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
        mes_referencia: `${String(i).padStart(2, '0')}/2026`,
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
      .select(`
        *,
        cotista:cotistas(id, nome, cotas),
        aprovador:cotistas!emprestimos_aprovado_por_fkey(id, nome)
      `)
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

  async solicitar({ cotista_id, valor, tipo, parcelas, motivo, taxa_juros, chave_pix }) {
    const valor_juros = valor * (taxa_juros / 100);
    const valor_total = valor + valor_juros;
    const valor_parcela = tipo === 'parcelado' ? valor_total / parcelas : valor_total;

    const { data, error } = await supabase
      .from('emprestimos')
      .insert({
        cotista_id,
        valor_emprestimo: valor,
        tipo,
        parcelas: tipo === 'parcelado' ? parcelas : 1,
        taxa_juros,
        valor_juros,
        valor_total,
        valor_parcela,
        motivo,
        chave_pix,
        status: 'pendente'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async aprovar(id, aprovadorId) {
    const { data, error } = await supabase
      .from('emprestimos')
      .update({
        status: 'ativo',
        aprovado_por: aprovadorId,
        data_aprovacao: new Date().toISOString()
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

// ==================== RIFAS ====================
export const rifasApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('rifas')
      .select('*')
      .order('data', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async create({ descricao, valor, data }) {
    const { data: rifa, error } = await supabase
      .from('rifas')
      .insert({ descricao, valor, data })
      .select()
      .single();
    
    if (error) throw error;
    return rifa;
  },

  async delete(id) {
    const { error } = await supabase
      .from('rifas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

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

// ==================== NOTIFICAÇÕES ====================
export const notificacoesApi = {
  async getByCotista(cotistaId) {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('cotista_id', cotistaId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    return data;
  },

  async getNaoLidas(cotistaId) {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('cotista_id', cotistaId)
      .eq('lida', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async marcarComoLida(id) {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true, data_leitura: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  },

  async marcarTodasComoLidas(cotistaId) {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true, data_leitura: new Date().toISOString() })
      .eq('cotista_id', cotistaId)
      .eq('lida', false);
    
    if (error) throw error;
  },

  async criar({ cotista_id, tipo, titulo, mensagem, dados }) {
    const { data, error } = await supabase
      .from('notificacoes')
      .insert({ cotista_id, tipo, titulo, mensagem, dados })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// ==================== DASHBOARD ====================
export const dashboardApi = {
  async getResumoGeral() {
    const [cotistas, mensalidades, emprestimos, rifas, cdi] = await Promise.all([
      supabase.from('cotistas').select('id, cotas, is_admin').eq('status', 'ativo'),
      supabase.from('mensalidades').select('valor_pago, valor_devido, cotista_id'),
      supabase.from('emprestimos').select('valor_emprestimo, valor_juros, status, cotista_id'),
      supabase.from('rifas').select('valor'),
      supabase.from('cdi').select('valor')
    ]);

    // IDs dos admins para excluir
    const adminIds = (cotistas.data || []).filter(c => c.is_admin).map(c => c.id);
    
    // Filtrar apenas cotistas não-admin
    const cotistasNaoAdmin = (cotistas.data || []).filter(c => !c.is_admin);
    const mensalidadesNaoAdmin = (mensalidades.data || []).filter(m => !adminIds.includes(m.cotista_id));
    const emprestimosNaoAdmin = (emprestimos.data || []).filter(e => !adminIds.includes(e.cotista_id));

    const totalCotas = cotistasNaoAdmin.reduce((sum, c) => sum + (c.cotas || 0), 0);
    const totalInvestido = mensalidadesNaoAdmin.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
    const totalDevido = mensalidadesNaoAdmin.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);
    const totalEmprestimosAtivos = emprestimosNaoAdmin.filter(e => e.status === 'ativo').reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);
    const totalJuros = emprestimosNaoAdmin.filter(e => e.status === 'pago').reduce((sum, e) => sum + Number(e.valor_juros || 0), 0);
    const totalRifas = (rifas.data || []).reduce((sum, r) => sum + Number(r.valor || 0), 0);
    const totalCDI = (cdi.data || []).reduce((sum, c) => sum + Number(c.valor || 0), 0);

    return {
      totalCotas,
      totalCotistas: cotistasNaoAdmin.length,
      totalInvestido,
      totalDevido,
      totalEmprestimosAtivos,
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
  rifas: rifasApi,
  cdi: cdiApi,
  config: configApi,
  notificacoes: notificacoesApi,
  dashboard: dashboardApi
};
