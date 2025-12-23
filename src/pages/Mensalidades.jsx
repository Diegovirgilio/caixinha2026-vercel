import React, { useState, useEffect } from 'react';
import { 
  Calendar, Check, Clock, AlertCircle, Search, Filter,
  ChevronLeft, ChevronRight, Loader2, X, DollarSign, CheckCircle
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const Mensalidades = () => {
  const { cotistas, mensalidades, loadCotistas, loadMensalidades } = useAppStore();
  const [mesSelecionado, setMesSelecionado] = useState(CONFIG.MESES[0]);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedMensalidade, setSelectedMensalidade] = useState(null);
  const [valorPagamento, setValorPagamento] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadCotistas();
    loadMensalidades();
  }, []);

  // Dados do mês selecionado
  const mensalidadesMes = mensalidades[mesSelecionado] || [];

  // Filtrar
  const mensalidadesFiltradas = mensalidadesMes.filter(m => {
    const matchSearch = m.cotista?.nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || m.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  // Estatísticas do mês
  const stats = {
    total: mensalidadesMes.length,
    pagos: mensalidadesMes.filter(m => m.status === 'pago').length,
    parciais: mensalidadesMes.filter(m => m.status === 'parcial').length,
    pendentes: mensalidadesMes.filter(m => m.status === 'pendente').length,
    valorEsperado: mensalidadesMes.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0),
    valorRecebido: mensalidadesMes.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0)
  };

  const navegarMes = (direcao) => {
    const index = CONFIG.MESES.indexOf(mesSelecionado);
    const novoIndex = index + direcao;
    if (novoIndex >= 0 && novoIndex < CONFIG.MESES.length) {
      setMesSelecionado(CONFIG.MESES[novoIndex]);
    }
  };

  const formatarMes = (mes) => {
    const [ano, m] = mes.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(m) - 1]}/${ano}`;
  };

  const openPagamentoModal = (mensalidade) => {
    setSelectedMensalidade(mensalidade);
    setValorPagamento(String(mensalidade.valor_devido - (mensalidade.valor_pago || 0)));
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
      const novoValorPago = (selectedMensalidade.valor_pago || 0) + valor;
      const status = novoValorPago >= selectedMensalidade.valor_devido ? 'pago' : 'parcial';

      const { error } = await supabase
        .from('mensalidades')
        .update({
          valor_pago: novoValorPago,
          status,
          data_pagamento: new Date().toISOString()
        })
        .eq('id', selectedMensalidade.id);

      if (error) throw error;

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

  const handleGerarMensalidades = async () => {
    if (!confirm('Isso irá gerar mensalidades para todos os cotistas neste mês. Continuar?')) {
      return;
    }

    setLoading(true);
    try {
      const mensalidadesParaInserir = cotistas.map(c => ({
        cotista_id: c.id,
        mes_referencia: mesSelecionado,
        valor_devido: c.cotas * CONFIG.VALOR_POR_COTA,
        valor_pago: 0,
        status: 'pendente'
      }));

      const { error } = await supabase
        .from('mensalidades')
        .upsert(mensalidadesParaInserir, { 
          onConflict: 'cotista_id,mes_referencia',
          ignoreDuplicates: true 
        });

      if (error) throw error;

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
        
        {/* Navegação de Mês */}
        <div className="flex items-center gap-2 bg-white rounded-lg shadow px-2 py-1">
          <button 
            onClick={() => navegarMes(-1)}
            disabled={CONFIG.MESES.indexOf(mesSelecionado) === 0}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium text-gray-800 min-w-[100px] text-center">
            {formatarMes(mesSelecionado)}
          </span>
          <button 
            onClick={() => navegarMes(1)}
            disabled={CONFIG.MESES.indexOf(mesSelecionado) === CONFIG.MESES.length - 1}
            className="p-2 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Esperado</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(stats.valorEsperado)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Recebido</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.valorRecebido)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Pagos</p>
          <p className="text-2xl font-bold text-green-600">{stats.pagos}/{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Pendentes</p>
          <p className="text-2xl font-bold text-red-600">{stats.pendentes}</p>
        </div>
      </div>

      {/* Filtros */}
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
            {mensalidadesMes.length === 0 && (
              <button
                onClick={handleGerarMensalidades}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Gerar Mensalidades
              </button>
            )}
          </div>
        </div>
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
                  Devido
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Pago
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mensalidadesFiltradas.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {m.cotista?.nome?.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{m.cotista?.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                      {m.cotista?.cotas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {formatCurrency(m.valor_devido)}
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
                  <td className="px-6 py-4 text-center">
                    {m.status !== 'pago' && (
                      <button
                        onClick={() => openPagamentoModal(m)}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Registrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mensalidadesFiltradas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhuma mensalidade encontrada para este mês</p>
            {mensalidadesMes.length === 0 && (
              <button
                onClick={handleGerarMensalidades}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Gerar Mensalidades
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Pagamento */}
      {showModal && selectedMensalidade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Registrar Pagamento</h3>
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
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarPagamento}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
