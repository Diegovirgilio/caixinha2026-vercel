import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle,
  Plus, Send, Key, PiggyBank, Calendar, FileText, Upload,
  X, Loader2, Image, Camera, Gift, Hash, Trophy
} from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { emprestimosApi, mensalidadesApi } from '../services/api';
import { formatCurrency, formatPercent, formatMesReferencia } from '../utils/formatters';
import { STATUS_MENSALIDADE_COLORS, STATUS_EMPRESTIMO_COLORS, STATUS_EMPRESTIMO_LABELS } from '../utils/constants';

const UserArea = () => {
  const { cotista } = useAuthStore();
  const { getTotalCotas, getInvestidoByCotista, getLimiteEmprestimo, emprestimos, rifas, cdi, enviarComprovante, comprovantes, configuracoes, getNumerosRifaByCotista, rifaSorteios } = useAppStore();
  const { setShowPixModal, setShowChangePasswordModal } = useUIStore();
  
  const [minhasMensalidades, setMinhasMensalidades] = useState([]);
  const [meusEmprestimos, setMeusEmprestimos] = useState([]);
  const [meusComprovantes, setMeusComprovantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [solicitacao, setSolicitacao] = useState({ valor: '', tipo: 'vista', parcelas: 2, motivo: '' });
  const [showComprovante, setShowComprovante] = useState(false);
  const [comprovanteData, setComprovanteData] = useState({ tipo: 'mensalidade', referencia_id: '', mes_referencia: '', valor_informado: '', arquivo: null });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

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
        setMeusComprovantes((comprovantes || []).filter(c => c.cotista_id === cotista.id));
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [cotista, comprovantes]);

  const totalCotas = getTotalCotas();
  const investido = getInvestidoByCotista(cotista?.id);
  const limite = getLimiteEmprestimo(cotista?.id);
  const participacao = totalCotas > 0 ? ((cotista?.cotas || 0) / totalCotas) * 100 : 0;
  const totalRifas = (rifas || []).reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalCDI = (cdi || []).reduce((s, c) => s + Number(c.valor || 0), 0);
  const bonusRifas = (totalRifas * participacao) / 100;
  const bonusCDI = (totalCDI * participacao) / 100;
  const jurosRecebidos = (emprestimos || []).filter(e => e.status === 'pago').reduce((total, emp) => {
    const jurosTotal = Number(emp.valor_juros || 0);
    let bonus = emp.cotista_id === cotista?.id ? jurosTotal * 0.6 : 0;
    bonus += (jurosTotal * 0.4 * participacao) / 100;
    return total + bonus;
  }, 0);
  const saldoFinal = investido + jurosRecebidos + bonusRifas + bonusCDI;
  const jurosVista = parseFloat(configuracoes?.juros_vista || 20);
  const jurosParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
  const taxaJuros = solicitacao.tipo === 'vista' ? jurosVista : jurosParcelado;
  const valorEmprestimo = parseFloat(solicitacao.valor) || 0;
  const valorJuros = valorEmprestimo * (taxaJuros / 100);
  const valorTotal = valorEmprestimo + valorJuros;

  const handleSolicitarEmprestimo = async () => {
    if (!solicitacao.valor) { setMensagem({ tipo: 'erro', texto: 'Informe o valor' }); return; }
    const valor = parseFloat(solicitacao.valor);
    if (valor > limite) { setMensagem({ tipo: 'erro', texto: `Excede limite de ${formatCurrency(limite)}` }); return; }
    setEnviando(true);
    try {
      await emprestimosApi.solicitar({ cotista_id: cotista.id, valor, tipo: solicitacao.tipo, parcelas: solicitacao.tipo === 'parcelado' ? parseInt(solicitacao.parcelas) : 1, motivo: solicitacao.motivo, taxa_juros: taxaJuros });
      setMensagem({ tipo: 'sucesso', texto: 'Solicitação enviada!' });
      setSolicitacao({ valor: '', tipo: 'vista', parcelas: 2, motivo: '' });
      setShowSolicitacao(false);
      setMeusEmprestimos(await emprestimosApi.getByCotista(cotista.id));
    } catch (error) { setMensagem({ tipo: 'erro', texto: 'Erro ao enviar' }); }
    finally { setEnviando(false); setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000); }
  };

  const openComprovanteModal = (tipo, item) => {
    setComprovanteData({
      tipo, referencia_id: item.id, mes_referencia: item.mes_referencia || '',
      valor_informado: String(tipo === 'mensalidade' ? item.valor_devido - (item.valor_pago || 0) : item.valor_total - (item.valor_pago || 0)),
      arquivo: null
    });
    setShowComprovante(true);
  };

  const handleEnviarComprovante = async () => {
    if (!comprovanteData.arquivo) { setMensagem({ tipo: 'erro', texto: 'Selecione um arquivo' }); return; }
    if (!comprovanteData.valor_informado || parseFloat(comprovanteData.valor_informado) <= 0) { setMensagem({ tipo: 'erro', texto: 'Informe o valor' }); return; }
    setEnviando(true); setUploadProgress(10);
    try {
      const file = comprovanteData.arquivo;
      const fileName = `${cotista.id}/${Date.now()}.${file.name.split('.').pop()}`;
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage.from('comprovantes').upload(fileName, file);
      if (uploadError) throw uploadError;
      setUploadProgress(60);
      const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(fileName);
      setUploadProgress(80);
      await enviarComprovante({ cotista_id: cotista.id, tipo: comprovanteData.tipo, referencia_id: comprovanteData.referencia_id, mes_referencia: comprovanteData.mes_referencia || null, valor_informado: parseFloat(comprovanteData.valor_informado), arquivo_url: urlData.publicUrl, arquivo_nome: file.name, status: 'pendente' });
      setUploadProgress(100);
      setMensagem({ tipo: 'sucesso', texto: 'Comprovante enviado! Aguarde validação.' });
      setShowComprovante(false);
    } catch (error) { setMensagem({ tipo: 'erro', texto: 'Erro: ' + error.message }); }
    finally { setEnviando(false); setUploadProgress(0); setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000); }
  };

  const temComprovantePendente = (tipo, referenciaId) => meusComprovantes.some(c => c.tipo === tipo && c.referencia_id === referenciaId && c.status === 'pendente');

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6">
      {mensagem.texto && <div className={`p-4 rounded-lg flex items-center gap-2 ${mensagem.tipo === 'sucesso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{mensagem.tipo === 'sucesso' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}{mensagem.texto}</div>}

      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 rounded-xl text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">{cotista?.nome?.charAt(0)}</div>
            <div><h1 className="text-2xl font-bold">Olá, {cotista?.nome?.split(' ')[0]}!</h1><p className="text-blue-200">Bem-vindo à sua área</p></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPixModal(true)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2"><DollarSign size={18} />PIX</button>
            <button onClick={() => setShowChangePasswordModal(true)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2"><Key size={18} />Senha</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Cotas</p><p className="text-2xl font-bold text-gray-800">{cotista?.cotas || 0}</p><p className="text-xs text-gray-400">{formatPercent(participacao)} do total</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Investido</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(investido)}</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Limite Empréstimo</p><p className="text-2xl font-bold text-orange-600">{formatCurrency(limite)}</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Saldo Projetado</p><p className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal)}</p></div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="text-green-600" size={20} />Seus Bônus</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg"><p className="text-sm text-gray-600">Juros Recebidos</p><p className="text-xl font-bold text-green-700">{formatCurrency(jurosRecebidos)}</p></div>
          <div className="p-4 bg-purple-50 rounded-lg"><p className="text-sm text-gray-600">Bônus Rifas</p><p className="text-xl font-bold text-purple-700">{formatCurrency(bonusRifas)}</p></div>
          <div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm text-gray-600">Rendimento CDI</p><p className="text-xl font-bold text-blue-700">{formatCurrency(bonusCDI)}</p></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><Calendar className="text-blue-600" size={20} />Minhas Mensalidades</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Devido</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pago</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {minhasMensalidades.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatMesReferencia(m.mes_referencia)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(m.valor_devido)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatCurrency(m.valor_pago)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${STATUS_MENSALIDADE_COLORS[m.status]}`}>{m.status === 'pago' ? '✓ Pago' : m.status === 'parcial' ? '◐ Parcial' : '○ Pendente'}</span></td>
                  <td className="px-4 py-3">{m.status !== 'pago' && (temComprovantePendente('mensalidade', m.id) ? <span className="text-xs text-yellow-600 flex items-center gap-1"><Clock size={14} />Aguardando</span> : <button onClick={() => openComprovanteModal('mensalidade', m)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"><Upload size={14} />Comprovante</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><PiggyBank className="text-orange-600" size={20} />Empréstimos</h2>
          <button onClick={() => setShowSolicitacao(!showSolicitacao)} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-orange-600"><Plus size={16} />Solicitar</button>
        </div>
        {showSolicitacao && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor</label><input type="number" value={solicitacao.valor} onChange={(e) => setSolicitacao({ ...solicitacao, valor: e.target.value })} className="w-full px-4 py-2 border rounded-lg" placeholder="0,00" /><p className="text-xs text-gray-500 mt-1">Limite: {formatCurrency(limite)}</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label><select value={solicitacao.tipo} onChange={(e) => setSolicitacao({ ...solicitacao, tipo: e.target.value })} className="w-full px-4 py-2 border rounded-lg"><option value="vista">À Vista ({jurosVista}%)</option><option value="parcelado">Parcelado ({jurosParcelado}%)</option></select></div>
            </div>
            {valorEmprestimo > 0 && <div className="mt-4 p-3 bg-white rounded-lg border text-sm"><span className="text-gray-500">Total:</span> <span className="font-medium text-orange-600">{formatCurrency(valorTotal)}</span></div>}
            <div className="flex gap-3 mt-4"><button onClick={handleSolicitarEmprestimo} disabled={enviando} className="flex-1 bg-orange-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"><Send size={16} />{enviando ? 'Enviando...' : 'Enviar'}</button><button onClick={() => setShowSolicitacao(false)} className="px-4 py-2 border rounded-lg">Cancelar</button></div>
          </div>
        )}
        {meusEmprestimos.length === 0 ? <p className="text-center text-gray-500 py-4">Nenhum empréstimo</p> : (
          <div className="space-y-2">{meusEmprestimos.map((emp) => (
            <div key={emp.id} className={`p-4 rounded-lg border ${emp.status === 'ativo' ? 'bg-orange-50 border-orange-200' : emp.status === 'pago' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <div><p className="font-medium text-gray-800">{formatCurrency(emp.valor_emprestimo)}</p><p className="text-sm text-gray-500">Total: {formatCurrency(emp.valor_total)}</p></div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_EMPRESTIMO_COLORS[emp.status]}`}>{STATUS_EMPRESTIMO_LABELS[emp.status]}</span>
                  {emp.status === 'ativo' && (temComprovantePendente('emprestimo', emp.id) ? <span className="text-xs text-yellow-600 flex items-center gap-1"><Clock size={14} />Aguardando</span> : <button onClick={() => openComprovanteModal('emprestimo', emp)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"><Upload size={14} />Pagar</button>)}
                </div>
              </div>
            </div>
          ))}</div>
        )}
      </div>

      {/* Seção de Rifa */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Gift className="text-purple-600" />
            Rifa Mensal
          </h2>
          {cotista?.participa_rifa && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              Participando
            </span>
          )}
        </div>

        {cotista?.participa_rifa ? (
          <div className="space-y-4">
            {/* Meus Números */}
            <div>
              <p className="text-sm text-gray-600 mb-2">Seus números da sorte:</p>
              <div className="flex flex-wrap gap-2">
                {getNumerosRifaByCotista(cotista?.id).map(n => (
                  <span 
                    key={n.id}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-mono font-bold text-lg"
                  >
                    {n.numero}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {cotista?.cotas} cota(s) × 2 números = {(cotista?.cotas || 0) * 2} números
              </p>
            </div>

            {/* Valor mensal */}
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-sm text-purple-700">
                <strong>Valor mensal:</strong> {formatCurrency((cotista?.cotas || 0) * 20)}
                <span className="text-purple-500 ml-2">(R$ 20 por cota)</span>
              </p>
            </div>

            {/* Último sorteio */}
            {rifaSorteios && rifaSorteios.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" />
                  Último sorteio: {rifaSorteios[0].mes_referencia}
                </p>
                {rifaSorteios[0].cotista_vencedor_id ? (
                  <p className="text-sm text-gray-600">
                    Vencedor: <strong>{rifaSorteios[0].cotista_vencedor?.nome}</strong> 
                    {' '}com o número <span className="font-mono bg-yellow-100 px-2 py-0.5 rounded">{rifaSorteios[0].numero_vencedor}</span>
                    {' '}- Prêmio: <strong className="text-green-600">{formatCurrency(rifaSorteios[0].valor_premio)}</strong>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Nenhum vencedor neste mês</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <Gift size={40} className="mx-auto mb-3 text-gray-300" />
            <p>Você não participa da rifa</p>
            <p className="text-sm mt-1">Fale com o administrador para participar</p>
          </div>
        )}
      </div>

      {showComprovante && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b"><h3 className="text-lg font-semibold">Enviar Comprovante</h3><button onClick={() => setShowComprovante(false)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button></div>
            <div className="p-4 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg"><p className="text-sm text-blue-700"><strong>Tipo:</strong> {comprovanteData.tipo === 'mensalidade' ? 'Mensalidade' : 'Empréstimo'}{comprovanteData.mes_referencia && <> • {formatMesReferencia(comprovanteData.mes_referencia)}</>}</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label><input type="number" step="0.01" value={comprovanteData.valor_informado} onChange={(e) => setComprovanteData({ ...comprovanteData, valor_informado: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Comprovante</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {comprovanteData.arquivo ? <div className="space-y-2">{comprovanteData.arquivo.type.startsWith('image/') ? <img src={URL.createObjectURL(comprovanteData.arquivo)} alt="Preview" className="max-h-40 mx-auto rounded-lg border" /> : <div className="flex items-center justify-center gap-2 p-4 bg-red-50 rounded-lg"><FileText className="text-red-500" size={32} /><span className="text-sm text-gray-700">PDF</span></div>}<div className="flex items-center justify-between"><span className="text-sm truncate max-w-[200px]">{comprovanteData.arquivo.name}</span><button onClick={() => setComprovanteData({ ...comprovanteData, arquivo: null })} className="text-red-500"><X size={20} /></button></div></div> : <label className="cursor-pointer"><div className="flex flex-col items-center gap-2"><Camera className="text-gray-400" size={32} /><span className="text-sm text-gray-500">Clique para selecionar</span></div><input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && setComprovanteData({ ...comprovanteData, arquivo: e.target.files[0] })} /></label>}
                </div>
              </div>
              {uploadProgress > 0 && <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${uploadProgress}%` }} /></div>}
            </div>
            <div className="flex gap-3 p-4 border-t"><button onClick={() => setShowComprovante(false)} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button><button onClick={handleEnviarComprovante} disabled={enviando || !comprovanteData.arquivo} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">{enviando ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}{enviando ? 'Enviando...' : 'Enviar'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserArea;
