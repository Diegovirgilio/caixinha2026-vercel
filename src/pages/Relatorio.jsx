import React from 'react';
import { 
  FileText, Download, TrendingUp, TrendingDown, DollarSign,
  Users, Calendar, PiggyBank, Gift, Percent, BarChart3
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const Relatorio = () => {
  const { cotistas, mensalidades, emprestimos, rifas, cdi, isLoading, rifaSorteios, juros_atraso, juros_emprestimo } = useAppStore();
  
  // Filtrar apenas cotistas (não admins)
  const apenasContistas = cotistas.filter(c => !c.is_admin);

  // ===== CÁLCULOS (apenas cotistas, não admins) =====

  // Total de cotas
  const totalCotas = apenasContistas.reduce((sum, c) => sum + (c.cotas || 0), 0);

  // Filtrar mensalidades excluindo admins
  const todasMensalidades = Object.values(mensalidades).flat().filter(m => {
    const cotista = cotistas.find(c => c.id === m.cotista_id);
    return !cotista?.is_admin;
  });
  const totalEsperado = todasMensalidades.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);
  const totalRecebido = todasMensalidades.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
  const totalPendente = totalEsperado - totalRecebido;
  const percentualRecebido = totalEsperado > 0 ? (totalRecebido / totalEsperado) * 100 : 0;

  // Mensalidades por status
  const mensalidadesPagas = todasMensalidades.filter(m => m.status === 'pago').length;
  const mensalidadesParciais = todasMensalidades.filter(m => m.status === 'parcial').length;
  const mensalidadesPendentes = todasMensalidades.filter(m => m.status === 'pendente').length;

  // Empréstimos (excluindo admins)
  const emprestimosValidos = emprestimos.filter(e => {
    const cotista = cotistas.find(c => c.id === e.cotista_id);
    return !cotista?.is_admin;
  });
  const emprestimosAtivos = emprestimosValidos.filter(e => e.status === 'ativo');
  const totalEmprestado = emprestimosAtivos.reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);
  const jurosEmprestimosAtivos = emprestimosAtivos.reduce((sum, e) => sum + Number(e.valor_juros || 0), 0);
  const emprestimosPagos = emprestimosValidos.filter(e => e.status === 'pago');
  const totalRecebidoEmprestimos = emprestimosPagos.reduce((sum, e) => sum + Number(e.valor_total || 0), 0);
  const jurosRecebidos = emprestimosPagos.reduce((sum, e) => sum + Number(e.valor_juros || 0), 0);

  // Rifas pagas (valor_rifa das mensalidades) — fonte principal
  const rifasPagas = todasMensalidades
    .filter(m => m.status === 'pago' || m.status === 'parcial')
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);

  // Prêmios de rifa pagos
  const premiosRifaPagos = (rifaSorteios || [])
    .reduce((sum, s) => sum + Number(s.valor_premio || 0), 0);

  // Juros de atraso recebidos
  const totalJurosAtraso = (juros_atraso || [])
    .reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);

  // Juros de empréstimo (da tabela juros_emprestimo — mais preciso que emprestimos.valor_juros)
  const totalJurosEmprestimoTabela = (juros_emprestimo || [])
    .reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);
  // Usar o maior dos dois — tabela juros_emprestimo é mais precisa quando preenchida
  const jurosEmpRecebidos = totalJurosEmprestimoTabela > 0 ? totalJurosEmprestimoTabela : jurosRecebidos;

  // CDI
  const totalCdi = cdi.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  // ===== SALDO ATUAL (mesma fórmula do Dashboard e verificar_calculos.sql) =====
  // Entradas: mensalidades + rifas_pagas + JUROS de empréstimos + juros atraso + CDI
  // Saídas: empréstimos ativos (principal) + prêmios rifa
  const saldoAtual = totalRecebido + rifasPagas + jurosEmpRecebidos + totalJurosAtraso + totalCdi - totalEmprestado - premiosRifaPagos;

  // Total Extras inclui TODOS os rendimentos (FIX: faltava juros_atraso)
  const totalExtras = rifasPagas + totalCdi + jurosEmpRecebidos + totalJurosAtraso;

  // Dados por mês (excluindo admins)
  const dadosPorMes = CONFIG.MESES.map(mes => {
    const mensMes = (mensalidades[mes] || []).filter(m => {
      const cotista = cotistas.find(c => c.id === m.cotista_id);
      return !cotista?.is_admin;
    });
    const esperado = mensMes.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);
    const recebido = mensMes.reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
    const [ano, m] = mes.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      mes,
      label: meses[parseInt(m) - 1],
      esperado,
      recebido,
      percentual: esperado > 0 ? (recebido / esperado) * 100 : 0
    };
  });

  // Top 10 cotistas por investimento (excluindo admins)
  const topCotistas = apenasContistas
    .map(c => {
      const totalPago = Object.values(mensalidades).flat()
        .filter(m => m.cotista_id === c.id)
        .reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
      return { ...c, totalPago };
    })
    .sort((a, b) => b.totalPago - a.totalPago)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="text-blue-600" />
            Relatório Financeiro
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Visão geral da Caixinha 2026
          </p>
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Esperado</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalEsperado)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar size={24} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Recebido</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalRecebido)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-2 bg-white/20 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all"
              style={{ width: `${Math.min(percentualRecebido, 100)}%` }}
            />
          </div>
          <p className="text-xs mt-1 text-green-100">{percentualRecebido.toFixed(1)}% do esperado</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Pendente</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalPendente)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Saldo Atual</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(saldoAtual)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <PiggyBank size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Cotistas</p>
              <p className="text-xl font-bold text-gray-800">{apenasContistas.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Cotas</p>
              <p className="text-xl font-bold text-gray-800">{totalCotas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Emprestado</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(totalEmprestado)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Percent className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Juros Recebidos</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(jurosRecebidos)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de Barras por Mês */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="text-blue-600" size={20} />
          Recebimento por Mês
        </h2>
        <div className="space-y-3">
          {dadosPorMes.map((item) => (
            <div key={item.mes} className="flex items-center gap-4">
              <span className="w-10 text-sm font-medium text-gray-600">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div 
                  className={`h-6 rounded-full flex items-center justify-end pr-2 text-xs font-medium text-white transition-all ${
                    item.percentual >= 100 ? 'bg-green-500' : 
                    item.percentual >= 50 ? 'bg-blue-500' : 
                    item.percentual > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}
                  style={{ width: `${Math.min(item.percentual, 100)}%`, minWidth: item.percentual > 0 ? '40px' : '0' }}
                >
                  {item.percentual > 0 && `${item.percentual.toFixed(0)}%`}
                </div>
              </div>
              <div className="w-32 text-right">
                <span className="text-sm text-gray-600">
                  {formatCurrency(item.recebido)} / {formatCurrency(item.esperado)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid com Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumo de Mensalidades */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="text-blue-600" size={20} />
            Status das Mensalidades
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700">Pagas</span>
              </div>
              <span className="font-bold text-green-600">{mensalidadesPagas}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-gray-700">Parciais</span>
              </div>
              <span className="font-bold text-yellow-600">{mensalidadesParciais}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-700">Pendentes</span>
              </div>
              <span className="font-bold text-red-600">{mensalidadesPendentes}</span>
            </div>
          </div>
        </div>

        {/* Receitas Extras */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Gift className="text-purple-600" size={20} />
            Receitas Extras
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Gift className="text-purple-500" size={20} />
                <span className="text-gray-700">Rifas Arrecadadas</span>
              </div>
              <span className="font-bold text-purple-600">{formatCurrency(rifasPagas)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="text-green-500" size={20} />
                <span className="text-gray-700">Rendimentos CDI ({cdi.length})</span>
              </div>
              <span className="font-bold text-green-600">{formatCurrency(totalCdi)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Percent className="text-orange-500" size={20} />
                <span className="text-gray-700">Juros de Empréstimos</span>
              </div>
              <span className="font-bold text-orange-600">{formatCurrency(jurosEmpRecebidos)}</span>
            </div>
            {totalJurosAtraso > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Percent className="text-red-500" size={20} />
                  <span className="text-gray-700">Juros de Atraso</span>
                </div>
                <span className="font-bold text-red-600">{formatCurrency(totalJurosAtraso)}</span>
              </div>
            )}
            {premiosRifaPagos > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Gift className="text-yellow-600" size={20} />
                  <span className="text-gray-700">Prêmios Rifa (saída)</span>
                </div>
                <span className="font-bold text-yellow-700">- {formatCurrency(premiosRifaPagos)}</span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-t-2 border-blue-200">
              <span className="font-semibold text-gray-700">Total Extras</span>
              <span className="font-bold text-blue-600">
                {formatCurrency(totalExtras)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Cotistas */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users className="text-blue-600" size={20} />
          Top 10 Cotistas por Investimento
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cotista</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cotas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topCotistas.map((c, index) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                        {c.nome?.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm">
                      {c.cotas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    {formatCurrency(c.totalPago)}
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

export default Relatorio;
