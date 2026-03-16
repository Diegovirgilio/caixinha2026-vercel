import React, { useState, useEffect } from 'react';
import { 
  User, DollarSign, TrendingUp, PiggyBank, Gift, Calendar,
  ArrowLeft, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatters';

const ExtratoCotista = ({ cotista, onClose }) => {
  const { 
    mensalidades, 
    emprestimos, 
    rifaSorteios, 
    cdi, 
    juros_atraso,
    juros_emprestimo,
    cotistas,
    comprovantes,
    configuracoes
  } = useAppStore();

  const [showDetalhes, setShowDetalhes] = useState(false);
  const [showMensalidades, setShowMensalidades] = useState(false);
  const [showComprovantes, setShowComprovantes] = useState(false);

  if (!cotista) return null;

  // Filtrar apenas cotistas não admin para cálculos
  const cotistasNaoAdmin = (cotistas || []).filter(c => !c.is_admin);
  const totalCotas = cotistasNaoAdmin.reduce((sum, c) => sum + (c.cotas || 0), 0);
  const participacao = totalCotas > 0 ? ((cotista.cotas || 0) / totalCotas) * 100 : 0;

  // ===== CÁLCULOS DO COTISTA =====

  // 1. Total Investido (mensalidades pagas - só cotas, sem rifa)
  const mensalidadesCotista = Object.values(mensalidades || {}).flat()
    .filter(m => m.cotista_id === cotista.id && (m.status === 'pago' || m.status === 'parcial'));
  
  const totalInvestido = mensalidadesCotista.reduce((sum, m) => sum + Number(m.valor_devido || 0), 0);
  
  // 1b. Total Rifa paga pelo cotista
  const totalRifaPaga = mensalidadesCotista.reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);

  // 2. Bônus de Juros de Empréstimos - SEPARADOS (usando tabela juros_emprestimo)
  const jurosEmprestimoList = juros_emprestimo || [];
  
  // Juros 60% - só quem pegou empréstimo normal
  let juros60 = 0;
  // Juros 40% - proporcional de empréstimos normais
  let juros40 = 0;
  // Juros Caixinha - 100% proporcional de empréstimos caixinha
  let jurosCaixinha = 0;
  
  jurosEmprestimoList.forEach(j => {
    const valorJuros = Number(j.valor_juros || 0);
    const modalidade = j.modalidade || 'normal';
    
    if (modalidade === 'caixinha') {
      // 100% proporcional para todos
      jurosCaixinha += (valorJuros * participacao) / 100;
    } else {
      // 60% para quem pegou
      if (j.cotista_id === cotista.id) {
        juros60 += valorJuros * 0.6;
      }
      // 40% proporcional para todos
      juros40 += (valorJuros * 0.4 * participacao) / 100;
    }
  });
  
  // Total de juros (para manter compatibilidade)
  const bonusJuros = juros60 + juros40 + jurosCaixinha;

  // 3. Bônus de Juros por Atraso (proporcional às cotas)
  const totalJurosAtrasoGeral = (juros_atraso || []).reduce((sum, j) => sum + Number(j.valor_juros || 0), 0);
  const bonusJurosAtraso = (totalJurosAtrasoGeral * participacao) / 100;

  // 4. Bônus CDI (proporcional às cotas)
  const totalCDI = (cdi || []).reduce((sum, c) => sum + Number(c.valor || 0), 0);
  const bonusCDI = (totalCDI * participacao) / 100;

  // 5. Bônus Rifa (proporcional ao valor de rifa pago - só ativos)
  // Só recebe quem está ATIVO e participa_rifa = true
  const todasMensalidades = Object.values(mensalidades || {}).flat();
  
  // Cotistas ativos que participam da rifa
  const cotistasAtivosRifa = cotistasNaoAdmin.filter(c => c.status === 'ativo' && c.participa_rifa);
  const idsCotistasAtivosRifa = cotistasAtivosRifa.map(c => c.id);
  
  // Total arrecadado (para calcular sobra)
  const totalRifaArrecadado = todasMensalidades
    .filter(m => m.status === 'pago' || m.status === 'parcial')
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);
  
  // Total pago apenas por cotistas ATIVOS (para distribuição)
  const totalRifaAtivos = todasMensalidades
    .filter(m => (m.status === 'pago' || m.status === 'parcial') && idsCotistasAtivosRifa.includes(m.cotista_id))
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);
  
  const totalPremiosPagos = (rifaSorteios || []).reduce((s, r) => s + Number(r.valor_premio || 0), 0);
  const sobraCaixinhaRifa = Math.max(0, totalRifaArrecadado - totalPremiosPagos);
  
  // Só calcula bônus se cotista está ativo
  const bonusRifa = (cotista.status === 'ativo' && totalRifaAtivos > 0)
    ? (totalRifaPaga / totalRifaAtivos) * sobraCaixinhaRifa
    : 0;

  // 6. Prêmios de Rifa Ganhos
  let premiosRifaGanhos = 0;
  (rifaSorteios || []).forEach(sorteio => {
    if (sorteio.vencedores && Array.isArray(sorteio.vencedores)) {
      sorteio.vencedores.forEach(v => {
        if (v.cotista_id === cotista.id) {
          premiosRifaGanhos += Number(v.valor || 0);
        }
      });
    }
  });

  // 7. Saldo Final (investido + rifa paga + bônus)
  const saldoFinal = totalInvestido + totalRifaPaga + bonusJuros + bonusJurosAtraso + bonusCDI + bonusRifa + premiosRifaGanhos;

  // ===== HISTÓRICO DE RENDIMENTOS =====
  const historicoRendimentos = [];

  // Juros de empréstimos (da tabela juros_emprestimo)
  jurosEmprestimoList.forEach(j => {
    const valorJuros = Number(j.valor_juros || 0);
    const modalidade = j.modalidade || 'normal';
    let valorRecebido = 0;
    
    if (modalidade === 'caixinha') {
      // 100% proporcional para todos
      valorRecebido = (valorJuros * participacao) / 100;
    } else {
      // Normal: 60% para quem pegou + 40% proporcional
      if (j.cotista_id === cotista.id) {
        valorRecebido += valorJuros * 0.6;
      }
      valorRecebido += (valorJuros * 0.4 * participacao) / 100;
    }
    
    if (valorRecebido > 0) {
      const cotistaEmp = cotistas.find(c => c.id === j.cotista_id);
      const tipoPagLabel = j.tipo_pagamento === 'soJuros' ? 'Só Juros' : j.tipo_pagamento === 'parcial' ? 'Parcial' : 'Quitação';
      historicoRendimentos.push({
        tipo: 'juros_emprestimo',
        descricao: `${tipoPagLabel} ${modalidade === 'caixinha' ? '(Caixinha)' : ''} - ${cotistaEmp?.nome || 'Cotista'}`,
        valor: valorRecebido,
        data: j.created_at
      });
    }
  });

  // Bônus CDI
  (cdi || []).forEach(c => {
    const bonusMes = (Number(c.valor || 0) * participacao) / 100;
    if (bonusMes > 0) {
      historicoRendimentos.push({
        tipo: 'cdi',
        descricao: `CDI ${c.mes_referencia}`,
        valor: bonusMes,
        data: c.created_at
      });
    }
  });

  // Bônus Rifa (proporcional ao valor de rifa pago - só ativos que pagaram)
  if (cotista.participa_rifa && idsCotistasAtivosRifa.includes(cotista.id)) {
    (rifaSorteios || []).forEach(sorteio => {
      // Distribuir sobra proporcional ao valor pago pelo cotista
      const valorCaixinhaSorteio = Number(sorteio.valor_caixinha || 0);
      if (valorCaixinhaSorteio > 0 && totalRifaAtivos > 0) {
        const bonusSorteio = (totalRifaPaga / totalRifaAtivos) * valorCaixinhaSorteio;
        if (bonusSorteio > 0) {
          historicoRendimentos.push({
            tipo: 'rifa',
            descricao: `Bônus rifa ${sorteio.mes_referencia}`,
            valor: bonusSorteio,
            data: sorteio.created_at
          });
        }
      }
    });
  }

  // Prêmios de rifa ganhos
  (rifaSorteios || []).forEach(sorteio => {
    if (sorteio.vencedores && Array.isArray(sorteio.vencedores)) {
      sorteio.vencedores.forEach(v => {
        if (v.cotista_id === cotista.id) {
          const posicaoLabel = v.posicao === 'primeiro' ? '1º' : v.posicao === 'segundo' ? '2º' : '3º';
          historicoRendimentos.push({
            tipo: 'premio_rifa',
            descricao: `🏆 Prêmio ${posicaoLabel} lugar - Rifa ${sorteio.mes_referencia}`,
            valor: Number(v.valor || 0),
            data: sorteio.created_at
          });
        }
      });
    }
  });

  // Juros por atraso (proporcional)
  (juros_atraso || []).forEach(j => {
    const bonusJA = (Number(j.valor_juros || 0) * participacao) / 100;
    if (bonusJA > 0) {
      historicoRendimentos.push({
        tipo: 'juros_atraso',
        descricao: `Juros atraso ${j.mes_referencia || ''}`,
        valor: bonusJA,
        data: j.created_at
      });
    }
  });

  // Ordenar por data (mais recente primeiro)
  historicoRendimentos.sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                {cotista.nome?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold">{cotista.nome}</h2>
                <p className="text-blue-100">
                  {cotista.cotas} cota(s) • {participacao.toFixed(1)}% participação
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Resumo Financeiro */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <DollarSign size={18} />
              Resumo Financeiro
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Mensalidades (cotas)</span>
                <span className="font-medium">{formatCurrency(totalInvestido)}</span>
              </div>
              {totalRifaPaga > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rifa paga</span>
                  <span className="font-medium">{formatCurrency(totalRifaPaga)}</span>
                </div>
              )}
              
              {/* Juros separados */}
              {juros60 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Juros 60% (seu empréstimo)</span>
                  <span className="font-medium text-green-600">+ {formatCurrency(juros60)}</span>
                </div>
              )}
              {juros40 > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Juros 40% (proporcional)</span>
                  <span className="font-medium text-green-600">+ {formatCurrency(juros40)}</span>
                </div>
              )}
              {jurosCaixinha > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Juros Caixinha (proporcional)</span>
                  <span className="font-medium text-blue-600">+ {formatCurrency(jurosCaixinha)}</span>
                </div>
              )}
              
              {bonusJurosAtraso > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Bônus Juros por Atraso</span>
                  <span className="font-medium text-orange-600">+ {formatCurrency(bonusJurosAtraso)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bônus CDI</span>
                <span className="font-medium text-green-600">+ {formatCurrency(bonusCDI)}</span>
              </div>
              {cotista.participa_rifa && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Bônus Rifa</span>
                  <span className="font-medium text-purple-600">+ {formatCurrency(bonusRifa)}</span>
                </div>
              )}
              {premiosRifaGanhos > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">🏆 Prêmios de Rifa</span>
                  <span className="font-medium text-yellow-600">+ {formatCurrency(premiosRifaGanhos)}</span>
                </div>
              )}
              
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-800">SALDO FINAL</span>
                  <span className="font-bold text-xl text-blue-600">{formatCurrency(saldoFinal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de Rendimentos */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDetalhes(!showDetalhes)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={18} />
                Histórico de Rendimentos ({historicoRendimentos.length})
              </h3>
              {showDetalhes ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showDetalhes && (
              <div className="border-t max-h-64 overflow-y-auto">
                {historicoRendimentos.length === 0 ? (
                  <p className="p-4 text-center text-gray-500">Nenhum rendimento registrado ainda</p>
                ) : (
                  <div className="divide-y">
                    {historicoRendimentos.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.descricao}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(item.data).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`font-medium ${
                          item.tipo === 'premio_rifa' ? 'text-yellow-600' :
                          item.tipo === 'rifa' ? 'text-purple-600' :
                          'text-green-600'
                        }`}>
                          + {formatCurrency(item.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status da Rifa */}
          <div className={`rounded-xl p-4 ${cotista.participa_rifa ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <Gift size={20} className={cotista.participa_rifa ? 'text-purple-600' : 'text-gray-400'} />
              <div>
                <p className="font-medium text-gray-800">
                  {cotista.participa_rifa ? 'Participa da Rifa Mensal' : 'Não participa da Rifa'}
                </p>
                {cotista.participa_rifa && (
                  <p className="text-sm text-purple-600">
                    {(cotista.cotas || 1) * 5} números da sorte
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Mensalidades por mês */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowMensalidades(!showMensalidades)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Calendar size={18} />
                Mensalidades ({mensalidadesCotista.length} pagas)
              </h3>
              {showMensalidades ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {showMensalidades && (
              <div className="border-t max-h-64 overflow-y-auto">
                {Object.values(mensalidades || {}).flat()
                  .filter(m => m.cotista_id === cotista.id)
                  .sort((a, b) => (a.mes_referencia || '').localeCompare(b.mes_referencia || ''))
                  .map((m, idx) => {
                    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    const [ano, mes] = (m.mes_referencia || '').split('-');
                    const label = mes ? `${meses[parseInt(mes) - 1]}/${ano}` : m.mes_referencia;
                    
                    return (
                      <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50 border-b last:border-b-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          <p className="text-xs text-gray-500">
                            Devido: {formatCurrency(m.valor_devido)}
                            {Number(m.valor_rifa || 0) > 0 && ` + Rifa: ${formatCurrency(m.valor_rifa)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${
                            m.status === 'pago' ? 'text-green-600' : 
                            m.status === 'parcial' ? 'text-yellow-600' : 'text-red-500'
                          }`}>
                            {formatCurrency(m.valor_pago || 0)}
                          </span>
                          <p className={`text-xs ${
                            m.status === 'pago' ? 'text-green-500' : 
                            m.status === 'parcial' ? 'text-yellow-500' : 'text-red-400'
                          }`}>
                            {m.status === 'pago' ? 'Pago' : m.status === 'parcial' ? 'Parcial' : 'Pendente'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Comprovantes */}
          {(() => {
            const meusComprovantes = (comprovantes || []).filter(c => c.cotista_id === cotista.id);
            if (meusComprovantes.length === 0) return null;
            
            return (
              <div className="bg-white border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowComprovantes(!showComprovantes)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <DollarSign size={18} />
                    Comprovantes ({meusComprovantes.length})
                  </h3>
                  {showComprovantes ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {showComprovantes && (
                  <div className="border-t max-h-48 overflow-y-auto">
                    {meusComprovantes
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                      .map((comp, idx) => (
                        <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50 border-b last:border-b-0">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {comp.tipo === 'mensalidade' ? 'Mensalidade' : 'Empréstimo'} — {comp.mes_referencia || '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(comp.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium">{formatCurrency(comp.valor_informado)}</span>
                            <p className={`text-xs ${
                              comp.status === 'aprovado' ? 'text-green-500' : 
                              comp.status === 'rejeitado' ? 'text-red-500' : 'text-yellow-500'
                            }`}>
                              {comp.status === 'aprovado' ? 'Aprovado' : comp.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Empréstimos do cotista */}
          {(() => {
            const meusEmprestimos = (emprestimos || []).filter(e => e.cotista_id === cotista.id && (e.status === 'ativo' || e.status === 'pendente'));
            if (meusEmprestimos.length === 0) return null;
            
            return (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <h3 className="font-semibold text-orange-800 flex items-center gap-2 mb-3">
                  <DollarSign size={18} />
                  Empréstimos em Aberto ({meusEmprestimos.length})
                </h3>
                <div className="space-y-2">
                  {meusEmprestimos.map((emp, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {formatCurrency(emp.principal_restante || emp.valor_emprestimo)}
                          <span className="text-xs text-gray-500 ml-1">
                            ({emp.modalidade === 'caixinha' ? 'Caixinha' : 'Normal'})
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {emp.data_vencimento ? `Vence: ${new Date(emp.data_vencimento).toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        emp.status === 'ativo' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {emp.status === 'ativo' ? 'Ativo' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtratoCotista;
