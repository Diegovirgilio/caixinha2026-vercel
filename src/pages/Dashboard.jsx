import React, { useEffect, useState } from 'react';
import { 
  DollarSign, TrendingUp, Users, Calendar, PiggyBank, 
  AlertCircle, CheckCircle, Clock, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatPercent } from '../utils/formatters';

const Dashboard = () => {
  const { cotistas, emprestimos, rifas, cdi, getTotalCotas, getTotalInvestido, configuracoes } = useAppStore();
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
  const patrimonioTotal = (resumo?.totalInvestido || 0) + (resumo?.totalJuros || 0) + (resumo?.totalRifas || 0) + (resumo?.totalCDI || 0);
  
  // Empréstimos pendentes de aprovação (excluindo admins)
  const emprestimosPendentes = (emprestimos || []).filter(e => {
    const cotistaEmprestimo = (cotistas || []).find(c => c.id === e.cotista_id);
    return e.status === 'pendente' && !cotistaEmprestimo?.is_admin;
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
