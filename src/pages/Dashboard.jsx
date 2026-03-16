import React, { useEffect, useState } from 'react';
import { 
  DollarSign, TrendingUp, Users, Calendar, PiggyBank, 
  AlertCircle, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';

const Dashboard = () => {
  const { cotistas, emprestimos, rifas, cdi, getTotalCotas, getTotalInvestido, configuracoes, mensalidades, rifaSorteios, juros_atraso } = useAppStore();
  const { cotista } = useAuthStore();
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filtrar apenas cotistas (não admins)
  const apenasContistas = (cotistas || []).filter(c => !c.is_admin);
  const totalCotasCalc = apenasContistas.reduce((sum, c) => sum + (c.cotas || 0), 0);

  useEffect(() => {
    const loadResumo = async () => {
      try {
        const data = await dashboardApi.getResumoGeral();
        setResumo(data);
      } catch (error) {
        console.error('Erro ao carregar resumo:', error);
        // Calcular localmente se falhar (excluindo admins)
        setResumo({
          totalCotas: totalCotasCalc,
          totalCotistas: apenasContistas.length,
          totalInvestido: getTotalInvestido(),
          totalEmprestimosAtivos: (emprestimos || []).filter(e => e.status === 'ativo').reduce((s, e) => s + Number(e.valor_emprestimo || 0), 0),
          totalJuros: (emprestimos || []).filter(e => e.status === 'pago').reduce((s, e) => s + Number(e.valor_juros || 0), 0),
          totalRifas: (rifas || []).reduce((s, r) => s + Number(r.valor || 0), 0),
          totalCDI: (cdi || []).reduce((s, c) => s + Number(c.valor || 0), 0)
        });
      } finally {
        setLoading(false);
      }
    };
    loadResumo();
  }, [cotistas, emprestimos, rifas, cdi]);

  const totalCotas = resumo?.totalCotas || totalCotasCalc;
  
  // Patrimônio Total = tudo que a caixinha acumulou (sem subtrair empréstimos ativos)
  // Inclui: investido + juros emp + juros atraso + rifas pagas + CDI
  const patrimonioTotal = (resumo?.totalInvestido || 0) + (resumo?.totalJuros || 0) + (resumo?.totalRifas || 0) + (resumo?.totalCDI || 0) + totalJurosAtraso;
  
  // ===== SALDO EM CONTA (Caixa Real) =====
  const adminIds = (cotistas || []).filter(c => c.is_admin).map(c => c.id);
  
  const mensalidadesPagas = Object.values(mensalidades || {}).flat()
    .filter(m => !adminIds.includes(m.cotista_id))
    .filter(m => m.status === 'pago' || m.status === 'parcial')
    .reduce((sum, m) => sum + Number(m.valor_pago || 0), 0);
  
  const rifasPagas = Object.values(mensalidades || {}).flat()
    .filter(m => !adminIds.includes(m.cotista_id))
    .filter(m => m.status === 'pago' || m.status === 'parcial')
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);
  
  const jurosEmprestimosRecebidos = (emprestimos || [])
    .filter(e => !adminIds.includes(e.cotista_id))
    .filter(e => e.status === 'pago')
    .reduce((sum, e) => sum + Number(e.valor_juros || 0), 0);
  
  const totalJurosAtraso = (juros_atraso || [])
    .reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);
  
  const cdiAcumulado = (cdi || []).reduce((sum, c) => sum + Number(c.valor || 0), 0);
  
  const emprestimosAtivos = (emprestimos || [])
    .filter(e => !adminIds.includes(e.cotista_id))
    .filter(e => e.status === 'ativo')
    .reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);
  
  const premiosRifaPagos = (rifaSorteios || [])
    .reduce((sum, s) => sum + Number(s.valor_premio || 0), 0);
  
  const saldoEmConta = mensalidadesPagas + rifasPagas + jurosEmprestimosRecebidos + totalJurosAtraso + cdiAcumulado - emprestimosAtivos - premiosRifaPagos;
  
  // Empréstimos pendentes de aprovação (excluindo admins)
  const emprestimosPendentes = (emprestimos || []).filter(e => {
    const cotistaEmprestimo = (cotistas || []).find(c => c.id === e.cotista_id);
    return e.status === 'pendente' && !cotistaEmprestimo?.is_admin;
  });

  // Empréstimos em atraso (vencidos)
  const hoje = new Date();
  const emprestimosAtrasados = (emprestimos || []).filter(e => {
    if (e.status !== 'ativo' || !e.data_vencimento) return false;
    const vencimento = new Date(e.data_vencimento);
    return hoje > vencimento;
  });

  const StatCard = ({ title, value, icon: Icon, color, subtext, trend }) => (
    <div className={`bg-gradient-to-br ${color} p-6 rounded-xl shadow-lg text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtext && <p className="text-xs opacity-70 mt-1">{subtext}</p>}
        </div>
        <div className="flex flex-col items-end">
          <Icon className="opacity-80" size={32} />
          {trend && (
            <div className={`flex items-center text-xs mt-2 ${trend > 0 ? 'text-green-200' : 'text-red-200'}`}>
              {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500">Visão geral da Caixinha 2026</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Patrimônio Total</p>
          <p className="text-3xl font-bold text-blue-600">{formatCurrency(patrimonioTotal)}</p>
        </div>
      </div>

      {/* Card Saldo em Conta - Destaque */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={24} />
              <p className="text-lg font-medium opacity-90">Saldo em Conta</p>
            </div>
            <p className="text-4xl font-bold">{formatCurrency(saldoEmConta)}</p>
            <p className="text-sm opacity-80 mt-2">Dinheiro disponível na caixinha</p>
          </div>
          <div className="text-right text-sm opacity-80 space-y-1">
            <p>+ Mensalidades: {formatCurrency(mensalidadesPagas)}</p>
            <p>+ Rifas: {formatCurrency(rifasPagas)}</p>
            <p>+ Juros empréstimos: {formatCurrency(jurosEmprestimosRecebidos)}</p>
            {totalJurosAtraso > 0 && <p>+ Juros atraso: {formatCurrency(totalJurosAtraso)}</p>}
            {cdiAcumulado > 0 && <p>+ CDI: {formatCurrency(cdiAcumulado)}</p>}
            <p className="text-orange-200">- Empréstimos ativos: {formatCurrency(emprestimosAtivos)}</p>
            {premiosRifaPagos > 0 && <p className="text-orange-200">- Prêmios rifa: {formatCurrency(premiosRifaPagos)}</p>}
          </div>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Investido"
          value={formatCurrency(resumo?.totalInvestido || 0)}
          icon={DollarSign}
          color="from-blue-500 to-blue-600"
          subtext={`${totalCotas} cotas`}
        />
        <StatCard
          title="CDI Acumulado"
          value={formatCurrency(resumo?.totalCDI || 0)}
          icon={TrendingUp}
          color="from-green-500 to-green-600"
        />
        <StatCard
          title="Rifas"
          value={formatCurrency(resumo?.totalRifas || 0)}
          icon={PiggyBank}
          color="from-purple-500 to-purple-600"
          subtext={`${rifas.length} rifas realizadas`}
        />
        <StatCard
          title="Empréstimos Ativos"
          value={formatCurrency(resumo?.totalEmprestimosAtivos || 0)}
          icon={Calendar}
          color="from-orange-500 to-orange-600"
          subtext={`${emprestimos.filter(e => e.status === 'ativo').length} em aberto`}
        />
      </div>

      {/* Alerta de empréstimos em atraso */}
      {emprestimosAtrasados.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <AlertCircle className="text-white" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-red-800">⚠️ Empréstimos em Atraso</h3>
              <p className="text-sm text-red-600">{emprestimosAtrasados.length} empréstimo(s) com vencimento ultrapassado</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {emprestimosAtrasados.map(emp => {
              const cotistaEmp = cotistas.find(c => c.id === emp.cotista_id);
              const vencimento = new Date(emp.data_vencimento);
              const diasAtraso = Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24));
              const jurosAtraso = Number(emp.valor_emprestimo) * (diasAtraso * 0.01);
              return (
                <div key={emp.id} className="bg-white p-3 rounded-lg border border-red-200 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{cotistaEmp?.nome || 'Cotista'}</p>
                    <p className="text-sm text-gray-600">
                      Principal: {formatCurrency(emp.valor_emprestimo)} • Venceu: {vencimento.toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-bold">{diasAtraso} dias</p>
                    <p className="text-xs text-red-500">+{formatCurrency(jurosAtraso)} juros</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cotistas</p>
              <p className="text-xl font-bold text-gray-800">{resumo?.totalCotistas || apenasContistas.length}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total de Cotas</span>
              <span className="font-medium">{totalCotas}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Valor por Cota</span>
              <span className="font-medium">{formatCurrency(parseFloat(configuracoes?.valor_por_cota || 50))}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Juros Arrecadados</p>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(resumo?.totalJuros || 0)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Empréstimos Quitados</span>
              <span className="font-medium">{emprestimos.filter(e => e.status === 'pago').length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Taxa À Vista</span>
              <span className="font-medium">{configuracoes?.juros_vista || 20}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-orange-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Período</p>
              <p className="text-xl font-bold text-gray-800">Jan - Nov 2026</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Meses Totais</span>
              <span className="font-medium">11 meses</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Encerramento</span>
              <span className="font-medium">30/11/2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas e pendências */}
      {emprestimosPendentes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-yellow-600" size={24} />
            <div>
              <h3 className="font-semibold text-yellow-800">Ações Pendentes</h3>
              <p className="text-sm text-yellow-700">
                {emprestimosPendentes.length} solicitação(ões) de empréstimo aguardando aprovação
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Cotistas */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Top 10 Cotistas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cotas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Participação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {apenasContistas
                .sort((a, b) => b.cotas - a.cotas)
                .slice(0, 10)
                .map((c, idx) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                          {c.nome?.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{c.cotas}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatPercent((c.cotas / totalCotas) * 100)}
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

export default Dashboard;
