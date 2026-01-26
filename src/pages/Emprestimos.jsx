import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Loader2, X, Check, Ban, Eye, Plus, Edit2, Trash2
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';

const Emprestimos = () => {
  const { cotista } = useAuthStore();
  const { emprestimos, loadEmprestimos, cotistas, mensalidades, configuracoes } = useAppStore();
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('detalhes'); // 'detalhes', 'adicionar', 'editar'
  const [selectedEmprestimo, setSelectedEmprestimo] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Form para adicionar/editar
  const [formData, setFormData] = useState({
    cotista_id: '',
    valor_emprestimo: '',
    tipo: 'vista',
    parcelas: 1,
    motivo: ''
  });

  useEffect(() => {
    loadEmprestimos();
  }, []);

  // Filtrar apenas cotistas (não admins)
  const apenasContistas = cotistas.filter(c => !c.is_admin && c.status === 'ativo');

  // Calcular limite de empréstimo por cotista
  const calcularLimite = (cotistaId) => {
    let totalPago = 0;
    Object.values(mensalidades).forEach(mes => {
      if (Array.isArray(mes)) {
        const registro = mes.find(m => m.cotista_id === cotistaId);
        if (registro) totalPago += Number(registro.valor_pago || 0);
      }
    });
    return totalPago * 0.8; // 80% do investido
  };

  // Filtrar empréstimos (excluindo admins)
  const emprestimosFiltrados = emprestimos
    .filter(e => {
      const cotistaEmprestimo = cotistas.find(c => c.id === e.cotista_id);
      if (cotistaEmprestimo?.is_admin) return false;
      
      const matchSearch = e.cotista?.nome?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || e.status === filtroStatus;
      return matchSearch && matchStatus;
    });

  // Separar por status
  const pendentes = emprestimosFiltrados.filter(e => e.status === 'pendente');
  const ativos = emprestimosFiltrados.filter(e => e.status === 'ativo');

  // Estatísticas (apenas cotistas, não admins) - Principal e Juros separados
  const stats = {
    totalPrincipal: ativos.reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0),
    totalJuros: ativos.reduce((sum, e) => sum + Number(e.valor_juros || 0), 0),
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

  const openAddModal = () => {
    setSelectedEmprestimo(null);
    setFormData({
      cotista_id: '',
      valor_emprestimo: '',
      tipo: 'vista',
      parcelas: 1,
      motivo: ''
    });
    setModalMode('adicionar');
    setError('');
    setShowModal(true);
  };

  const openEditModal = (emprestimo) => {
    setSelectedEmprestimo(emprestimo);
    setFormData({
      cotista_id: emprestimo.cotista_id,
      valor_emprestimo: emprestimo.valor_emprestimo,
      tipo: emprestimo.tipo,
      parcelas: emprestimo.parcelas,
      motivo: emprestimo.motivo || ''
    });
    setModalMode('editar');
    setError('');
    setShowModal(true);
  };

  const openDetails = (emprestimo) => {
    setSelectedEmprestimo(emprestimo);
    setModalMode('detalhes');
    setShowModal(true);
  };

  const handleAddEmprestimo = async () => {
    if (!formData.cotista_id) {
      setError('Selecione um cotista');
      return;
    }

    const valor = parseFloat(formData.valor_emprestimo);
    if (isNaN(valor) || valor <= 0) {
      setError('Valor inválido');
      return;
    }

    // Verificar limite
    const limite = calcularLimite(formData.cotista_id);
    if (valor > limite) {
      setError(`Valor excede o limite de ${formatCurrency(limite)}`);
      return;
    }

    setLoading(true);
    try {
      const jurosVista = parseFloat(configuracoes?.juros_vista || 20);
      const jurosParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
      const taxa = formData.tipo === 'vista' ? jurosVista : jurosParcelado;
      const valorJuros = valor * (taxa / 100);
      const valorTotal = valor + valorJuros;
      const parcelas = formData.tipo === 'parcelado' ? parseInt(formData.parcelas) : 1;

      const { error: insertError } = await supabase
        .from('emprestimos')
        .insert({
          cotista_id: formData.cotista_id,
          valor_emprestimo: valor,
          tipo: formData.tipo,
          parcelas,
          taxa_juros: taxa,
          valor_juros: valorJuros,
          valor_total: valorTotal,
          valor_parcela: valorTotal / parcelas,
          motivo: formData.motivo || null,
          status: 'pendente'
        });

      if (insertError) throw insertError;

      await loadEmprestimos();
      setShowModal(false);
      setSuccess('Empréstimo criado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmprestimo = async () => {
    const valor = parseFloat(formData.valor_emprestimo);
    if (isNaN(valor) || valor <= 0) {
      setError('Valor inválido');
      return;
    }

    setLoading(true);
    try {
      const jurosVista = parseFloat(configuracoes?.juros_vista || 20);
      const jurosParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
      const taxa = formData.tipo === 'vista' ? jurosVista : jurosParcelado;
      const valorJuros = valor * (taxa / 100);
      const valorTotal = valor + valorJuros;
      const parcelas = formData.tipo === 'parcelado' ? parseInt(formData.parcelas) : 1;

      const { error: updateError } = await supabase
        .from('emprestimos')
        .update({
          valor_emprestimo: valor,
          tipo: formData.tipo,
          parcelas,
          taxa_juros: taxa,
          valor_juros: valorJuros,
          valor_total: valorTotal,
          valor_parcela: valorTotal / parcelas,
          motivo: formData.motivo || null
        })
        .eq('id', selectedEmprestimo.id);

      if (updateError) throw updateError;

      await loadEmprestimos();
      setShowModal(false);
      setSuccess('Empréstimo atualizado!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (emprestimo) => {
    if (!confirm(`Excluir empréstimo de ${emprestimo.cotista?.nome}?`)) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('emprestimos')
        .delete()
        .eq('id', emprestimo.id);

      if (deleteError) throw deleteError;

      await loadEmprestimos();
      setSuccess('Empréstimo excluído!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAprovar = async (emprestimo) => {
    if (!confirm(`Aprovar empréstimo de ${formatCurrency(emprestimo.valor_total)} para ${emprestimo.cotista?.nome}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('emprestimos')
        .update({
          status: 'ativo',
          aprovado_por: cotista.id,
          data_aprovacao: new Date().toISOString()
        })
        .eq('id', emprestimo.id);

      if (updateError) throw updateError;

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
      const { error: updateError } = await supabase
        .from('emprestimos')
        .update({
          status: 'rejeitado',
          motivo: `Rejeitado: ${motivo}`
        })
        .eq('id', emprestimo.id);

      if (updateError) throw updateError;

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
      const { error: updateError } = await supabase
        .from('emprestimos')
        .update({
          status: 'pago',
          data_quitacao: new Date().toISOString()
        })
        .eq('id', emprestimo.id);

      if (updateError) throw updateError;

      await loadEmprestimos();
      setSuccess('Empréstimo quitado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calcular preview de valores
  const calcularPreview = () => {
    const valor = parseFloat(formData.valor_emprestimo) || 0;
    const jurosVista = parseFloat(configuracoes?.juros_vista || 20);
    const jurosParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
    const taxa = formData.tipo === 'vista' ? jurosVista : jurosParcelado;
    const valorJuros = valor * (taxa / 100);
    const valorTotal = valor + valorJuros;
    const parcelas = formData.tipo === 'parcelado' ? parseInt(formData.parcelas) || 1 : 1;
    return { taxa, valorJuros, valorTotal, valorParcela: valorTotal / parcelas };
  };

  const preview = calcularPreview();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="text-blue-600" />
            Empréstimos
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerenciamento de solicitações e empréstimos ativos
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo Empréstimo
        </button>
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
              <p className="text-gray-500 text-sm">Principal</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPrincipal)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-orange-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Juros a Receber</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalJuros)}</p>
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
                      Solicitado em: {formatDate(e.created_at)}
                    </p>
                    {e.chave_pix && (
                      <p className="text-sm text-blue-600 font-medium mt-1">
                        PIX: {e.chave_pix}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-800">{formatCurrency(e.valor_emprestimo)}</p>
                  <p className="text-xs text-gray-500">Juros definido no pagamento</p>
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
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openDetails(e)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Ver detalhes"
                      >
                        <Eye size={16} />
                      </button>
                      {(e.status === 'pendente' || e.status === 'ativo') && (
                        <button
                          onClick={() => openEditModal(e)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {e.status === 'ativo' && (
                        <button
                          onClick={() => handleQuitar(e)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(e)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {modalMode === 'detalhes' && 'Detalhes do Empréstimo'}
                {modalMode === 'adicionar' && 'Novo Empréstimo'}
                {modalMode === 'editar' && 'Editar Empréstimo'}
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

              {/* Modal Detalhes */}
              {modalMode === 'detalhes' && selectedEmprestimo && (
                <>
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
                </>
              )}

              {/* Modal Adicionar/Editar */}
              {(modalMode === 'adicionar' || modalMode === 'editar') && (
                <>
                  {modalMode === 'adicionar' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cotista *</label>
                      <select
                        value={formData.cotista_id}
                        onChange={(e) => setFormData({ ...formData, cotista_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione...</option>
                        {apenasContistas.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome} (Limite: {formatCurrency(calcularLimite(c.id))})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalMode === 'editar' && selectedEmprestimo && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">Cotista</p>
                      <p className="font-medium text-gray-800">{selectedEmprestimo.cotista?.nome}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Empréstimo *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_emprestimo}
                      onChange={(e) => setFormData({ ...formData, valor_emprestimo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="vista">À Vista ({configuracoes?.juros_vista || 20}% juros)</option>
                      <option value="parcelado">Parcelado ({configuracoes?.juros_parcelado || 30}% juros)</option>
                    </select>
                  </div>

                  {formData.tipo === 'parcelado' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                      <select
                        value={formData.parcelas}
                        onChange={(e) => setFormData({ ...formData, parcelas: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="2">2x</option>
                        <option value="3">3x</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                    <textarea
                      value={formData.motivo}
                      onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Motivo do empréstimo (opcional)"
                    />
                  </div>

                  {/* Preview dos valores */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Resumo:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-blue-600">Taxa de juros:</span>
                      <span className="font-medium text-right">{preview.taxa}%</span>
                      <span className="text-blue-600">Valor dos juros:</span>
                      <span className="font-medium text-right">{formatCurrency(preview.valorJuros)}</span>
                      <span className="text-blue-600">Total a pagar:</span>
                      <span className="font-bold text-right">{formatCurrency(preview.valorTotal)}</span>
                      {formData.tipo === 'parcelado' && (
                        <>
                          <span className="text-blue-600">Valor da parcela:</span>
                          <span className="font-medium text-right">{formatCurrency(preview.valorParcela)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 sticky bottom-0">
              {modalMode === 'detalhes' ? (
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Fechar
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={modalMode === 'adicionar' ? handleAddEmprestimo : handleEditEmprestimo}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {loading ? 'Salvando...' : 'Confirmar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Emprestimos;
