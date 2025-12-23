import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle,
  Plus, Send, Key, PiggyBank, Calendar, FileText
} from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '../store/useStore';
import { emprestimosApi, mensalidadesApi } from '../services/api';
import { formatCurrency, formatPercent, formatMesReferencia } from '../utils/formatters';
import { CONFIG, STATUS_MENSALIDADE_COLORS, STATUS_EMPRESTIMO_COLORS, STATUS_EMPRESTIMO_LABELS } from '../utils/constants';

const UserArea = () => {
  const { cotista } = useAuthStore();
  const { getTotalCotas, getInvestidoByCotista, getLimiteEmprestimo, emprestimos, rifas, cdi } = useAppStore();
  const { setShowPixModal, setShowChangePasswordModal } = useUIStore();
  
  const [minhasMensalidades, setMinhasMensalidades] = useState([]);
  const [meusEmprestimos, setMeusEmprestimos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Formulário de solicitação de empréstimo
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [solicitacao, setSolicitacao] = useState({
    valor: '',
    tipo: 'vista',
    parcelas: 2,
    motivo: ''
  });
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  // Carregar dados do usuário
  useEffect(() => {
    const loadData = async () => {
      if (!cotista?.id) return;
      
      try {
        const [mensalidades, emprestimosData] = await Promise.all([
          mensalidadesApi.getByCotista(cotista.id),
          emprestimosApi.getByCotista(cotista.id)
        ]);
        
        setMinhasMensalidades(mensalidades || []);
        setMeusEmprestimos(emprestimosData || []);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [cotista]);

  // Cálculos
  const totalCotas = getTotalCotas();
  const investido = getInvestidoByCotista(cotista?.id);
  const limite = getLimiteEmprestimo(cotista?.id);
  const participacao = totalCotas > 0 ? ((cotista?.cotas || 0) / totalCotas) * 100 : 0;
  
  // Bônus calculados
  const totalRifas = rifas.reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalCDI = cdi.reduce((s, c) => s + Number(c.valor || 0), 0);
  const bonusRifas = (totalRifas * participacao) / 100;
  const bonusCDI = (totalCDI * participacao) / 100;
  
  // Juros de empréstimos pagos (60% para quem pegou + 40% proporcional)
  const jurosRecebidos = emprestimos
    .filter(e => e.status === 'pago')
    .reduce((total, emp) => {
      const jurosTotal = Number(emp.valor_juros || 0);
      let bonus = 0;
      if (emp.cotista_id === cotista?.id) {
        bonus += jurosTotal * 0.6;
      }
      bonus += (jurosTotal * 0.4 * participacao) / 100;
      return total + bonus;
    }, 0);
  
  const saldoFinal = investido + jurosRecebidos + bonusRifas + bonusCDI;

  // Solicitar empréstimo
  const handleSolicitarEmprestimo = async () => {
    if (!solicitacao.valor) {
      setMensagem({ tipo: 'erro', texto: 'Informe o valor do empréstimo' });
      return;
    }
    
    const valor = parseFloat(solicitacao.valor);
    if (valor > limite) {
      setMensagem({ tipo: 'erro', texto: `Valor excede seu limite de ${formatCurrency(limite)}` });
      return;
    }

    setEnviando(true);
    try {
      const taxaJuros = solicitacao.tipo === 'vista' ? CONFIG.JUROS_VISTA : CONFIG.JUROS_PARCELADO;
      
      await emprestimosApi.solicitar({
        cotista_id: cotista.id,
        valor,
        tipo: solicitacao.tipo,
        parcelas: solicitacao.tipo === 'parcelado' ? parseInt(solicitacao.parcelas) : 1,
        motivo: solicitacao.motivo,
        taxa_juros: taxaJuros
      });

      setMensagem({ tipo: 'sucesso', texto: 'Solicitação enviada! Aguarde aprovação.' });
      setSolicitacao({ valor: '', tipo: 'vista', parcelas: 2, motivo: '' });
      setShowSolicitacao(false);
      
      // Recarregar empréstimos
      const novosEmprestimos = await emprestimosApi.getByCotista(cotista.id);
      setMeusEmprestimos(novosEmprestimos);
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar solicitação' });
    } finally {
      setEnviando(false);
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000);
    }
  };

  // Preview do empréstimo
  const taxaJuros = solicitacao.tipo === 'vista' ? CONFIG.JUROS_VISTA : CONFIG.JUROS_PARCELADO;
  const valorEmprestimo = parseFloat(solicitacao.valor) || 0;
  const valorJuros = valorEmprestimo * (taxaJuros / 100);
  const valorTotal = valorEmprestimo + valorJuros;
  const valorParcela = solicitacao.tipo === 'parcelado' ? valorTotal / solicitacao.parcelas : valorTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mensagens */}
      {mensagem.texto && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          mensagem.tipo === 'sucesso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {mensagem.tipo === 'sucesso' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {mensagem.texto}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 rounded-xl text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
              {cotista?.nome?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">Olá, {cotista?.nome?.split(' ')[0]}!</h1>
              <p className="text-blue-200">Bem-vindo à sua área</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all"
            >
              <Key size={18} />
              Alterar Senha
            </button>
            <button
              onClick={() => setShowPixModal(true)}
              className="bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:from-green-600 hover:to-teal-600 transition-all"
            >
              <DollarSign size={18} />
              PIX
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <p className="text-sm text-gray-600">Minhas Cotas</p>
          <p className="text-2xl font-bold text-blue-700">{cotista?.cotas || 0}</p>
          <p className="text-xs text-gray-400">{formatPercent(participacao)} do total</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Total Investido</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(investido)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
          <p className="text-sm text-gray-600">Limite de Empréstimo</p>
          <p className="text-2xl font-bold text-orange-700">{formatCurrency(limite)}</p>
          <p className="text-xs text-gray-400">80% do investido</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-emerald-500">
          <p className="text-sm text-gray-600">Saldo Final Projetado</p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(saldoFinal)}</p>
        </div>
      </div>

      {/* Bônus */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp className="text-green-600" size={20} />
          Seus Bônus
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Juros Recebidos</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(jurosRecebidos)}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Bônus de Rifas</p>
            <p className="text-xl font-bold text-purple-700">{formatCurrency(bonusRifas)}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Rendimento CDI</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(bonusCDI)}</p>
          </div>
        </div>
      </div>

      {/* Empréstimos */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <PiggyBank className="text-orange-600" size={20} />
            Empréstimos
          </h2>
          <button
            onClick={() => setShowSolicitacao(!showSolicitacao)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-orange-600 hover:to-orange-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Solicitar Empréstimo
          </button>
        </div>

        {/* Formulário de Solicitação */}
        {showSolicitacao && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-medium text-gray-800 mb-3">Nova Solicitação</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                <input
                  type="number"
                  value={solicitacao.valor}
                  onChange={(e) => setSolicitacao({ ...solicitacao, valor: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="0,00"
                />
                <p className="text-xs text-gray-500 mt-1">Limite: {formatCurrency(limite)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={solicitacao.tipo}
                  onChange={(e) => setSolicitacao({ ...solicitacao, tipo: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="vista">À Vista ({CONFIG.JUROS_VISTA}% juros)</option>
                  <option value="parcelado">Parcelado ({CONFIG.JUROS_PARCELADO}% juros)</option>
                </select>
              </div>
              {solicitacao.tipo === 'parcelado' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                  <select
                    value={solicitacao.parcelas}
                    onChange={(e) => setSolicitacao({ ...solicitacao, parcelas: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <input
                  type="text"
                  value={solicitacao.motivo}
                  onChange={(e) => setSolicitacao({ ...solicitacao, motivo: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: Emergência médica"
                />
              </div>
            </div>

            {valorEmprestimo > 0 && (
              <div className="mt-4 p-3 bg-white rounded-lg border">
                <p className="text-sm font-medium text-gray-700">Prévia:</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div>
                    <p className="text-gray-500">Juros</p>
                    <p className="font-medium text-orange-600">{formatCurrency(valorJuros)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-medium">{formatCurrency(valorTotal)}</p>
                  </div>
                  {solicitacao.tipo === 'parcelado' && (
                    <div>
                      <p className="text-gray-500">Parcela</p>
                      <p className="font-medium">{solicitacao.parcelas}x de {formatCurrency(valorParcela)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSolicitarEmprestimo}
                disabled={enviando}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                {enviando ? 'Enviando...' : 'Enviar Solicitação'}
              </button>
              <button
                onClick={() => setShowSolicitacao(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de Empréstimos */}
        {meusEmprestimos.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Você não possui empréstimos</p>
        ) : (
          <div className="space-y-2">
            {meusEmprestimos.map((emp) => (
              <div key={emp.id} className={`p-4 rounded-lg border ${
                emp.status === 'ativo' ? 'bg-orange-50 border-orange-200' : 
                emp.status === 'pago' ? 'bg-green-50 border-green-200' :
                emp.status === 'pendente' ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{formatCurrency(emp.valor_emprestimo)}</p>
                    <p className="text-sm text-gray-500">
                      {emp.tipo === 'vista' ? 'À Vista' : `${emp.parcelas}x`} • 
                      Total: {formatCurrency(emp.valor_total)}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_EMPRESTIMO_COLORS[emp.status]}`}>
                    {STATUS_EMPRESTIMO_LABELS[emp.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mensalidades */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="text-blue-600" size={20} />
          Minhas Mensalidades
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devido</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {minhasMensalidades.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {formatMesReferencia(m.mes_referencia)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(m.valor_devido)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(m.valor_pago)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_MENSALIDADE_COLORS[m.status]}`}>
                      {m.status === 'pago' ? '✓ Pago' : m.status === 'parcial' ? '◐ Parcial' : '○ Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserArea;
