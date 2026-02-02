import React, { useState, useEffect } from 'react';
import { 
  Gift, Users, Calendar, DollarSign, Trophy, Hash,
  Loader2, CheckCircle, AlertCircle, Search, X,
  Play, History, Award, Ticket
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { formatCurrency } from '../utils/formatters';

const Rifas = () => {
  const { 
    cotistas, 
    rifaNumeros, 
    rifaSorteios,
    loadRifaNumeros,
    loadRifaSorteios,
    realizarSorteio 
  } = useAppStore();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showSorteioModal, setShowSorteioModal] = useState(false);
  const [search, setSearch] = useState('');
  
  // Dados do sorteio
  const [sorteioData, setSorteioData] = useState({
    mes: '01',
    ano: '2026',
    dataSorteio: new Date().toISOString().split('T')[0],
    primeiro: '',
    segundo: '',
    terceiro: ''
  });

  useEffect(() => {
    loadRifaNumeros();
    loadRifaSorteios();
  }, []);

  // Participantes da rifa (não admin, com flag ativa)
  const participantes = (cotistas || []).filter(c => c.participa_rifa && !c.is_admin);
  
  // Agrupar números por cotista
  const numerosPorCotista = {};
  (rifaNumeros || []).forEach(n => {
    if (!numerosPorCotista[n.cotista_id]) {
      numerosPorCotista[n.cotista_id] = [];
    }
    numerosPorCotista[n.cotista_id].push(n.numero);
  });

  // Filtrar participantes
  const participantesFiltrados = participantes.filter(p => 
    p.nome?.toLowerCase().includes(search.toLowerCase())
  );

  // Estatísticas
  const totalCotas = participantes.reduce((sum, c) => sum + (c.cotas || 0), 0);
  const totalNumeros = (rifaNumeros || []).length;
  const valorMensal = totalCotas * 20;
  const valorPremio = valorMensal * 0.20;
  const valorCaixinha = valorMensal * 0.80;

  // Meses disponíveis
  const mesesOpcoes = [
    { valor: '01', nome: 'Janeiro' },
    { valor: '02', nome: 'Fevereiro' },
    { valor: '03', nome: 'Março' },
    { valor: '04', nome: 'Abril' },
    { valor: '05', nome: 'Maio' },
    { valor: '06', nome: 'Junho' },
    { valor: '07', nome: 'Julho' },
    { valor: '08', nome: 'Agosto' },
    { valor: '09', nome: 'Setembro' },
    { valor: '10', nome: 'Outubro' },
    { valor: '11', nome: 'Novembro' }
  ];

  const handleRealizarSorteio = async () => {
    // Validar campos
    if (!sorteioData.primeiro || !sorteioData.segundo || !sorteioData.terceiro) {
      setError('Informe os 3 primeiros prêmios da Federal');
      return;
    }

    // Validar formato (5 dígitos)
    const premios = [sorteioData.primeiro, sorteioData.segundo, sorteioData.terceiro];
    for (const premio of premios) {
      if (!/^\d{5}$/.test(premio)) {
        setError('Cada prêmio deve ter exatamente 5 dígitos');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const mesReferencia = `${sorteioData.mes}/${sorteioData.ano}`;
      const resultado = await realizarSorteio(
        mesReferencia,
        sorteioData.dataSorteio,
        {
          primeiro: sorteioData.primeiro,
          segundo: sorteioData.segundo,
          terceiro: sorteioData.terceiro
        }
      );

      if (resultado.vencedor) {
        const vencedor = cotistas.find(c => c.id === resultado.vencedor);
        setSuccess(`🎉 ${vencedor?.nome} ganhou com o número ${resultado.numero}! Prêmio: ${formatCurrency(resultado.premio)}`);
      } else {
        setSuccess(`Nenhum vencedor neste mês. ${formatCurrency(resultado.caixinha)} vai para a caixinha.`);
      }

      setShowSorteioModal(false);
      setSorteioData({
        mes: '01',
        ano: '2026',
        dataSorteio: new Date().toISOString().split('T')[0],
        primeiro: '',
        segundo: '',
        terceiro: ''
      });

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || 'Erro ao realizar sorteio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Gift className="text-purple-600" />
            Rifas Mensais
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerenciamento de rifas e sorteios
          </p>
        </div>
        
        <button
          onClick={() => setShowSorteioModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
        >
          <Play size={18} />
          Realizar Sorteio
        </button>
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
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Users size={16} />
            Participantes
          </div>
          <p className="text-2xl font-bold text-gray-800">{participantes.length}</p>
          <p className="text-xs text-gray-500">{totalCotas} cotas</p>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Hash size={16} />
            Números Ativos
          </div>
          <p className="text-2xl font-bold text-purple-600">{totalNumeros}</p>
          <p className="text-xs text-gray-500">2 por cota</p>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign size={16} />
            Arrecadação/Mês
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(valorMensal)}</p>
          <p className="text-xs text-gray-500">R$ 20 por cota</p>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Trophy size={16} />
            Prêmio (20%)
          </div>
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(valorPremio)}</p>
          <p className="text-xs text-gray-500">Caixinha: {formatCurrency(valorCaixinha)}</p>
        </div>
      </div>

      {/* Participantes e seus números */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Ticket size={20} />
              Participantes e Números
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

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
                  Valor/Mês
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Números
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {participantesFiltrados.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium">
                        {p.nome?.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-800">{p.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {p.cotas}
                  </td>
                  <td className="px-6 py-4 text-center text-green-600 font-medium">
                    {formatCurrency(p.cotas * 20)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(numerosPorCotista[p.id] || []).sort().map(num => (
                        <span 
                          key={num}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-mono font-medium"
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {participantesFiltrados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhum participante encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de Sorteios */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <History size={20} />
            Histórico de Sorteios
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Mês
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vencedor
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Número
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Prêmio
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Caixinha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(rifaSorteios || []).map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    {s.mes_referencia}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">
                    {new Date(s.data_sorteio).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    {s.cotista_vencedor ? (
                      <div className="flex items-center gap-2">
                        <Award className="text-yellow-500" size={18} />
                        <span className="font-medium">{s.cotista_vencedor?.nome}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">Ninguém</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {s.numero_vencedor ? (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-mono font-medium">
                        {s.numero_vencedor}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-center text-green-600 font-medium">
                    {formatCurrency(s.valor_premio || 0)}
                  </td>
                  <td className="px-6 py-4 text-center text-blue-600 font-medium">
                    {formatCurrency(s.valor_caixinha || 0)}
                  </td>
                </tr>
              ))}
              {(!rifaSorteios || rifaSorteios.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhum sorteio realizado ainda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Sorteio */}
      {showSorteioModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Play className="text-purple-600" />
                Realizar Sorteio
              </h3>
              <button onClick={() => setShowSorteioModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Mês/Ano */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                  <select
                    value={sorteioData.mes}
                    onChange={(e) => setSorteioData({...sorteioData, mes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {mesesOpcoes.map(m => (
                      <option key={m.valor} value={m.valor}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <select
                    value={sorteioData.ano}
                    onChange={(e) => setSorteioData({...sorteioData, ano: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="2026">2026</option>
                  </select>
                </div>
              </div>

              {/* Data do Sorteio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Sorteio</label>
                <input
                  type="date"
                  value={sorteioData.dataSorteio}
                  onChange={(e) => setSorteioData({...sorteioData, dataSorteio: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Prêmios da Federal */}
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm font-medium text-purple-700 mb-2">Resultado da Loteria Federal (5 dígitos)</p>
                <p className="text-xs text-purple-500 mb-2">Apenas os últimos 3 dígitos serão verificados</p>
                <div className="space-y-2">
                  {['primeiro', 'segundo', 'terceiro'].map((premio, idx) => (
                    <div key={premio} className="flex items-center gap-2">
                      <span className="text-sm text-purple-600 w-16">{idx + 1}º Prêmio:</span>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="00000"
                        value={sorteioData[premio]}
                        onChange={(e) => setSorteioData({...sorteioData, [premio]: e.target.value.replace(/\D/g, '').slice(0, 5)})}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded font-mono text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-gray-600">
                  <strong>{participantes.length}</strong> participantes • 
                  <strong> {totalCotas}</strong> cotas
                </p>
                <p className="text-gray-600">
                  Arrecadação: <strong className="text-green-600">{formatCurrency(valorMensal)}</strong>
                </p>
                <p className="text-gray-600">
                  Prêmio (20%): <strong className="text-yellow-600">{formatCurrency(valorPremio)}</strong> | 
                  Caixinha (80%): <strong className="text-blue-600">{formatCurrency(valorCaixinha)}</strong>
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowSorteioModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleRealizarSorteio}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                Sortear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rifas;
