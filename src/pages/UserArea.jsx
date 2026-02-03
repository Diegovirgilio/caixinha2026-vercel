import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle,
  Plus, Send, Key, PiggyBank, Calendar, FileText, Upload,
  X, Loader2, Image, Camera, Gift, Hash, Trophy, AlertTriangle
} from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { emprestimosApi, mensalidadesApi } from '../services/api';
import { formatCurrency, formatPercent, formatMesReferencia } from '../utils/formatters';
import { STATUS_MENSALIDADE_COLORS, STATUS_EMPRESTIMO_COLORS, STATUS_EMPRESTIMO_LABELS } from '../utils/constants';

const UserArea = () => {
  const { cotista } = useAuthStore();
  const { getTotalCotas, getInvestidoByCotista, getLimiteEmprestimo, emprestimos, rifas, cdi, enviarComprovante, comprovantes, configuracoes, getNumerosRifaByCotista, rifaSorteios, cotistas } = useAppStore();
  const { setShowPixModal, setShowChangePasswordModal } = useUIStore();
  
  const [minhasMensalidades, setMinhasMensalidades] = useState([]);
  const [meusEmprestimos, setMeusEmprestimos] = useState([]);
  const [meusComprovantes, setMeusComprovantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [solicitacao, setSolicitacao] = useState({ valor: '', chavePix: '' });
  const [showComprovante, setShowComprovante] = useState(false);
  const [comprovanteData, setComprovanteData] = useState({ tipo: 'mensalidade', referencia_id: '', mes_referencia: '', valor_informado: '', arquivo: null });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });
  const [showPagamentoEmprestimo, setShowPagamentoEmprestimo] = useState(false);
  const [emprestimoSelecionado, setEmprestimoSelecionado] = useState(null);
  const [pagamentoEmprestimo, setPagamentoEmprestimo] = useState({ tipo: 'quitacao', valorParcial: '', arquivo: null });
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Função para mostrar erro em pop-up
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

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
  
  // Bônus Rifa: (valor_caixinha dos sorteios) / participantes da rifa
  // Apenas para quem participa da rifa
  const totalCaixinhaRifa = (rifaSorteios || []).reduce((s, r) => s + Number(r.valor_caixinha || 0), 0);
  const participantesRifa = (cotistas || []).filter(c => c.participa_rifa && !c.is_admin).length;
  const bonusRifas = cotista?.participa_rifa && participantesRifa > 0 
    ? totalCaixinhaRifa / participantesRifa 
    : 0;
  
  // Bônus CDI: proporcional às cotas
  const totalCDI = (cdi || []).reduce((s, c) => s + Number(c.valor || 0), 0);
  const bonusCDI = (totalCDI * participacao) / 100;
  
  const jurosRecebidos = (emprestimos || []).filter(e => e.status === 'pago').reduce((total, emp) => {
    const jurosTotal = Number(emp.valor_juros || 0);
    let bonus = emp.cotista_id === cotista?.id ? jurosTotal * 0.6 : 0;
    bonus += (jurosTotal * 0.4 * participacao) / 100;
    return total + bonus;
  }, 0);
  const saldoFinal = investido + jurosRecebidos + bonusRifas + bonusCDI;
  
  // Cálculo do valor do empréstimo solicitado
  const valorEmprestimo = parseFloat(solicitacao.valor) || 0;

  const handleSolicitarEmprestimo = async () => {
    // Validações com pop-up
    if (!solicitacao.valor) { 
      showError('Informe o valor do empréstimo'); 
      return; 
    }
    if (!solicitacao.chavePix) { 
      showError('Informe sua chave PIX para receber'); 
      return; 
    }
    const valor = parseFloat(solicitacao.valor);
    if (valor > limite) { 
      showError(`Valor excede o limite disponível de ${formatCurrency(limite)}`); 
      return; 
    }
    
    // Calcular juros (à vista = 20%)
    const taxaJuros = parseFloat(configuracoes?.juros_vista || 20);
    const valorJuros = valor * (taxaJuros / 100);
    const valorTotal = valor + valorJuros;
    
    setEnviando(true);
    try {
      await emprestimosApi.solicitar({ 
        cotista_id: cotista.id, 
        cotista_nome: cotista.nome,
        valor, 
        tipo: 'vista',
        parcelas: 1, 
        chave_pix: solicitacao.chavePix,
        taxa_juros: taxaJuros,
        valor_juros: valorJuros,
        valor_total: valorTotal
      });
      setMensagem({ tipo: 'sucesso', texto: 'Solicitação enviada! Aguarde aprovação.' });
      setSolicitacao({ valor: '', chavePix: '' });
      setShowSolicitacao(false);
      setMeusEmprestimos(await emprestimosApi.getByCotista(cotista.id));
    } catch (error) { 
      showError('Erro ao enviar solicitação'); 
    }
    finally { setEnviando(false); setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000); }
  };

  // Calcular valores para pagamento de empréstimo
  const calcularPagamentoEmprestimo = () => {
    if (!emprestimoSelecionado) return { jurosVista: 0, jurosParcelado: 0, totalQuitacao: 0, totalSoJuros: 0, taxaVista: 20, taxaParcelado: 30 };
    const principal = Number(emprestimoSelecionado.valor_emprestimo || 0);
    const taxaVista = parseFloat(configuracoes?.juros_vista || 20);
    const taxaParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
    const jurosVista = principal * (taxaVista / 100);
    const jurosParcelado = principal * (taxaParcelado / 100);
    return {
      principal,
      taxaVista,
      taxaParcelado,
      jurosVista,
      jurosParcelado,
      totalQuitacao: principal + jurosVista,
      totalSoJuros: jurosParcelado
    };
  };

  const pagamentoCalc = calcularPagamentoEmprestimo();

  // Abrir modal de pagamento de empréstimo
  const openPagamentoEmprestimoModal = (emprestimo) => {
    setEmprestimoSelecionado(emprestimo);
    setPagamentoEmprestimo({ tipo: 'quitacao', valorParcial: '', arquivo: null });
    setShowPagamentoEmprestimo(true);
  };

  // Calcular valor a pagar baseado na opção selecionada
  const getValorPagamento = () => {
    if (!emprestimoSelecionado) return 0;
    const { principal, jurosParcelado, totalQuitacao } = pagamentoCalc;
    
    switch (pagamentoEmprestimo.tipo) {
      case 'quitacao':
        return totalQuitacao; // Principal + juros à vista
      case 'soJuros':
        return jurosParcelado; // Juros parcelado
      case 'parcial':
        return parseFloat(pagamentoEmprestimo.valorParcial) || 0;
      default:
        return 0;
    }
  };

  // Enviar comprovante de pagamento de empréstimo
  const handleEnviarPagamentoEmprestimo = async () => {
    if (!pagamentoEmprestimo.arquivo) { 
      setMensagem({ tipo: 'erro', texto: 'Selecione o comprovante' }); 
      return; 
    }
    
    const valorPagamento = getValorPagamento();
    if (valorPagamento <= 0) {
      setMensagem({ tipo: 'erro', texto: 'Valor inválido' });
      return;
    }

    // Validar pagamento parcial (deve ser maior que os juros)
    if (pagamentoEmprestimo.tipo === 'parcial') {
      const { juros30 } = pagamentoCalc;
      if (valorPagamento < juros30) {
        setMensagem({ tipo: 'erro', texto: `Pagamento parcial deve ser no mínimo ${formatCurrency(juros30)} (juros)` });
        return;
      }
    }

    setEnviando(true);
    setUploadProgress(10);
    
    try {
      // Upload do comprovante
      const fileExt = pagamentoEmprestimo.arquivo.name.split('.').pop();
      const fileName = `emprestimo_${emprestimoSelecionado.id}_${Date.now()}.${fileExt}`;
      const filePath = `comprovantes/${cotista.id}/${fileName}`;
      
      setUploadProgress(30);
      
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(filePath, pagamentoEmprestimo.arquivo);
      
      if (uploadError) throw uploadError;
      
      setUploadProgress(60);
      
      const { data: { publicUrl } } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(filePath);
      
      // Registrar comprovante com informações do tipo de pagamento
      await enviarComprovante({
        cotista_id: cotista.id,
        tipo: 'emprestimo',
        referencia_id: emprestimoSelecionado.id,
        valor_informado: valorPagamento,
        arquivo_url: publicUrl,
        observacao: `Tipo: ${pagamentoEmprestimo.tipo === 'quitacao' ? `Quitação Total (${pagamentoCalc.taxaVista}%)` : pagamentoEmprestimo.tipo === 'soJuros' ? `Só Juros (${pagamentoCalc.taxaParcelado}%)` : `Juros + Parcial (${pagamentoCalc.taxaParcelado}%)`}`
      });
      
      setUploadProgress(100);
      setMensagem({ tipo: 'sucesso', texto: 'Comprovante enviado! Aguarde aprovação.' });
      setShowPagamentoEmprestimo(false);
      setEmprestimoSelecionado(null);
      
    } catch (error) {
      console.error('Erro ao enviar:', error);
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar comprovante' });
    } finally {
      setEnviando(false);
      setUploadProgress(0);
      setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000);
    }
  };

  const openComprovanteModal = (tipo, item) => {
    // Calcular valor total incluindo rifa
    let valorDevido = Number(item.valor_devido || 0);
    if (tipo === 'mensalidade' && cotista?.participa_rifa) {
      valorDevido += (cotista.cotas || 0) * 20; // R$ 20 por cota
    }
    const valorRestante = valorDevido - (item.valor_pago || 0);
    
    setComprovanteData({
      tipo, 
      referencia_id: item.id, 
      mes_referencia: item.mes_referencia || '',
      valor_informado: String(tipo === 'mensalidade' ? valorRestante : item.valor_total - (item.valor_pago || 0)),
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
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mensalidade</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  <span className="flex items-center justify-center gap-1">
                    <Gift size={12} className="text-purple-500" />
                    Rifa
                  </span>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pago</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {minhasMensalidades.map((m) => {
                const valorRifa = cotista?.participa_rifa ? (cotista.cotas * 20) : 0;
                const valorTotal = Number(m.valor_devido || 0) + valorRifa;
                
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatMesReferencia(m.mes_referencia)}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{formatCurrency(m.valor_devido)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      {valorRifa > 0 ? (
                        <span className="text-purple-600 font-medium">{formatCurrency(valorRifa)}</span>
                      ) : (
                        <span className="text-gray-400">R$ 0,00</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-blue-600">{formatCurrency(valorTotal)}</td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{formatCurrency(m.valor_pago)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs rounded-full ${STATUS_MENSALIDADE_COLORS[m.status]}`}>{m.status === 'pago' ? '✓ Pago' : m.status === 'parcial' ? '◐ Parcial' : '○ Pendente'}</span></td>
                    <td className="px-4 py-3 text-center">{m.status !== 'pago' && (temComprovantePendente('mensalidade', m.id) ? <span className="text-xs text-yellow-600 flex items-center justify-center gap-1"><Clock size={14} />Aguardando</span> : <button onClick={() => openComprovanteModal('mensalidade', m)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1"><Upload size={14} />Comprovante</button>)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><PiggyBank className="text-orange-600" size={20} />Meus Empréstimos</h2>
          <button onClick={() => setShowSolicitacao(!showSolicitacao)} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-orange-600"><Plus size={16} />Solicitar</button>
        </div>
        
        {/* Formulário de Solicitação */}
        {showSolicitacao && (
          <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="font-medium text-orange-800 mb-3">Nova Solicitação de Empréstimo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor desejado *</label>
                <input 
                  type="number" 
                  value={solicitacao.valor} 
                  onChange={(e) => setSolicitacao({ ...solicitacao, valor: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                  placeholder="0,00" 
                />
                <p className="text-xs text-gray-500 mt-1">Limite disponível: {formatCurrency(limite)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sua Chave PIX para receber *</label>
                <input 
                  type="text" 
                  value={solicitacao.chavePix} 
                  onChange={(e) => setSolicitacao({ ...solicitacao, chavePix: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                  placeholder="CPF, telefone, email ou chave aleatória" 
                />
              </div>
              
              {valorEmprestimo > 0 && (
                <div className="p-3 bg-white rounded-lg border">
                  <p className="text-sm text-gray-600">Valor solicitado: <span className="font-bold text-orange-600">{formatCurrency(valorEmprestimo)}</span></p>
                  <p className="text-xs text-gray-500 mt-1">Juros serão definidos no momento do pagamento ({configuracoes?.juros_vista || 20}% quitação ou {configuracoes?.juros_parcelado || 30}% parcial)</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={handleSolicitarEmprestimo} 
                  disabled={enviando} 
                  className="flex-1 bg-orange-500 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-orange-600"
                >
                  <Send size={16} />
                  {enviando ? 'Enviando...' : 'Enviar Solicitação'}
                </button>
                <button onClick={() => setShowSolicitacao(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Lista de Empréstimos */}
        {meusEmprestimos.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Nenhum empréstimo</p>
        ) : (
          <div className="space-y-3">
            {meusEmprestimos.map((emp) => {
              const principal = Number(emp.valor_emprestimo || 0);
              const taxaVista = parseFloat(configuracoes?.juros_vista || 20);
              const taxaParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
              const jurosVista = principal * (taxaVista / 100);
              const jurosParcelado = principal * (taxaParcelado / 100);
              
              return (
                <div key={emp.id} className={`p-4 rounded-lg border ${emp.status === 'ativo' ? 'bg-orange-50 border-orange-200' : emp.status === 'pago' ? 'bg-green-50 border-green-200' : emp.status === 'pendente' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_EMPRESTIMO_COLORS[emp.status]}`}>
                          {STATUS_EMPRESTIMO_LABELS[emp.status]}
                        </span>
                      </div>
                      <p className="font-bold text-lg text-gray-800">Principal: {formatCurrency(principal)}</p>
                      {emp.status === 'ativo' && (
                        <div className="text-sm text-gray-600 mt-1">
                          <p>Quitação ({taxaVista}%): {formatCurrency(principal + jurosVista)}</p>
                          <p>Só Juros ({taxaParcelado}%): {formatCurrency(jurosParcelado)}</p>
                        </div>
                      )}
                      {emp.chave_pix && emp.status === 'pendente' && (
                        <p className="text-xs text-gray-500 mt-1">PIX: {emp.chave_pix}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {emp.status === 'ativo' && (
                        temComprovantePendente('emprestimo', emp.id) ? (
                          <span className="text-xs text-yellow-600 flex items-center gap-1 bg-yellow-100 px-3 py-1 rounded-full">
                            <Clock size={14} />Aguardando aprovação
                          </span>
                        ) : (
                          <button 
                            onClick={() => openPagamentoEmprestimoModal(emp)} 
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
                          >
                            <Upload size={16} />
                            Pagar
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                {cotista?.cotas} cota(s) × 5 números = {(cotista?.cotas || 0) * 5} números
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
                {rifaSorteios[0].vencedores && rifaSorteios[0].vencedores.length > 0 ? (
                  <div className="space-y-1">
                    {rifaSorteios[0].vencedores.map((v, idx) => {
                      const vencedorCotista = cotistas?.find(c => c.id === v.cotista_id);
                      const posicaoLabel = v.posicao === 'primeiro' ? '🥇' : v.posicao === 'segundo' ? '🥈' : '🥉';
                      return (
                        <p key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                          <span>{posicaoLabel}</span>
                          <strong>{vencedorCotista?.nome || 'Desconhecido'}</strong>
                          <span className="font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">{v.numero}</span>
                          <span className="text-green-600 font-medium">{formatCurrency(v.valor)}</span>
                        </p>
                      );
                    })}
                  </div>
                ) : rifaSorteios[0].cotista_vencedor_id ? (
                  <p className="text-sm text-gray-600">
                    Vencedor: <strong>{rifaSorteios[0].cotista_vencedor?.nome}</strong> 
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

      {/* Modal de Pagamento de Empréstimo */}
      {showPagamentoEmprestimo && emprestimoSelecionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Pagar Empréstimo</h3>
              <button onClick={() => setShowPagamentoEmprestimo(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Resumo do Empréstimo */}
              <div className="bg-orange-50 p-3 rounded-lg">
                <p className="text-sm text-orange-700">
                  <strong>Principal:</strong> {formatCurrency(pagamentoCalc.principal)}
                </p>
              </div>
              
              {/* Opções de Pagamento */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Tipo de Pagamento</label>
                
                {/* Opção 1: Quitação Total */}
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${pagamentoEmprestimo.tipo === 'quitacao' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="tipoPagamento"
                    value="quitacao"
                    checked={pagamentoEmprestimo.tipo === 'quitacao'}
                    onChange={(e) => setPagamentoEmprestimo({ ...pagamentoEmprestimo, tipo: e.target.value })}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Quitação Total ({pagamentoCalc.taxaVista}% juros)</p>
                    <p className="text-sm text-green-600 font-bold">{formatCurrency(pagamentoCalc.totalQuitacao)}</p>
                  </div>
                </label>
                
                {/* Opção 2: Só Juros */}
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${pagamentoEmprestimo.tipo === 'soJuros' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="tipoPagamento"
                    value="soJuros"
                    checked={pagamentoEmprestimo.tipo === 'soJuros'}
                    onChange={(e) => setPagamentoEmprestimo({ ...pagamentoEmprestimo, tipo: e.target.value })}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Só Juros ({pagamentoCalc.taxaParcelado}%)</p>
                    <p className="text-sm text-orange-600 font-bold">{formatCurrency(pagamentoCalc.jurosParcelado)}</p>
                    <p className="text-xs text-gray-500">Principal continua: {formatCurrency(pagamentoCalc.principal)}</p>
                  </div>
                </label>
                
                {/* Opção 3: Parcial */}
                <label className={`flex items-center p-3 border rounded-lg cursor-pointer ${pagamentoEmprestimo.tipo === 'parcial' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="tipoPagamento"
                    value="parcial"
                    checked={pagamentoEmprestimo.tipo === 'parcial'}
                    onChange={(e) => setPagamentoEmprestimo({ ...pagamentoEmprestimo, tipo: e.target.value })}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">Juros + Parte do Principal ({pagamentoCalc.taxaParcelado}%)</p>
                    <p className="text-xs text-gray-500">Mínimo: {formatCurrency(pagamentoCalc.jurosParcelado)} (juros)</p>
                  </div>
                </label>
                
                {pagamentoEmprestimo.tipo === 'parcial' && (
                  <div className="ml-6 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor do pagamento</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pagamentoEmprestimo.valorParcial}
                      onChange={(e) => setPagamentoEmprestimo({ ...pagamentoEmprestimo, valorParcial: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder={`Mínimo ${formatCurrency(pagamentoCalc.jurosParcelado)}`}
                    />
                    {pagamentoEmprestimo.valorParcial && parseFloat(pagamentoEmprestimo.valorParcial) >= pagamentoCalc.jurosParcelado && (
                      <p className="text-xs text-blue-600 mt-1">
                        Abate: {formatCurrency(pagamentoCalc.jurosParcelado)} (juros) + {formatCurrency(parseFloat(pagamentoEmprestimo.valorParcial) - pagamentoCalc.jurosParcelado)} (principal)
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Valor a Pagar */}
              <div className="bg-gray-100 p-3 rounded-lg">
                <p className="text-sm text-gray-600">Valor a pagar:</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(getValorPagamento())}</p>
              </div>
              
              {/* Upload do Comprovante */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprovante de Pagamento</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {pagamentoEmprestimo.arquivo ? (
                    <div className="space-y-2">
                      {pagamentoEmprestimo.arquivo.type.startsWith('image/') ? (
                        <img src={URL.createObjectURL(pagamentoEmprestimo.arquivo)} alt="Preview" className="max-h-40 mx-auto rounded-lg border" />
                      ) : (
                        <div className="flex items-center justify-center gap-2 p-4 bg-red-50 rounded-lg">
                          <FileText className="text-red-500" size={32} />
                          <span className="text-sm text-gray-700">PDF</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm truncate max-w-[200px]">{pagamentoEmprestimo.arquivo.name}</span>
                        <button onClick={() => setPagamentoEmprestimo({ ...pagamentoEmprestimo, arquivo: null })} className="text-red-500">
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="text-gray-400" size={32} />
                        <span className="text-sm text-gray-500">Clique para selecionar</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && setPagamentoEmprestimo({ ...pagamentoEmprestimo, arquivo: e.target.files[0] })} 
                      />
                    </label>
                  )}
                </div>
              </div>
              
              {uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 p-4 border-t">
              <button 
                onClick={() => setShowPagamentoEmprestimo(false)} 
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleEnviarPagamentoEmprestimo} 
                disabled={enviando || !pagamentoEmprestimo.arquivo || (pagamentoEmprestimo.tipo === 'parcial' && !pagamentoEmprestimo.valorParcial)} 
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-green-700"
              >
                {enviando ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {enviando ? 'Enviando...' : 'Enviar Comprovante'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Erro */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Atenção</h3>
              <p className="text-gray-600">{errorMessage}</p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserArea;
