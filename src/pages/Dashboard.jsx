import React, { useEffect, useState } from 'react';
import { 
  DollarSign, TrendingUp, Users, Calendar, PiggyBank,
  AlertCircle, CheckCircle, Clock, ArrowUpRight, Wallet
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { dashboardApi } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const Dashboard = () => {
  const {
    cotistas, emprestimos, cdi, getTotalCotas, getTotalInvestido,
    mensalidades, rifaSorteios, juros_atraso
  } = useAppStore();
  const { cotista } = useAuthStore();
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cotistas sem admin para cálculos de cotas e participação
  const apenasContistas = (cotistas || []).filter(c => !c.is_admin);
  const totalCotasCalc = apenasContistas.reduce((sum, c) => sum + (c.cotas || 0), 0);

  useEffect(() => {
    const loadResumo = async () => {
      try {
        const data = await dashboardApi.getResumoGeral();
        setResumo(data);
      } catch (error) {
        // Fallback local quando a API falhar
        setResumo({
          totalCotas: totalCotasCalc,
          totalCotistas: apenasContistas.length,
          totalInvestido: getTotalInvestido(),
          totalJuros: 0,
          totalRifas: 0,
          totalCDI: (cdi || []).reduce((s, c) => s + Number(c.valor || 0), 0)
        });
      } finally {
        setLoading(false);
      }
    };
    loadResumo();
  }, [cotistas, emprestimos, cdi]);

  const totalCotas = resumo?.totalCotas || totalCotasCalc;

  // IDs de admins — excluídos dos cálculos financeiros
  const adminIds = (cotistas || []).filter(c => c.is_admin).map(c => c.id);

  // Total de juros de atraso arrecadados
  const totalJurosAtraso = (juros_atraso || [])
    .reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);

  // Total em empréstimos ativos (caixa comprometida)
  const emprestimosAtivos = (emprestimos || [])
    .filter(e => !adminIds.includes(e.cotista_id) && e.status === 'ativo')
    .reduce((sum, e) => sum + Number(e.valor_emprestimo || 0), 0);

  // Total de prêmios pagos nos sorteios (saída de caixa)
  const premiosRifaPagos = (rifaSorteios || [])
    .reduce((sum, s) => sum + Number(s.valor_premio || 0), 0);

  // Patrimônio Total = tudo que a caixinha acumulou (inclusive empréstimos ativos)
  const patrimonioTotal = (resumo?.totalInvestido || 0)
    + (resumo?.totalJuros || 0)
    + (resumo?.totalRifas || 0)
    + (resumo?.totalCDI || 0)
    + totalJurosAtraso;

  // Saldo em Conta = dinheiro disponível (patrimônio menos o que está emprestado e os prêmios pagos)
  const saldoEmConta = patrimonioTotal - emprestimosAtivos - premiosRifaPagos;

  // Empréstimos pendentes de aprovação
  const emprestimosPendentes = (emprestimos || []).filter(e => {
    const c = (cotistas || []).find(c => c.id === e.cotista_id);
    return e.status === 'pendente' && !c?.is_admin;
  });

  // Empréstimos com vencimento ultrapassado
  // Usa T00:00:00 para comparar em horário local (evita divergência com Emprestimos.jsx)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const emprestimosAtrasados = (emprestimos || []).filter(e => {
    if (!e.data_vencimento || e.status !== 'ativo') return false;
    const venc = new Date(e.data_vencimento.includes('T') ? e.data_vencimento : e.data_vencimento + 'T00:00:00');
    return hoje > venc;
  });

  // Card de estatística reutilizável
  const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <div className={`bg-gradient-to-br ${color} p-6 rounded-xl shadow-lg text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
          {subtext && <p className="text-white/60 text-xs mt-2">{subtext}</p>}
        </div>
        <div className="bg-white/20 p-3 rounded-lg">
          <Icon size={24} className="text-white" />
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
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Geral</h1>
          <p className="text-gray-500">Visão consolidada da Caixinha 2026</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm">
          <Calendar size={16} />
          <span>{hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Cards de Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Patrimônio Total"
          value={formatCurrency(patrimonioTotal)}
          icon={Wallet}
          color="from-blue-600 to-blue-700"
          subtext="Total acumulado (incluindo empréstimos ativos)"
        />
        <StatCard
          title="Saldo em Conta"
          value={formatCurrency(saldoEmConta)}
          icon={PiggyBank}
          color="from-emerald-600 to-emerald-700"
          subtext="Disponível para novos empréstimos"
        />
        <StatCard
          title="Total em Empréstimos"
          value={formatCurrency(emprestimosAtivos)}
          icon={ArrowUpRight}
          color="from-amber-600 to-amber-700"
          subtext={`${(emprestimos || []).filter(e => e.status === 'ativo').length} empréstimos ativos`}
        />
        <StatCard
          title="Total de Cotas"
          value={totalCotas}
          icon={Users}
          color="from-purple-600 to-purple-700"
          subtext={`${apenasContistas.length} cotistas`}
        />
      </div>

      {/* Alertas e Composição */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Alertas */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-amber-500" />
              Atenção Requerida
            </h3>
            <div className="space-y-4">
              {emprestimosPendentes.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <Clock className="text-amber-600 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-medium text-amber-900">{emprestimosPendentes.length} Empréstimos Pendentes</p>
                    <p className="text-xs text-amber-700">Aguardando aprovação do administrador</p>
                  </div>
                </div>
              )}
              {emprestimosAtrasados.length > 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertCircle className="text-red-600 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-medium text-red-900">{emprestimosAtrasados.length} Empréstimos em Atraso</p>
                    <p className="text-xs text-red-700">Vencimento ultrapassado</p>
                  </div>
                </div>
              )}
              {emprestimosPendentes.length === 0 && emprestimosAtrasados.length === 0 && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <CheckCircle className="text-emerald-600" size={18} />
                  <p className="text-sm font-medium text-emerald-900">Tudo em dia!</p>
                </div>
              )}
            </div>
          </div>

          {/* Valor da Cota */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">Valor da Cota</h3>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Valor Atual</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(totalCotas > 0 ? patrimonioTotal / totalCotas : 0)}
              </p>
              <p className="text-xs text-gray-400 mt-2">Patrimônio Total ÷ Total de Cotas</p>
            </div>
          </div>
        </div>

        {/* Composição do Patrimônio */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Composição do Patrimônio</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Investimento Inicial (Mensalidades)</span>
                <span className="font-semibold">{formatCurrency(resumo?.totalInvestido || 0)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${patrimonioTotal > 0 ? (resumo?.totalInvestido / patrimonioTotal) * 100 : 0}%` }}>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Juros de Empréstimos</p>
                <p className="text-lg font-semibold text-emerald-600">{formatCurrency(resumo?.totalJuros || 0)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Juros por Atraso</p>
                <p className="text-lg font-semibold text-amber-600">{formatCurrency(totalJurosAtraso)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Rifas (Lucro)</p>
                <p className="text-lg font-semibold text-purple-600">{formatCurrency(resumo?.totalRifas || 0)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Rendimentos CDI</p>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(resumo?.totalCDI || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
