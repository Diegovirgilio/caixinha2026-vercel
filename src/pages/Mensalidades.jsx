import React, { useState, useEffect } from 'react';
import { 
  Calendar, Check, Clock, AlertCircle, Search, Filter,
  Loader2, X, DollarSign, CheckCircle,
  Edit2, Trash2, Plus, RefreshCw, Gift
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';

const Mensalidades = () => {
  const { cotistas, mensalidades, loadCotistas, loadMensalidades, configuracoes } = useAppStore();
  
  // Mês vigente como padrão
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
  const anoAtual = String(new Date().getFullYear());
  
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('pagamento'); // 'pagamento', 'editar', 'adicionar'
  const [selectedMensalidade, setSelectedMensalidade] = useState(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Mês no formato YYYY-MM (igual ao banco)
  const mesAnoFormatado = `${anoSelecionado}-${mesSelecionado}`;

  // Opções de meses
  const mesesOpcoes = [
    { valor: '01', nome: 'Janeiro' },
    { valor: '02', nome: 'Fevereiro' },
    { valor: '03', nome: 'Março' },
    { valor: '04', nome: 'Abril' },
    { valor: '05', nome: 'Maio' },
    { valor: '06', nome: 'Junho' },
    { valor: '07', nome: 'Julho' },
    { valor: '08', nome: 'Agosto' },
    { valor: '09', nome: 'Setembro' },
    { valor: '10', nome: 'Outubro' },
    { valor: '11', nome: 'Novembro' }
  ];
  
  const anosOpcoes = ['2026'];

  // Form para editar/adicionar
  const [formData, setFormData] = useState({
    cotista_id: '',
    valor_devido: '',
    valor_pago: '',
    status: 'pendente'
  });

  useEffect(() => {
    loadCotistas();
    loadMensalidades();
  }, []);

  // Filtrar apenas cotistas (não admins)
  const apenasContistas = (cotistas || []).filter(c => !c.is_admin && c.status === 'ativo');

  // Dados do mês selecionado
  const mensalidadesMes = mensalidades[mesAnoFormatado] || [];

  // Filtrar mensalidades (excluindo admins)
  const mensalidadesFiltradas = mensalidadesMes
    .filter(m => {
      // Excluir mensalidades de admins
      const cotista = (cotistas || []).find(c => c.id === m.cotista_id);
      if (cotista?.is_admin) return false;
      
      const matchSearch = m.cotista?.nome?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || m.status === filtroStatus;
      return matchSearch && matchStatus;
    });

  // Estatísticas do mês (apenas cotistas, não admins)
  const mensalidadesSemAdmin = mensalidadesMes.filter(m => {
    const cotista = (cotistas || []).find(c => c.id === m.cotista_id);
    return !cotista?.is_admin;
  });

  // Calcular valores de rifa baseado nos cotistas que participam
  const valorRifaTotal = mensalidadesSemAdmin.reduce((sum, m) => {
    const cotista = (cotistas || []).find(c => c.id === m.cotista_id);
    if (cotista?.participa_rifa) {
      return sum + (cotista.cotas * 20); // R$ 20 por cota
    }
    return sum;
  }, 0);

  const stats = {
    total: mensalidadesSemAdmin.length,
    pagos: mensalidadesSemAdmin.filter(m => m.status === 'pago').length,
    parciais: mensalidadesSemAdmin.filter(m => m.status === 'parcial').length,
    pendentes: mensalidadesSemAdmin.filter(m => m.status === 'pendente').length,
    valorEsperadoMensalidade: mensalidadesSemAdmin.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0),
    valorEsperadoRifa: valorRifaTotal,
    valorEsperadoTotal: mensalidadesSemAdmin.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0) + valorRifaTotal,
    valorRecebido: mensalidadesSemAdmin.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0)
  };

  // Abrir modal de pagamento
  const openPagamentoModal = (mensalidade) => {
    // Buscar info do cotista para calcular rifa
    const cotistaInfo = (cotistas || []).find(c => c.id === mensalidade.cotista_id);
    const valorRifa = cotistaInfo?.participa_rifa ? (cotistaInfo.cotas * 20) : 0;
    const valorTotalDevido = Number(mensalidade.valor_devido || 0) + valorRifa;
    const valorRestante = valorTotalDevido - (mensalidade.valor_pago || 0);
    
    setSelectedMensalidade(mensalidade);
    setValorPagamento(String(valorRestante));
    setModalMode('pagamento');
    setError('');
    setShowModal(true);
  };

  // Abrir modal de edição
  const openEditModal = (mensalidade) => {
    setSelectedMensalidade(mensalidade);
    setFormData({
      cotista_id: mensalidade.cotista_id,
      valor_devido: mensalidade.valor_devido,
      valor_pago: mensalidade.valor_pago || 0,
      status: mensalidade.status
    });
    setModalMode('editar');
    setError('');
    setShowModal(true);
  };

  // Abrir modal de adicionar
  const openAddModal = () => {
    setSelectedMensalidade(null);
    setFormData({
      cotista_id: '',
      valor_devido: '',
      valor_pago: '0',
      status: 'pendente'
    });
    setModalMode('adicionar');
    setError('');
    setShowModal(true);
  };

  const handleRegistrarPagamento = async () => {
    const valor = parseFloat(valorPagamento);
    
    if (isNaN(valor) || valor <= 0) {
      setError('Digite um valor válido');
      return;
    }

    setLoading(true);
    try {
      // Calcular valor total incluindo rifa
      const cotistaInfo = (cotistas || []).find(c => c.id === selectedMensalidade.cotista_id);
      const valorRifa = cotistaInfo?.participa_rifa ? (cotistaInfo.cotas * 20) : 0;
      const valorTotalDevido = Number(selectedMensalidade.valor_devido || 0) + valorRifa;
      
      const novoValorPago = (selectedMensalidade.valor_pago || 0) + valor;
      const status = novoValorPago >= valorTotalDevido ? 'pago' : 'parcial';

      const { error: updateError } = await supabase
        .from('mensalidades')
        .update({
          valor_pago: novoValorPago,
          status,
          data_pagamento: new Date().toISOString()
        })
        .eq('id', selectedMensalidade.id);

      if (updateError) throw updateError;

      await loadMensalidades();
      setShowModal(false);
      setSuccess('Pagamento registrado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    const valorDevido = parseFloat(formData.valor_devido);
    const valorPago = parseFloat(formData.valor_pago) || 0;

    if (isNaN(valorDevido) || valorDevido <= 0) {
      setError('Valor devido inválido');
      return;
    }

    setLoading(true);
    try {
      let status = formData.status;
      if (valorPago >= valorDevido) status = 'pago';
      else if (valorPago > 0) status = 'parcial';
      else status = 'pendente';

      const { error: updateError } = await supabase
        .from('mensalidades')
        .update({
          valor_devido: valorDevido,
          valor_pago: valorPago,
          status
        })
        .eq('id', selectedMensalidade.id);

      if (updateError) throw updateError;

      await loadMensalidades();
      setShowModal(false);
      setSuccess('Mensalidade atualizada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMensalidade = async () => {
    if (!formData.cotista_id) {
      setError('Selecione um cotista');
      return;
    }

    const valorDevido = parseFloat(formData.valor_devido);
    if (isNaN(valorDevido) || valorDevido <= 0) {
      setError('Valor devido inválido');
      return;
    }

    setLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('mensalidades')
        .insert({
          cotista_id: formData.cotista_id,
          mes_referencia: mesAnoFormatado,
          valor_devido: valorDevido,
          valor_pago: parseFloat(formData.valor_pago) || 0,
          status: formData.status
        });

      if (insertError) throw insertError;

      await loadMensalidades();
      setShowModal(false);
      setSuccess('Mensalidade adicionada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      if (err.code === '23505') {
        setError('Já existe mensalidade para este cotista neste mês');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mensalidade) => {
    if (!confirm(`Excluir mensalidade de ${mensalidade.cotista?.nome}?`)) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('mensalidades')
        .delete()
        .eq('id', mensalidade.id);

      if (deleteError) throw deleteError;

      await loadMensalidades();
      setSuccess('Mensalidade excluída!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarMensalidades = async () => {
    if (!confirm('Isso irá gerar mensalidades para todos os cotistas neste mês. Continuar?')) {
      return;
    }

    setLoading(true);
    try {
      // Apenas cotistas ativos e que não são admin
      const cotistasAtivos = cotistas.filter(c => !c.is_admin && c.status === 'ativo');
      const valorPorCota = parseFloat(configuracoes?.valor_por_cota || 50);
      const valorRifaPorCota = 20; // R$ 20 por cota para rifa
      
      const mensalidadesParaInserir = cotistasAtivos.map(c => {
        const valorMensalidade = c.cotas * valorPorCota;
        const valorRifa = c.participa_rifa ? c.cotas * valorRifaPorCota : 0;
        
        return {
          cotista_id: c.id,
          mes_referencia: mesAnoFormatado,
          valor_devido: valorMensalidade,
          valor_rifa: valorRifa,
          valor_total: valorMensalidade + valorRifa,
          valor_pago: 0,
          status: 'pendente'
        };
      });

      const { error: insertError } = await supabase
        .from('mensalidades')
        .upsert(mensalidadesParaInserir, { 
          onConflict: 'cotista_id,mes_referencia',
          ignoreDuplicates: true 
        });

      if (insertError) throw insertError;

      await loadMensalidades();
      setSuccess('Mensalidades geradas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pago': return <Check className="text-green-500" size={18} />;
      case 'parcial': return <Clock className="text-yellow-500" size={18} />;
      default: return <AlertCircle className="text-red-500" size={18} />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'pago': return 'bg-green-100 text-green-700';
      case 'parcial': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-red-100 text-red-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            Mensalidades
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Controle de pagamentos mensais
          </p>
        </div>
        
        {/* Seleção de Mês e Ano */}
        <div className="flex items-center gap-2">
          <select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {mesesOpcoes.map(m => (
              <option key={m.valor} value={m.valor}>{m.nome}</option>
            ))}
          </select>
          <select
            value={anoSelecionado}
            onChange={(e) => setAnoSelecionado(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 font-medium"
          >
            {anosOpcoes.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Mensalidade</p>
          <p className="text-xl font-bold text-gray-800">{formatCurrency(stats.valorEsperadoMensalidade)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm flex items-center gap-1">
            <Gift size={14} className="text-purple-500" />
            Rifa
          </p>
          <p className="text-xl font-bold text-purple-600">{formatCurrency(stats.valorEsperadoRifa)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Total Esperado</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(stats.valorEsperadoTotal)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Recebido</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(stats.valorRecebido)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Pagos</p>
          <p className="text-xl font-bold text-green-600">{stats.pagos}/{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Pendentes</p>
          <p className="text-xl font-bold text-red-600">{stats.pendentes}</p>
        </div>
      </div>

      {/* Filtros e Ações */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar cotista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="todos">Todos</option>
              <option value="pago">Pagos</option>
              <option value="parcial">Parciais</option>
              <option value="pendente">Pendentes</option>
            </select>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
            <button
              onClick={handleGerarMensalidades}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={18} />
              <span className="hidden sm:inline">Gerar</span>
            </button>
          </div>
        </div>
        
        {/* Contador de resultados */}
        {(search || filtroStatus !== 'todos') && (
          <div className="mt-3 text-sm text-gray-500">
            Exibindo <span className="font-medium text-gray-700">{mensalidadesFiltradas.length}</span> de <span className="font-medium text-gray-700">{mensalidadesMes.length}</span> registros
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cotista
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Cotas
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Mensalidade
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <Gift size={14} className="text-purple-500" />
                    Rifa
                  </span>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Pago
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mensalidadesFiltradas.map((m) => {
                const cotistaInfo = (cotistas || []).find(c => c.id === m.cotista_id);
                const valorBase = Number(m.valor_devido || 0);
                const valorRifa = cotistaInfo?.participa_rifa ? (cotistaInfo.cotas * 20) : 0;
                
                // Calcular atraso da mensalidade
                // Formato: YYYY-MM (ex: 2026-02)
                const [ano, mes] = (m.mes_referencia || '').split('-').map(Number);
                
                const ultimoDiaMes = new Date(ano, mes, 0); // último dia do mês
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                
                let diasAtraso = 0;
                let multaAtraso = 0;
                let jurosAtraso = 0;
                
                if (m.status !== 'pago' && ano && mes && hoje > ultimoDiaMes) {
                  diasAtraso = Math.floor((hoje - ultimoDiaMes) / (1000 * 60 * 60 * 24));
                  multaAtraso = valorBase * 0.20; // 20% multa fixa
                  jurosAtraso = valorBase * diasAtraso * 0.01; // 1% por dia
                }
                
                const valorComAtraso = valorBase + multaAtraso + jurosAtraso;
                const valorTotal = valorComAtraso + valorRifa;
                const estaAtrasado = diasAtraso > 0;
                
                return (
                <tr key={m.id} className={estaAtrasado ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${estaAtrasado ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {m.cotista?.nome?.charAt(0)}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">{m.cotista?.nome}</span>
                        {cotistaInfo?.participa_rifa && (
                          <span className="ml-2 text-purple-500" title="Participa da rifa">
                            <Gift size={14} className="inline" />
                          </span>
                        )}
                        {estaAtrasado && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                            {diasAtraso}d atraso
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                      {m.cotista?.cotas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {formatCurrency(valorBase)}
                    {estaAtrasado && (
                      <div className="text-xs text-red-600">
                        +{formatCurrency(multaAtraso + jurosAtraso)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {valorRifa > 0 ? (
                      <span className="text-purple-600 font-medium">{formatCurrency(valorRifa)}</span>
                    ) : (
                      <span className="text-gray-400">R$ 0,00</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-center font-medium ${estaAtrasado ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatCurrency(valorTotal)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {formatCurrency(m.valor_pago || 0)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(m.status)}`}>
                      {getStatusIcon(m.status)}
                      {m.status === 'pago' ? 'Pago' : m.status === 'parcial' ? 'Parcial' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1">
                      {m.status !== 'pago' && (
                        <button
                          onClick={() => openPagamentoModal(m)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Pagar
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(m)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {mensalidadesFiltradas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma mensalidade encontrada para este mês</p>
            <button
              onClick={handleGerarMensalidades}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Gerar Mensalidades
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {modalMode === 'pagamento' && 'Registrar Pagamento'}
                {modalMode === 'editar' && 'Editar Mensalidade'}
                {modalMode === 'adicionar' && 'Nova Mensalidade'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Modal Pagamento */}
              {modalMode === 'pagamento' && selectedMensalidade && (
                <>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Cotista</p>
                    <p className="font-medium text-gray-800">{selectedMensalidade.cotista?.nome}</p>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-gray-600">Valor devido:</span>
                      <span className="font-medium">{formatCurrency(selectedMensalidade.valor_devido)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Já pago:</span>
                      <span className="font-medium">{formatCurrency(selectedMensalidade.valor_pago || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t mt-2 pt-2">
                      <span className="text-gray-600">Restante:</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(selectedMensalidade.valor_devido - (selectedMensalidade.valor_pago || 0))}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Valor do Pagamento
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorPagamento}
                        onChange={(e) => setValorPagamento(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Modal Editar/Adicionar */}
              {(modalMode === 'editar' || modalMode === 'adicionar') && (
                <>
                  {modalMode === 'adicionar' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cotista *</label>
                      <select
                        value={formData.cotista_id}
                        onChange={(e) => {
                          const cotista = apenasContistas.find(c => c.id === e.target.value);
                          setFormData({ 
                            ...formData, 
                            cotista_id: e.target.value,
                            valor_devido: cotista ? cotista.cotas * parseFloat(configuracoes?.valor_por_cota || 50) : ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {apenasContistas.map(c => (
                          <option key={c.id} value={c.id}>{c.nome} ({c.cotas} cotas)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalMode === 'editar' && selectedMensalidade && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Cotista</p>
                      <p className="font-medium text-gray-800">{selectedMensalidade.cotista?.nome}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Devido *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_devido}
                      onChange={(e) => setFormData({ ...formData, valor_devido: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_pago}
                      onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="parcial">Parcial</option>
                      <option value="pago">Pago</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (modalMode === 'pagamento') handleRegistrarPagamento();
                  else if (modalMode === 'editar') handleSaveEdit();
                  else handleAddMensalidade();
                }}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                {loading ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mensalidades;
