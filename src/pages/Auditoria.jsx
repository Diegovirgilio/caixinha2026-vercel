import React, { useState, useEffect } from 'react';
import { 
  Search, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  DollarSign, Users, Calculator, Eye, Edit2, Save, X,
  TrendingUp, TrendingDown, Filter
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';

const Auditoria = () => {
  const { cotistas, mensalidades, loadCotistas, loadMensalidades } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos, divergentes, corretos
  const [auditoriaData, setAuditoriaData] = useState([]);
  const [selectedCotista, setSelectedCotista] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Filtrar apenas cotistas (não admins)
  const apenasContistas = (cotistas || []).filter(c => !c.is_admin && c.status === 'ativo');

  // Calcular dados de auditoria para cada cotista
  useEffect(() => {
    calcularAuditoria();
  }, [cotistas, mensalidades]);

  const calcularAuditoria = () => {
    const dados = apenasContistas.map(cotista => {
      // Buscar todas as mensalidades do cotista
      const mensalidadesCotista = Object.values(mensalidades)
        .flat()
        .filter(m => m.cotista_id === cotista.id);

      // Valor esperado por mês (cota + rifa se participar)
      const valorMensalidade = cotista.cotas * 50;
      const valorRifa = cotista.participa_rifa ? cotista.cotas * 20 : 0;
      const valorEsperadoPorMes = valorMensalidade + valorRifa;

      // Calcular totais
      const mesesPagos = mensalidadesCotista.filter(m => m.status === 'pago').length;
      const valorEsperadoTotal = mesesPagos * valorEsperadoPorMes;
      
      // Valor pago registrado no banco
      const valorPagoRegistrado = mensalidadesCotista.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
      
      // Valor devido total (sem contar rifa no banco)
      const valorDevidoTotal = mensalidadesCotista.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);

      // Diferença
      const diferenca = valorPagoRegistrado - valorEsperadoTotal;
      const temDivergencia = Math.abs(diferenca) > 0.01; // Margem de erro de 1 centavo

      // Detalhe por mês
      const detalhesMeses = mensalidadesCotista.map(m => ({
        mes: m.mes_referencia,
        valorDevido: Number(m.valor_devido || 0),
        valorRifa: cotista.participa_rifa ? cotista.cotas * 20 : 0,
        valorTotal: Number(m.valor_devido || 0) + (cotista.participa_rifa ? cotista.cotas * 20 : 0),
        valorPago: Number(m.valor_pago || 0),
        status: m.status,
        id: m.id
      }));

      return {
        cotista,
        cotas: cotista.cotas,
        participaRifa: cotista.participa_rifa,
        valorMensalidade,
        valorRifa,
        valorEsperadoPorMes,
        mesesPagos,
        totalMeses: mensalidadesCotista.length,
        valorEsperadoTotal,
        valorPagoRegistrado,
        valorDevidoTotal,
        diferenca,
        temDivergencia,
        detalhesMeses
      };
    });

    setAuditoriaData(dados);
  };

  // Filtrar dados
  const dadosFiltrados = auditoriaData.filter(d => {
    const matchSearch = d.cotista.nome.toLowerCase().includes(search.toLowerCase());
    const matchFiltro = 
      filtro === 'todos' ||
      (filtro === 'divergentes' && d.temDivergencia) ||
      (filtro === 'corretos' && !d.temDivergencia);
    return matchSearch && matchFiltro;
  });

  // Estatísticas gerais
  const stats = {
    totalCotistas: auditoriaData.length,
    cotistasCorretos: auditoriaData.filter(d => !d.temDivergencia).length,
    cotistasDivergentes: auditoriaData.filter(d => d.temDivergencia).length,
    totalDiferenca: auditoriaData.reduce((sum, d) => sum + d.diferenca, 0)
  };

  // Abrir modal de detalhes
  const openDetalhes = (data) => {
    setSelectedCotista(data);
    setShowModal(true);
  };

  // Corrigir valores de um cotista específico
  const handleCorrigirCotista = async (data) => {
    if (!confirm(`Corrigir valores de ${data.cotista.nome}?\n\nIsso vai ajustar o valor_pago de cada mensalidade paga para o valor correto (mensalidade + rifa).`)) {
      return;
    }

    setLoading(true);
    try {
      // Atualizar cada mensalidade paga
      for (const mes of data.detalhesMeses) {
        if (mes.status === 'pago') {
          await supabase
            .from('mensalidades')
            .update({ valor_pago: mes.valorTotal })
            .eq('id', mes.id);
        }
      }

      await loadMensalidades();
      setSuccess(`Valores de ${data.cotista.nome} corrigidos!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Corrigir todos os divergentes
  const handleCorrigirTodos = async () => {
    const divergentes = auditoriaData.filter(d => d.temDivergencia);
    if (divergentes.length === 0) {
      setError('Não há divergências para corrigir');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!confirm(`Corrigir ${divergentes.length} cotistas com divergências?\n\nIsso vai ajustar o valor_pago de cada mensalidade paga para o valor correto.`)) {
      return;
    }

    setLoading(true);
    try {
      for (const data of divergentes) {
        for (const mes of data.detalhesMeses) {
          if (mes.status === 'pago') {
            await supabase
              .from('mensalidades')
              .update({ valor_pago: mes.valorTotal })
              .eq('id', mes.id);
          }
        }
      }

      await loadMensalidades();
      setSuccess(`${divergentes.length} cotistas corrigidos!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar dados
  const handleRefresh = async () => {
    setLoading(true);
    await loadCotistas();
    await loadMensalidades();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="text-purple-600" />
            Auditoria de Valores
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Controle e verificação dos valores investidos por cotista
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          {stats.cotistasDivergentes > 0 && (
            <button
              onClick={handleCorrigirTodos}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 disabled:opacity-50"
            >
              <AlertTriangle size={18} />
              Corrigir Todos ({stats.cotistasDivergentes})
            </button>
          )}
        </div>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <XCircle size={20} />
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Cotistas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCotistas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Valores Corretos</p>
              <p className="text-2xl font-bold text-green-600">{stats.cotistasCorretos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Com Divergência</p>
              <p className="text-2xl font-bold text-red-600">{stats.cotistasDivergentes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stats.totalDiferenca > 0 ? 'bg-red-100' : stats.totalDiferenca < 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
              <DollarSign className={stats.totalDiferenca > 0 ? 'text-red-600' : stats.totalDiferenca < 0 ? 'text-orange-600' : 'text-green-600'} size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Diferença Total</p>
              <p className={`text-2xl font-bold ${stats.totalDiferenca > 0 ? 'text-red-600' : stats.totalDiferenca < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {stats.totalDiferenca > 0 ? '+' : ''}{formatCurrency(stats.totalDiferenca)}
              </p>
            </div>
          </div>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltro('todos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filtro === 'todos' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Todos ({stats.totalCotistas})
            </button>
            <button
              onClick={() => setFiltro('divergentes')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filtro === 'divergentes' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Divergentes ({stats.cotistasDivergentes})
            </button>
            <button
              onClick={() => setFiltro('corretos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filtro === 'corretos' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Corretos ({stats.cotistasCorretos})
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Auditoria */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cotista</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cotas</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rifa</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Valor/Mês</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Meses Pagos</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Esperado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Registrado</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Diferença</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dadosFiltrados.map((data) => (
                <tr key={data.cotista.id} className={`hover:bg-gray-50 ${data.temDivergencia ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium text-sm">
                        {data.cotista.nome.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{data.cotista.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                      {data.cotas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {data.participaRifa ? (
                      <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs">Sim</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {formatCurrency(data.valorEsperadoPorMes)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {data.mesesPagos}/{data.totalMeses}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">
                    {formatCurrency(data.valorEsperadoTotal)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">
                    {formatCurrency(data.valorPagoRegistrado)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {data.diferenca !== 0 ? (
                      <span className={`font-medium ${data.diferenca > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {data.diferenca > 0 ? '+' : ''}{formatCurrency(data.diferenca)}
                      </span>
                    ) : (
                      <span className="text-green-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {data.temDivergencia ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                        <AlertTriangle size={12} />
                        Divergente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <CheckCircle size={12} />
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openDetalhes(data)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Ver detalhes"
                      >
                        <Eye size={18} />
                      </button>
                      {data.temDivergencia && (
                        <button
                          onClick={() => handleCorrigirCotista(data)}
                          disabled={loading}
                          className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
                          title="Corrigir valores"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {dadosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum cotista encontrado
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {showModal && selectedCotista && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calculator size={20} className="text-purple-600" />
                Detalhes - {selectedCotista.cotista.nome}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Resumo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600">Cotas</p>
                  <p className="text-lg font-bold text-blue-800">{selectedCotista.cotas}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-xs text-purple-600">Rifa</p>
                  <p className="text-lg font-bold text-purple-800">{selectedCotista.participaRifa ? 'Sim' : 'Não'}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs text-green-600">Valor/Mês</p>
                  <p className="text-lg font-bold text-green-800">{formatCurrency(selectedCotista.valorEsperadoPorMes)}</p>
                </div>
                <div className={`p-3 rounded-lg ${selectedCotista.temDivergencia ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={`text-xs ${selectedCotista.temDivergencia ? 'text-red-600' : 'text-green-600'}`}>Diferença</p>
                  <p className={`text-lg font-bold ${selectedCotista.temDivergencia ? 'text-red-800' : 'text-green-800'}`}>
                    {formatCurrency(selectedCotista.diferenca)}
                  </p>
                </div>
              </div>

              {/* Cálculo explicado */}
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p className="font-medium text-gray-700 mb-2">Cálculo:</p>
                <div className="space-y-1 text-gray-600">
                  <p>Mensalidade: {selectedCotista.cotas} cotas × R$ 50 = {formatCurrency(selectedCotista.valorMensalidade)}</p>
                  {selectedCotista.participaRifa && (
                    <p>Rifa: {selectedCotista.cotas} cotas × R$ 20 = {formatCurrency(selectedCotista.valorRifa)}</p>
                  )}
                  <p className="font-medium">Total por mês: {formatCurrency(selectedCotista.valorEsperadoPorMes)}</p>
                  <p>Meses pagos: {selectedCotista.mesesPagos}</p>
                  <p className="font-bold text-gray-800">Esperado total: {formatCurrency(selectedCotista.valorEsperadoTotal)}</p>
                  <p className="font-bold text-gray-800">Registrado no banco: {formatCurrency(selectedCotista.valorPagoRegistrado)}</p>
                </div>
              </div>

              {/* Tabela de meses */}
              <div>
                <p className="font-medium text-gray-700 mb-2">Detalhes por mês:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Mês</th>
                        <th className="px-3 py-2 text-center">Mensalidade</th>
                        <th className="px-3 py-2 text-center">Rifa</th>
                        <th className="px-3 py-2 text-center">Total</th>
                        <th className="px-3 py-2 text-center">Pago</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedCotista.detalhesMeses.map((mes, idx) => {
                        const diferenca = mes.valorPago - mes.valorTotal;
                        const temDiferenca = mes.status === 'pago' && Math.abs(diferenca) > 0.01;
                        return (
                          <tr key={idx} className={temDiferenca ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2">{mes.mes}</td>
                            <td className="px-3 py-2 text-center">{formatCurrency(mes.valorDevido)}</td>
                            <td className="px-3 py-2 text-center text-purple-600">{formatCurrency(mes.valorRifa)}</td>
                            <td className="px-3 py-2 text-center font-medium text-blue-600">{formatCurrency(mes.valorTotal)}</td>
                            <td className="px-3 py-2 text-center font-medium">{formatCurrency(mes.valorPago)}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                mes.status === 'pago' ? 'bg-green-100 text-green-700' :
                                mes.status === 'parcial' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {mes.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Fechar
              </button>
              {selectedCotista.temDivergencia && (
                <button
                  onClick={() => {
                    handleCorrigirCotista(selectedCotista);
                    setShowModal(false);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Edit2 size={18} />
                  Corrigir Valores
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
