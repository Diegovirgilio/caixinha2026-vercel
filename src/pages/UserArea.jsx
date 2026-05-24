import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle,
  Plus, Send, Key, PiggyBank, Calendar, FileText, Upload,
  X, Loader2, Image, Camera, Gift, Hash, Trophy, AlertTriangle,
  Copy
} from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { emprestimosApi, mensalidadesApi } from '../services/api';
import { formatCurrency, formatPercent, formatMesReferencia } from '../utils/formatters';
import { STATUS_MENSALIDADE_COLORS, STATUS_EMPRESTIMO_COLORS, STATUS_EMPRESTIMO_LABELS } from '../utils/constants';
import { gerarPixMensalidade, gerarPixEmprestimo } from '../utils/pix';

const UserArea = () => {
  const { cotista } = useAuthStore();
  const { getTotalCotas, getInvestidoByCotista, getLimiteEmprestimo, emprestimos, rifas, cdi, enviarComprovante, comprovantes, configuracoes, getNumerosRifaByCotista, rifaSorteios, cotistas, juros_atraso, mensalidades, juros_emprestimo } = useAppStore();
  const { setShowPixModal, setShowChangePasswordModal } = useUIStore();
  
  const [minhasMensalidades, setMinhasMensalidades] = useState([]);
  const [meusEmprestimos, setMeusEmprestimos] = useState([]);
  const [meusComprovantes, setMeusComprovantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSolicitacao, setShowSolicitacao] = useState(false);
  const [solicitacao, setSolicitacao] = useState({ valor: '', chavePix: '', modalidade: 'normal' });
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
  const [showPixCopiaCola, setShowPixCopiaCola] = useState(false);
  const [pixData, setPixData] = useState({ codigo: '', valor: 0, descricao: '' });
  const [pixCopiado, setPixCopiado] = useState(false);
  const [filtroMensalidade, setFiltroMensalidade] = useState('pendente');
  const [filtroEmprestimo, setFiltroEmprestimo] = useState('ativo');

  // Função para mostrar erro em pop-up
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  // Gerar PIX Copia e Cola para mensalidade
  const openPixMensalidade = (mensalidade, valorTotal) => {
    const codigo = gerarPixMensalidade({
      configuracoes,
      cotista,
      mesReferencia: mensalidade.mes_referencia,
      valorTotal
    });
    
    if (!codigo) {
      showError('Chave PIX não configurada. Contate o administrador.');
      return;
    }
    
    setPixData({
      codigo,
      valor: valorTotal,
      descricao: `Mensalidade ${formatMesReferencia(mensalidade.mes_referencia)}`
    });
    setPixCopiado(false);
    setShowPixCopiaCola(true);
  };

  // Gerar PIX Copia e Cola para empréstimo
  const openPixEmprestimo = (emprestimo, valorTotal) => {
    const codigo = gerarPixEmprestimo({
      configuracoes,
      cotista,
      emprestimoId: emprestimo.id,
      valorTotal
    });
    
    if (!codigo) {
      showError('Chave PIX não configurada. Contate o administrador.');
      return;
    }
    
    setPixData({
      codigo,
      valor: valorTotal,
      descricao: `Empréstimo - ${formatCurrency(emprestimo.valor_emprestimo)}`
    });
    setPixCopiado(false);
    setShowPixCopiaCola(true);
  };

  // Copiar código PIX
  const copiarPixCode = () => {
    navigator.clipboard.writeText(pixData.codigo).then(() => {
      setPixCopiado(true);
      setTimeout(() => setPixCopiado(false), 3000);
    });
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
  const limiteNormal = getLimiteEmprestimo(cotista?.id, 'normal');
  const limiteCaixinha = getLimiteEmprestimo(cotista?.id, 'caixinha');
  // Limite dinâmico conforme modalidade selecionada
  const limite = solicitacao.modalidade === 'caixinha' ? limiteCaixinha : limiteNormal;
  const participacao = totalCotas > 0 ? ((cotista?.cotas || 0) / totalCotas) * 100 : 0;
  
  // Bônus Rifa: proporcional ao valor de rifa pago pelo cotista
  const todasMensalidades = Object.values(mensalidades || {}).flat();
  
  const cotistasAtivosRifa = (cotistas || []).filter(c => !c.is_admin && c.status === 'ativo' && c.participa_rifa);
  const idsCotistasAtivosRifa = cotistasAtivosRifa.map(c => c.id);
  
  const totalRifaArrecadado = todasMensalidades
    .filter(m => m.status === 'pago' || m.status === 'parcial')
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);
  
  const totalRifaAtivos = todasMensalidades
    .filter(m => (m.status === 'pago' || m.status === 'parcial') && idsCotistasAtivosRifa.includes(m.cotista_id))
    .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0);
  
  const meuValorRifaPago = idsCotistasAtivosRifa.includes(cotista?.id)
    ? todasMensalidades
        .filter(m => m.cotista_id === cotista?.id && (m.status === 'pago' || m.status === 'parcial'))
        .reduce((sum, m) => sum + Number(m.valor_rifa || 0), 0)
    : 0;
  
  const totalPremiosPagos = (rifaSorteios || []).reduce((s, r) => s + Number(r.valor_premio || 0), 0);
  const sobraCaixinhaRifa = Math.max(0, totalRifaArrecadado - totalPremiosPagos);
  
  // bonusRifa = do que o cotista pagou, a proporção que NÃO foi para prêmio
  const percentualSobra = totalRifaArrecadado > 0 ? sobraCaixinhaRifa / totalRifaArrecadado : 0;
  const bonusRifas = (cotista?.participa_rifa && totalRifaArrecadado > 0)
    ? meuValorRifaPago * percentualSobra
    : 0;
  
  // Bônus CDI: proporcional às cotas
  const totalCDI = (cdi || []).reduce((s, c) => s + Number(c.valor || 0), 0);
  const bonusCDI = (totalCDI * participacao) / 100;
  
  // Bônus Juros por Atraso: proporcional às cotas
  const totalJurosAtrasoGeral = (juros_atraso || []).reduce((s, j) => s + Number(j.valor_juros || 0), 0);
  const bonusJurosAtraso = (totalJurosAtrasoGeral * participacao) / 100;
  
  // Calcular juros SEPARADOS usando tabela juros_emprestimo
  const jurosEmprestimoList = juros_emprestimo || [];
  
  let juros60 = 0;
  let juros40 = 0;
  let jurosCaixinha = 0;
  
  jurosEmprestimoList.forEach(j => {
    const valorJuros = Number(j.valor_juros || 0);
    const modalidade = j.modalidade || 'normal';
    
    if (modalidade === 'caixinha') {
      jurosCaixinha += (valorJuros * participacao) / 100;
    } else {
      if (j.cotista_id === cotista?.id) {
        juros60 += valorJuros * 0.6;
      }
      juros40 += (valorJuros * 0.4 * participacao) / 100;
    }
  });
  
  const jurosRecebidos = juros60 + juros40 + jurosCaixinha;
  // premiosRifaGanhos não entra no saldo — recebido no ato do sorteio
  const saldoFinal = investido + jurosRecebidos + bonusRifas + bonusCDI + bonusJurosAtraso;
  
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
        valor_total: valorTotal,
        modalidade: solicitacao.modalidade
      });
      setMensagem({ tipo: 'sucesso', texto: 'Solicitação enviada! Aguarde aprovação.' });
      setSolicitacao({ valor: '', chavePix: '', modalidade: 'normal' });
      setShowSolicitacao(false);
      setMeusEmprestimos(await emprestimosApi.getByCotista(cotista.id));
    } catch (error) { 
      showError('Erro ao enviar solicitação'); 
    }
    finally { setEnviando(false); setTimeout(() => setMensagem({ tipo: '', texto: '' }), 5000); }
  };

  // Calcular valores para pagamento de empréstimo
  // ── Juros de atraso: meses completos (30%/mês) + dias corridos (1%/dia) ──
  // Regra: mês do vencimento sempre conta como 1 mês; cada mês completo adicional +1
  // Tudo incide sobre o principal original (sem juros sobre juros)
  const calcularJurosAtraso = (dataVencimento, principal) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento);
    venc.setHours(0, 0, 0, 0);
    if (hoje <= venc) return { mesesAtraso: 0, diasCorridos: 0, jurosAtraso: 0 };

    let meses = 1;
    let cursor = new Date(venc);
    while (true) {
      const proximo = new Date(cursor);
      proximo.setMonth(proximo.getMonth() + 1);
      if (proximo <= hoje) { meses++; cursor = proximo; } else break;
    }
    const diasCorridos = Math.floor((hoje - cursor) / (1000 * 60 * 60 * 24));
    const jurosAtraso = principal * (meses * 0.30 + diasCorridos * 0.01);
    return { mesesAtraso: meses, diasCorridos, jurosAtraso };
  };

  const calcularPagamentoEmprestimo = () => {
    if (!emprestimoSelecionado) return { jurosVista: 0, jurosParcelado: 0, totalQuitacao: 0, totalSoJuros: 0, taxaVista: 20, taxaParcelado: 30, mesesAtraso: 0, diasCorridos: 0, jurosAtraso: 0 };
    const principal = Number(emprestimoSelecionado.principal_restante || emprestimoSelecionado.valor_emprestimo || 0);
    const taxaVista = parseFloat(configuracoes?.juros_vista || 20);
    const taxaParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
    const jurosVista = principal * (taxaVista / 100);
    const jurosParcelado = principal * (taxaParcelado / 100);

    let mesesAtraso = 0, diasCorridos = 0, jurosAtraso = 0;
    if (emprestimoSelecionado.data_vencimento && emprestimoSelecionado.status === 'ativo') {
      ({ mesesAtraso, diasCorridos, jurosAtraso } = calcularJurosAtraso(
        emprestimoSelecionado.data_vencimento, principal
      ));
    }

    return {
      principal, taxaVista, taxaParcelado, jurosVista, jurosParcelado,
      mesesAtraso, diasCorridos, jurosAtraso,
      totalQuitacao: principal + jurosVista + jurosAtraso,
      totalSoJuros: jurosParcelado + jurosAtraso
    };
  };

  const pagamentoCalc = calcularPagamentoEmprestimo();

  // calcularTotalQuitacao: usado no botão PIX — opera direto no emp sem depender do estado
  const calcularTotalQuitacao = (emp) => {
    const principal = Number(emp.principal_restante || emp.valor_emprestimo || 0);
    const taxaVista = parseFloat(configuracoes?.juros_vista || 20);
    const jurosVista = principal * (taxaVista / 100);
    let jurosAtraso = 0;
    if (emp.data_vencimento && emp.status === 'ativo') {
      ({ jurosAtraso } = calcularJurosAtraso(emp.data_vencimento, principal));
    }
    return principal + jurosVista + jurosAtraso;
  };

  // Abrir modal de pagamento de empréstimo
  const openPagamentoEmprestimoModal = (emprestimo) => {
    setEmprestimoSelecionado(emprestimo);
    setPagamentoEmprestimo({ tipo: 'quitacao', valorParcial: '', arquivo: null });
    setShowPagamentoEmprestimo(true);
  };

  // Calcular valor a pagar baseado na opção selecionada
  const getValorPagamento = () => {
    if (!emprestimoSelecionado) return 0;
    const { principal, jurosParcelado, totalQuitacao, jurosAtraso } = pagamentoCalc;
    
    switch (pagamentoEmprestimo.tipo) {
      case 'quitacao':
        return totalQuitacao; // Principal + juros à vista + juros atraso
      case 'soJuros':
        return jurosParcelado + jurosAtraso; // Juros parcelado + juros atraso
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
      const { jurosParcelado } = pagamentoCalc;
      if (valorPagamento < jurosParcelado) {
        setMensagem({ tipo: 'erro', texto: `Pagamento parcial deve ser no mínimo ${formatCurrency(jurosParcelado)} (juros)` });
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
      
      // Construir observação com detalhes do pagamento
      let observacaoTexto = `Tipo: ${pagamentoEmprestimo.tipo === 'quitacao' ? `Quitação Total (${pagamentoCalc.taxaVista}%)` : pagamentoEmprestimo.tipo === 'soJuros' ? `Só Juros (${pagamentoCalc.taxaParcelado}%)` : `Juros + Parcial (${pagamentoCalc.taxaParcelado}%)`}`;
      
      // Adicionar info de juros de atraso se houver
      if (pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) {
        observacaoTexto += ` | Atraso: ${pagamentoCalc.mesesAtraso} mês(es) + ${pagamentoCalc.diasCorridos} dia(s) = ${formatCurrency(pagamentoCalc.jurosAtraso)}`;
      }
      
      // Registrar comprovante com informações do tipo de pagamento
      await enviarComprovante({
        cotista_id: cotista.id,
        tipo: 'emprestimo',
        referencia_id: emprestimoSelecionado.id,
        valor_informado: valorPagamento,
        arquivo_url: publicUrl,
        observacao: observacaoTexto
      });
      
      setUploadProgress(100);
      // Atualiza lista local imediatamente para exibir "Aguardando confirmação"
      setMeusComprovantes((comprovantes || []).filter(c => c.cotista_id === cotista.id));
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
    // Calcular valor total incluindo rifa e atraso
    let valorBase = Number(item.valor_devido || 0);
    let multaAtraso = 0;
    let jurosAtraso = 0;
    let diasAtraso = 0;
    
    if (tipo === 'mensalidade') {
      // Calcular atraso da mensalidade
      // Formato: YYYY-MM (ex: 2026-02)
      const [ano, mes] = (item.mes_referencia || '').split('-').map(Number);
      
      if (ano && mes) {
        const ultimoDiaMes = new Date(ano, mes, 0);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (hoje > ultimoDiaMes) {
          diasAtraso = Math.floor((hoje - ultimoDiaMes) / (1000 * 60 * 60 * 24));
          multaAtraso = valorBase * 0.20; // 20% multa fixa
          jurosAtraso = valorBase * diasAtraso * 0.01; // 1% por dia
        }
      }
      
      // Adicionar rifa
      if (cotista?.participa_rifa) {
        valorBase += (cotista.cotas || 0) * 20; // R$ 20 por cota
      }
    }
    
    const valorComAtraso = valorBase + multaAtraso + jurosAtraso;
    const valorRestante = valorComAtraso - (item.valor_pago || 0);
    
    setComprovanteData({
      tipo, 
      referencia_id: item.id, 
      mes_referencia: item.mes_referencia || '',
      valor_informado: String(tipo === 'mensalidade' ? valorRestante : item.valor_total - (item.valor_pago || 0)),
      arquivo: null,
      diasAtraso,
      multaAtraso,
      jurosAtraso
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Cotas</p><p className="text-2xl font-bold text-gray-800">{cotista?.cotas || 0}</p><p className="text-xs text-gray-400">{formatPercent(participacao)} do total</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Investido</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(investido)}</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Limite Empréstimo</p><p className="text-2xl font-bold text-orange-600">{formatCurrency(limite)}</p></div>
        <div className="bg-white p-4 rounded-xl shadow"><p className="text-gray-500 text-sm">Saldo Projetado</p><p className="text-2xl font-bold text-green-600">{formatCurrency(saldoFinal)}</p></div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="text-green-600" size={20} />Seus Bônus</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {juros60 > 0 && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-600">Juros 60%</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(juros60)}</p>
              <p className="text-xs text-gray-500">seu empréstimo</p>
            </div>
          )}
          {juros40 > 0 && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-600">Juros 40%</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(juros40)}</p>
              <p className="text-xs text-gray-500">proporcional</p>
            </div>
          )}
          {jurosCaixinha > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600">Juros Caixinha</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(jurosCaixinha)}</p>
              <p className="text-xs text-gray-500">proporcional</p>
            </div>
          )}
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-gray-600">Bônus Rifas</p>
            <p className="text-lg font-bold text-purple-700">{formatCurrency(bonusRifas)}</p>
          </div>
          <div className="p-3 bg-cyan-50 rounded-lg">
            <p className="text-xs text-gray-600">Rendimento CDI</p>
            <p className="text-lg font-bold text-cyan-700">{formatCurrency(bonusCDI)}</p>
          </div>
          {bonusJurosAtraso > 0 && (
            <div className="p-3 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-600">Juros por Atraso</p>
              <p className="text-lg font-bold text-orange-700">{formatCurrency(bonusJurosAtraso)}</p>
              <p className="text-xs text-gray-500">proporcional</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Calendar className="text-blue-600" size={20} />Minhas Mensalidades</h2>
          <div className="flex gap-2">
            {['pendente', 'pago', 'todos'].map(f => (
              <button key={f} onClick={() => setFiltroMensalidade(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtroMensalidade === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                {f === 'pendente' ? 'Pendentes' : f === 'pago' ? 'Pagas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ação</th>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {minhasMensalidades.filter(m => {
                if (filtroMensalidade === 'todos') return true;
                if (filtroMensalidade === 'pago') return m.status === 'pago';
                // pendente = pendente OU parcial (parcial não existe como filtro separado)
                return m.status === 'pendente' || m.status === 'parcial';
              }).map((m) => {
                const valorRifa = cotista?.participa_rifa ? (cotista.cotas * 20) : 0;
                const valorBase = Number(m.valor_devido || 0);
                
                // Calcular atraso da mensalidade
                // Vencimento = último dia do mês de referência
                // Formato: YYYY-MM (ex: 2026-02)
                const [ano, mes] = (m.mes_referencia || '').split('-').map(Number);
                
                const ultimoDiaMes = new Date(ano, mes, 0); // dia 0 do próximo mês = último dia do mês atual
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                
                let diasAtraso = 0;
                let multaAtraso = 0;
                let jurosAtraso = 0;
                
                if (m.status !== 'pago' && ano && mes && hoje > ultimoDiaMes) {
                  diasAtraso = Math.floor((hoje - ultimoDiaMes) / (1000 * 60 * 60 * 24));
                  multaAtraso = valorBase * 0.20; // 20% multa fixa
                  jurosAtraso = valorBase * diasAtraso * 0.01; // 1% por dia
                }
                
                const valorComAtraso = valorBase + multaAtraso + jurosAtraso;
                const valorTotal = valorComAtraso + valorRifa;
                const estaAtrasado = diasAtraso > 0;
                
                return (
                  <tr key={m.id} className={estaAtrasado ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-center">
                      {m.status !== 'pago' && (
                        temComprovantePendente('mensalidade', m.id) ? (
                          <span className="text-xs text-yellow-600 flex items-center justify-center gap-1"><Clock size={14} />Aguardando</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openPixMensalidade(m, valorTotal - (m.valor_pago || 0))}
                              className="text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700 flex items-center gap-1"
                              title="PIX com valor">
                              <Copy size={14} />PIX
                            </button>
                            <button onClick={() => openComprovanteModal('mensalidade', m)}
                              className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1">
                              <Upload size={14} />Compr.
                            </button>
                          </div>
                        )
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatMesReferencia(m.mes_referencia)}
                      {estaAtrasado && (
                        <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {diasAtraso}d atraso
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">
                      {formatCurrency(valorBase)}
                      {estaAtrasado && (
                        <div className="text-xs text-red-600">
                          +{formatCurrency(multaAtraso + jurosAtraso)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {valorRifa > 0 ? (
                        <span className="text-purple-600 font-medium">{formatCurrency(valorRifa)}</span>
                      ) : (
                        <span className="text-gray-400">R$ 0,00</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-medium ${estaAtrasado ? 'text-red-600' : 'text-blue-600'}`}>
                      {formatCurrency(valorTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600">{formatCurrency(m.valor_pago)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs rounded-full ${STATUS_MENSALIDADE_COLORS[m.status]}`}>{m.status === 'pago' ? '✓ Pago' : m.status === 'parcial' ? '◐ Parcial' : '○ Pendente'}</span></td>
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
              {/* Modalidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modalidade *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSolicitacao({ ...solicitacao, modalidade: 'normal' })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      solicitacao.modalidade === 'normal'
                        ? 'border-orange-500 bg-orange-100'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className="font-medium text-gray-800">Normal</p>
                    <p className="text-xs text-gray-500">60% juros p/ você, 40% p/ todos</p>
                    <p className="text-xs text-orange-600 font-medium mt-1">Limite: {formatCurrency(limiteNormal)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolicitacao({ ...solicitacao, modalidade: 'caixinha' })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      solicitacao.modalidade === 'caixinha'
                        ? 'border-blue-500 bg-blue-100'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <p className="font-medium text-gray-800">Caixinha</p>
                    <p className="text-xs text-gray-500">100% juros p/ todos</p>
                    <p className="text-xs text-blue-600 font-medium mt-1">Limite: {formatCurrency(limiteCaixinha)}</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor desejado *</label>
                <input 
                  type="number" 
                  value={solicitacao.valor} 
                  onChange={(e) => setSolicitacao({ ...solicitacao, valor: e.target.value })} 
                  className="w-full px-4 py-2 border rounded-lg" 
                  placeholder="0,00" 
                />
                <p className={`text-xs mt-1 ${solicitacao.modalidade === 'caixinha' ? 'text-blue-600' : 'text-orange-600'}`}>
                  Limite disponível ({solicitacao.modalidade === 'caixinha' ? 'Caixinha' : 'Normal'}): {formatCurrency(limite)}
                </p>
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
                <div className={`p-3 rounded-lg border ${solicitacao.modalidade === 'caixinha' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                  <p className="text-sm text-gray-600">Valor solicitado: <span className="font-bold text-orange-600">{formatCurrency(valorEmprestimo)}</span></p>
                  <p className="text-xs text-gray-500 mt-1">Juros serão definidos no momento do pagamento ({configuracoes?.juros_vista || 20}% quitação ou {configuracoes?.juros_parcelado || 30}% parcial)</p>
                  {solicitacao.modalidade === 'caixinha' && (
                    <p className="text-xs text-blue-600 font-medium mt-1">✓ 100% dos juros será distribuído entre todos os cotistas</p>
                  )}
                </div>
              )}
              
              <div className="flex gap-3">
                <button 
                  onClick={handleSolicitarEmprestimo} 
                  disabled={enviando} 
                  className={`flex-1 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
                    solicitacao.modalidade === 'caixinha' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
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
        <div className="flex gap-2 mb-3 flex-wrap">
          {['ativo', 'pago', 'todos'].map(f => (
            <button key={f} onClick={() => setFiltroEmprestimo(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtroEmprestimo === f ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'}`}>
              {f === 'ativo' ? 'Ativos' : f === 'pago' ? 'Pagos' : 'Todos'}
            </button>
          ))}
        </div>
        {meusEmprestimos.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Nenhum empréstimo</p>
        ) : (
          <div className="space-y-3">
            {meusEmprestimos.filter(emp => {
              if (filtroEmprestimo === 'todos') return true;
              return emp.status === filtroEmprestimo;
            }).map((emp) => {
              // Usa principal_restante para refletir abatimentos parciais
              const principal = Number(emp.principal_restante || emp.valor_emprestimo || 0);
              const principalOriginal = Number(emp.valor_emprestimo || 0);
              const temAbatimento = emp.status === 'ativo' && principal < principalOriginal;
              const taxaVista = parseFloat(configuracoes?.juros_vista || 20);
              const taxaParcelado = parseFloat(configuracoes?.juros_parcelado || 30);
              const jurosVista = principal * (taxaVista / 100);
              const jurosParcelado = principal * (taxaParcelado / 100);
              
              // Calcular atraso
              const hoje = new Date();
              const vencimento = emp.data_vencimento ? new Date(emp.data_vencimento) : null;
              const diasAtraso = vencimento && emp.status === 'ativo' 
                ? Math.max(0, Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24)))
                : 0;
              const jurosAtraso = diasAtraso > 0 ? principal * (diasAtraso * 0.01) : 0;
              const estaAtrasado = diasAtraso > 0;
              
              return (
                <div key={emp.id} className={`p-4 rounded-lg border ${estaAtrasado ? 'bg-red-50 border-red-300' : emp.status === 'ativo' ? 'bg-orange-50 border-orange-200' : emp.status === 'pago' ? 'bg-green-50 border-green-200' : emp.status === 'pendente' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_EMPRESTIMO_COLORS[emp.status]}`}>
                          {STATUS_EMPRESTIMO_LABELS[emp.status]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.modalidade === 'caixinha' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {emp.modalidade === 'caixinha' ? '💰 Caixinha' : 'Normal'}
                        </span>
                        {estaAtrasado && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white flex items-center gap-1">
                            <AlertTriangle size={12} />
                            {diasAtraso} dia(s) em atraso
                          </span>
                        )}
                      </div>
                      <div className="mb-1">
                        <p className="font-bold text-lg text-gray-800">
                          Principal: <span className={temAbatimento ? 'text-orange-600' : ''}>{formatCurrency(principal)}</span>
                        </p>
                        {temAbatimento && (
                          <p className="text-xs text-gray-400">original: {formatCurrency(principalOriginal)}</p>
                        )}
                      </div>
                      {emp.status === 'ativo' && (
                        <div className="text-sm text-gray-600 mt-1">
                          {vencimento && (
                            <p className={`font-medium ${estaAtrasado ? 'text-red-600' : 'text-blue-600'}`}>
                              Vencimento: {vencimento.toLocaleDateString('pt-BR')}
                            </p>
                          )}
                          {estaAtrasado && (
                            <div className="bg-red-100 p-2 rounded mt-1 mb-2">
                              <p className="text-red-700 font-medium text-sm">
                                ⚠️ Juros por atraso: {diasAtraso} dia(s) × 1% = {formatCurrency(jurosAtraso)}
                              </p>
                            </div>
                          )}
                          <p className={estaAtrasado ? 'text-red-700' : ''}>
                            Quitação ({taxaVista}%): {formatCurrency(principal + jurosVista + jurosAtraso)}
                            {estaAtrasado && <span className="text-xs ml-1">(inclui atraso)</span>}
                          </p>
                          <p className={estaAtrasado ? 'text-red-700' : ''}>
                            Só Juros ({taxaParcelado}%): {formatCurrency(jurosParcelado + jurosAtraso)}
                            {estaAtrasado && <span className="text-xs ml-1">(inclui atraso)</span>}
                          </p>
                          {emp.modalidade === 'caixinha' && (
                            <p className="text-blue-600 text-xs mt-1">✓ 100% dos juros distribuído entre todos</p>
                          )}
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

            {/* Histórico de Sorteios */}
            {rifaSorteios && rifaSorteios.length > 0 && (
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Trophy size={16} className="text-yellow-500" />
                  Sorteios Realizados ({rifaSorteios.length})
                </p>
                {rifaSorteios.map((sorteio, sorteioIdx) => (
                  <div key={sorteioIdx} className={`rounded-lg p-3 ${sorteioIdx === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'}`}>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      {sorteioIdx === 0 && '⭐ '}{sorteio.mes_referencia}
                    </p>
                    {sorteio.vencedores && sorteio.vencedores.length > 0 ? (
                      <div className="space-y-1">
                        {sorteio.vencedores.map((v, idx) => {
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
                    ) : sorteio.cotista_vencedor_id ? (
                      <p className="text-sm text-gray-600">
                        Vencedor: <strong>{sorteio.cotista_vencedor?.nome}</strong>
                        {' '}- Prêmio: <strong className="text-green-600">{formatCurrency(sorteio.valor_premio)}</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhum vencedor neste mês</p>
                    )}
                  </div>
                ))}
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
              <div className={`p-3 rounded-lg ${comprovanteData.diasAtraso > 0 ? 'bg-red-50 border border-red-200' : 'bg-blue-50'}`}>
                <p className="text-sm text-gray-700">
                  <strong>Tipo:</strong> {comprovanteData.tipo === 'mensalidade' ? 'Mensalidade' : 'Empréstimo'}
                  {comprovanteData.mes_referencia && <> • {formatMesReferencia(comprovanteData.mes_referencia)}</>}
                </p>
                {comprovanteData.diasAtraso > 0 && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {comprovanteData.diasAtraso} dia(s) em atraso
                  </span>
                )}
              </div>
              
              {/* Detalhamento do atraso */}
              {comprovanteData.tipo === 'mensalidade' && comprovanteData.diasAtraso > 0 && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Multa e Juros por Atraso
                  </p>
                  <div className="mt-2 text-sm text-red-700 space-y-1">
                    <div className="flex justify-between">
                      <span>Multa (20%):</span>
                      <span className="font-medium">{formatCurrency(comprovanteData.multaAtraso)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Juros ({comprovanteData.diasAtraso}d × 1%):</span>
                      <span className="font-medium">{formatCurrency(comprovanteData.jurosAtraso)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-red-200 pt-1">
                      <span>Total acréscimos:</span>
                      <span>{formatCurrency(comprovanteData.multaAtraso + comprovanteData.jurosAtraso)}</span>
                    </div>
                  </div>
                </div>
              )}
              
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
              <div className={`p-3 rounded-lg ${(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) ? 'bg-red-50 border border-red-200' : 'bg-orange-50'}`}>
                <p className="text-sm text-gray-700">
                  <strong>Principal Restante:</strong> {formatCurrency(pagamentoCalc.principal)}
                </p>
                {emprestimoSelecionado?.data_vencimento && (
                  <p className={`text-xs mt-1 ${(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    Vencimento: {new Date(emprestimoSelecionado.data_vencimento).toLocaleDateString('pt-BR')}
                    {(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) && ` (${pagamentoCalc.mesesAtraso} mês(es) e ${pagamentoCalc.diasCorridos} dia(s) em atraso)`}
                  </p>
                )}
              </div>
              
              {/* Alerta de Juros de Atraso */}
              {(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle size={16} />
                    Juros por Atraso
                  </p>
                  <div className="mt-2 text-sm text-red-700 space-y-1">
                    {pagamentoCalc.mesesAtraso > 0 && (
                      <p>{pagamentoCalc.mesesAtraso} mês(es) × 30% = <strong>{formatCurrency(pagamentoCalc.principal * pagamentoCalc.mesesAtraso * 0.30)}</strong></p>
                    )}
                    {pagamentoCalc.diasCorridos > 0 && (
                      <p>{formatCurrency(pagamentoCalc.principal)} × {pagamentoCalc.diasCorridos} dia(s) × 1% = <strong>{formatCurrency(pagamentoCalc.principal * pagamentoCalc.diasCorridos * 0.01)}</strong></p>
                    )}
                    <p className="font-medium border-t border-red-300 pt-1">Total atraso: <strong>{formatCurrency(pagamentoCalc.jurosAtraso)}</strong></p>
                  </div>
                  <p className="text-xs text-red-600 mt-2">Este valor será adicionado ao pagamento.</p>
                </div>
              )}
              
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
                    {(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) && (
                      <p className="text-xs text-red-600">Inclui {formatCurrency(pagamentoCalc.jurosAtraso)} de juros por atraso</p>
                    )}
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
                    <p className="text-sm text-orange-600 font-bold">{formatCurrency(pagamentoCalc.totalSoJuros)}</p>
                    <p className="text-xs text-gray-500">Principal continua: {formatCurrency(pagamentoCalc.principal)}</p>
                    {(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) && (
                      <p className="text-xs text-red-600">Inclui {formatCurrency(pagamentoCalc.jurosAtraso)} de juros por atraso</p>
                    )}
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
                    <p className="text-xs text-gray-500">Mínimo: {formatCurrency(pagamentoCalc.totalSoJuros)} (juros{(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) ? ' + atraso' : ''})</p>
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
                      placeholder={`Mínimo ${formatCurrency(pagamentoCalc.totalSoJuros)}`}
                    />
                    {pagamentoEmprestimo.valorParcial && parseFloat(pagamentoEmprestimo.valorParcial) >= pagamentoCalc.totalSoJuros && (
                      <p className="text-xs text-blue-600 mt-1">
                        Abate: {formatCurrency(pagamentoCalc.totalSoJuros)} (juros{(pagamentoCalc.mesesAtraso > 0 || pagamentoCalc.diasCorridos > 0) ? ' + atraso' : ''}) + {formatCurrency(parseFloat(pagamentoEmprestimo.valorParcial) - pagamentoCalc.totalSoJuros)} (principal)
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
              
              {/* Botão PIX — gerado com o valor da opção selecionada */}
              {getValorPagamento() > 0 && (
                <button
                  onClick={() => openPixEmprestimo(emprestimoSelecionado, getValorPagamento())}
                  className="w-full bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Copy size={16} />
                  Copiar PIX — {formatCurrency(getValorPagamento())}
                </button>
              )}

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

      {/* Modal PIX Copia e Cola */}
      {showPixCopiaCola && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-green-500 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="text-white" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white">PIX Copia e Cola</h3>
              <p className="text-white/80 text-sm mt-1">{pixData.descricao}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Valor a pagar</p>
                <p className="text-3xl font-bold text-gray-800">{formatCurrency(pixData.valor)}</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-500 mb-2">Código PIX (clique para copiar)</p>
                <div 
                  onClick={copiarPixCode}
                  className="bg-white p-3 rounded border border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <p className="text-xs font-mono text-gray-700 break-all leading-relaxed select-all">
                    {pixData.codigo}
                  </p>
                </div>
              </div>
              
              <button
                onClick={copiarPixCode}
                className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                  pixCopiado 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gradient-to-r from-teal-500 to-green-500 text-white hover:from-teal-600 hover:to-green-600'
                }`}
              >
                {pixCopiado ? (
                  <><CheckCircle size={20} />Copiado!</>
                ) : (
                  <><Copy size={20} />Copiar Código PIX</>
                )}
              </button>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Como usar:</strong> Copie o código acima, abra o app do seu banco, 
                  escolha "PIX Copia e Cola" e cole. O valor já estará preenchido.
                </p>
              </div>
              
              <button 
                onClick={() => setShowPixCopiaCola(false)} 
                className="w-full py-2 text-gray-600 hover:text-gray-800"
              >
                Fechar
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
