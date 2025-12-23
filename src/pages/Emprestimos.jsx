import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Filter, Loader2, X, Check, Ban, Eye
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const Emprestimos = () => {
  const { cotista } = useAuthStore();
  const { emprestimos, loadEmprestimos, cotistas } = useAppStore();
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEmprestimo, setSelectedEmprestimo] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadEmprestimos();
  }, []);

  // Filtrar empréstimos
  const emprestimosFiltrados = emprestimos.filter(e => {
    const matchSearch = e.cotista?.nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || e.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  // Separar por status
  const pendentes = emprestimos.filter(e => e.status === 'pendente');
  const ativos = emprestimos.filter(e => e.status === 'ativo');
  const pagos = emprestimos.filter(e => e.status === 'pago');

  // Estatísticas
  const stats = {
    totalEmprestado: ativos.reduce((sum, e) => sum + Number(e.valor_total || 0), 0),
    totalPendente: pendentes.length,
    totalAtivos: ativos.length
  };

  const getStatusBadge = (status) => {
    const config = {
      pendente: { icon: Clock, class: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
      aprovado: { icon: CheckCircle, class: 'bg-blue-100 text-blue-700', label: 'Aprovado' },
      ativo: { icon: DollarSign, class: 'bg-green-100 text-green-700', label: 'Ativo' },
      pago: { icon: CheckCircle, class: 'bg-gray-100 text-gray-700', label: 'Pago' },
      rejeitado: { icon: XCircle, class: 'bg-red-100 text-red-700', label: 'Rejeitado' },
      cancelado: { icon: Ban, class: 'bg-gray-100 text-gray-500', label: 'Cancelado' }
    };
    const { icon: Icon, class: className, label } = config[status] || config.pendente;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${className}`}>
        <Icon size={14} />
        {label}
      </span>
    );
  };

  const handleAprovar = async (emprestimo) => {
    if (!confirm(`Aprovar empréstimo de ${formatCurrency(emprestimo.valor_total)} para ${emprestimo.cotista?.nome}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({
          status: 'ativo',
          aprovado_por: cotista.id,
          data_aprovacao: new Date().toISOString()
        })
        .eq('id', emprestimo.id);

      if (error) throw error;

      await loadEmprestimos();
      setSuccess('Empréstimo aprovado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async (emprestimo) => {
    const motivo = prompt('Motivo da rejeição:');
    if (!motivo) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({
          status: 'rejeitado',
          motivo: `Rejeitado: ${motivo}`
        })
        .eq('id', emprestimo.id);

      if (error) throw error;

      await loadEmprestimos();
      setSuccess('Empréstimo rejeitado.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuitar = async (emprestimo) => {
    if (!confirm(`Confirmar quitação do empréstimo de ${emprestimo.cotista?.nome}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('emprestimos')
        .update({
          status: 'pago',
          data_quitacao: new Date().toISOString()
        })
        .eq('id', emprestimo.id);

      if (error) throw error;

      await loadEmprestimos();
      setSuccess('Empréstimo quitado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetails = (emprestimo) => {
    setSelectedEmprestimo(emprestimo);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <DollarSign className="text-blue-600" />
          Empréstimos
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerenciamento de solicitações e empréstimos ativos
        </p>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalPendente}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Emprestado</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalEmprestado)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Ativos</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalAtivos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Solicitações Pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h2 className="font-semibold text-yellow-800 flex items-center gap-2 mb-4">
            <AlertTriangle size={20} />
            Solicitações Pendentes ({pendentes.length})
          </h2>
          <div className="space-y-3">
            {pendentes.map((e) => (
              <div key={e.id} className="bg-white rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                    {e.cotista?.nome?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{e.cotista?.nome}</p>
                    <p className="text-sm text-gray-500">
                      {e.tipo === 'vista' ? 'À vista' : `Parcelado ${e.parcelas}x`} • 
                      Juros: {e.taxa_juros}%
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(e.valor_total)}</p>
                  <p className="text-xs text-gray-500">Solicitado: {formatCurrency(e.valor_emprestimo)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openDetails(e)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Ver detalhes"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleAprovar(e)}
                    disabled={loading}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    <Check size={16} />
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleRejeitar(e)}
                    disabled={loading}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1"
                  >
                    <Ban size={16} />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="ativo">Ativos</option>
            <option value="pago">Pagos</option>
            <option value="rejeitado">Rejeitados</option>
          </select>
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
                  Tipo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Valor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Total c/ Juros
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
              {emprestimosFiltrados.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {e.cotista?.nome?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{e.cotista?.nome}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(e.created_at)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm">
                      {e.tipo === 'vista' ? 'À vista' : `${e.parcelas}x`}
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">{e.taxa_juros}% juros</span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {formatCurrency(e.valor_emprestimo)}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {formatCurrency(e.valor_total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(e.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openDetails(e)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Ver detalhes"
                      >
                        <Eye size={18} />
                      </button>
                      {e.status === 'ativo' && (
                        <button
                          onClick={() => handleQuitar(e)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emprestimosFiltrados.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhum empréstimo encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showModal && selectedEmprestimo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Detalhes do Empréstimo</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-lg">
                  {selectedEmprestimo.cotista?.nome?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{selectedEmprestimo.cotista?.nome}</p>
                  <p className="text-sm text-gray-500">{selectedEmprestimo.cotista?.cotas} cotas</p>
                </div>
                <div className="ml-auto">
                  {getStatusBadge(selectedEmprestimo.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Valor Solicitado</p>
                  <p className="font-semibold text-gray-800">{formatCurrency(selectedEmprestimo.valor_emprestimo)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Tipo</p>
                  <p className="font-semibold text-gray-800">
                    {selectedEmprestimo.tipo === 'vista' ? 'À vista' : `Parcelado ${selectedEmprestimo.parcelas}x`}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Taxa de Juros</p>
                  <p className="font-semibold text-gray-800">{selectedEmprestimo.taxa_juros}%</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Valor dos Juros</p>
                  <p className="font-semibold text-gray-800">{formatCurrency(selectedEmprestimo.valor_juros)}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg col-span-2">
                  <p className="text-xs text-blue-600">Valor Total a Pagar</p>
                  <p className="font-bold text-xl text-blue-700">{formatCurrency(selectedEmprestimo.valor_total)}</p>
                  {selectedEmprestimo.tipo === 'parcelado' && (
                    <p className="text-sm text-blue-600">
                      {selectedEmprestimo.parcelas}x de {formatCurrency(selectedEmprestimo.valor_parcela)}
                    </p>
                  )}
                </div>
              </div>

              {selectedEmprestimo.motivo && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Motivo</p>
                  <p className="text-gray-800">{selectedEmprestimo.motivo}</p>
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <p>Solicitado em: {formatDate(selectedEmprestimo.created_at)}</p>
                {selectedEmprestimo.data_aprovacao && (
                  <p>Aprovado em: {formatDate(selectedEmprestimo.data_aprovacao)}</p>
                )}
                {selectedEmprestimo.data_quitacao && (
                  <p>Quitado em: {formatDate(selectedEmprestimo.data_quitacao)}</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emprestimos;
