import React, { useState, useEffect } from 'react';
import { 
  FileCheck, Clock, CheckCircle, XCircle, Eye, Download,
  Search, Filter, Loader2, X, AlertTriangle, Image, FileText,
  Upload, Plus, Camera, Edit2, Trash2, RotateCcw
} from 'lucide-react';
import { useAppStore, useAuthStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';

const Comprovantes = () => {
  const { cotista } = useAuthStore();
  const { comprovantes, loadComprovantes, aprovarComprovante, rejeitarComprovante, cotistas, mensalidades, emprestimos, loadCotistas, loadMensalidades, loadEmprestimos } = useAppStore();
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEnviarModal, setShowEnviarModal] = useState(false);
  const [selectedComprovante, setSelectedComprovante] = useState(null);
  const [valorAprovado, setValorAprovado] = useState('');
  const [jurosAtraso, setJurosAtraso] = useState('');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Estado para enviar comprovante
  const [enviarData, setEnviarData] = useState({
    cotista_id: '',
    tipo: 'mensalidade',
    mes_referencia: '',
    valor_informado: '',
    arquivo: null
  });

  useEffect(() => {
    loadComprovantes();
    loadCotistas();
    loadMensalidades();
    loadEmprestimos();
  }, []);

  // Obter meses únicos dos comprovantes
  const mesesDisponiveis = [...new Set(comprovantes.map(c => c.mes_referencia).filter(Boolean))].sort();

  // Filtrar comprovantes
  const comprovantesFiltrados = comprovantes
    .filter(c => {
      const matchSearch = c.cotista?.nome?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus;
      const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo;
      const matchMes = filtroMes === 'todos' || c.mes_referencia === filtroMes;
      return matchSearch && matchStatus && matchTipo && matchMes;
    });

  // Estatísticas
  const stats = {
    pendentes: comprovantes.filter(c => c.status === 'pendente').length,
    aprovados: comprovantes.filter(c => c.status === 'aprovado').length,
    rejeitados: comprovantes.filter(c => c.status === 'rejeitado').length
  };

  // Helper para obter detalhes do empréstimo
  const getEmprestimoInfo = (comprovante) => {
    if (comprovante.tipo !== 'emprestimo') return null;
    
    const emp = emprestimos.find(e => e.id === comprovante.referencia_id);
    if (!emp) return null;
    
    // Extrair tipo de pagamento da observação
    const obs = comprovante.observacao || '';
    let tipoPagamento = 'Não identificado';
    if (obs.includes('Quitação')) tipoPagamento = 'Quitação Total';
    else if (obs.includes('Só Juros')) tipoPagamento = 'Só Juros';
    else if (obs.includes('Parcial')) tipoPagamento = 'Juros + Parcial';
    
    // Calcular dias de atraso
    let diasAtraso = 0;
    let jurosAtraso = 0;
    const principalRestante = Number(emp.principal_restante || emp.valor_emprestimo || 0);
    
    if (emp.data_vencimento) {
      const hoje = new Date();
      const vencimento = new Date(emp.data_vencimento);
      diasAtraso = Math.max(0, Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24)));
      jurosAtraso = principalRestante * (diasAtraso * 0.01); // 1% por dia
    }
    
    return {
      principal: emp.valor_emprestimo,
      principalRestante,
      modalidade: emp.modalidade || 'normal',
      tipoPagamento,
      vencimento: emp.data_vencimento,
      status: emp.status,
      diasAtraso,
      jurosAtraso
    };
  };

  const openModal = (comprovante) => {
    setSelectedComprovante(comprovante);
    setValorAprovado(String(comprovante.valor_informado));
    setMotivoRejeicao('');
    setError('');
    
    // Calcular juros de atraso automaticamente para empréstimos
    let jurosAtrasoCalculado = 0;
    if (comprovante.tipo === 'emprestimo') {
      const emp = emprestimos.find(e => e.id === comprovante.referencia_id);
      if (emp && emp.data_vencimento && emp.status === 'ativo') {
        const hoje = new Date();
        const vencimento = new Date(emp.data_vencimento);
        const diasAtraso = Math.max(0, Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24)));
        if (diasAtraso > 0) {
          const principalRestante = Number(emp.principal_restante || emp.valor_emprestimo || 0);
          jurosAtrasoCalculado = principalRestante * (diasAtraso * 0.01); // 1% por dia
        }
      }
    }
    setJurosAtraso(jurosAtrasoCalculado > 0 ? String(jurosAtrasoCalculado.toFixed(2)) : '');
    
    setShowModal(true);
  };

  const handleAprovar = async () => {
    const valor = parseFloat(valorAprovado);
    if (isNaN(valor) || valor <= 0) {
      setError('Informe um valor válido');
      return;
    }

    const juros = parseFloat(jurosAtraso) || 0;
    if (juros < 0) {
      setError('Juros não pode ser negativo');
      return;
    }
    if (juros >= valor) {
      setError('Juros não pode ser maior ou igual ao valor depositado');
      return;
    }

    setLoading(true);
    try {
      await aprovarComprovante(selectedComprovante.id, cotista.id, valor, juros);
      setShowModal(false);
      setSuccess(juros > 0 
        ? `Comprovante aprovado! R$ ${juros.toFixed(2)} registrado como juros por atraso.`
        : 'Comprovante aprovado com sucesso!'
      );
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejeitar = async () => {
    if (!motivoRejeicao.trim()) {
      setError('Informe o motivo da rejeição');
      return;
    }

    setLoading(true);
    try {
      await rejeitarComprovante(selectedComprovante.id, cotista.id, motivoRejeicao);
      setShowModal(false);
      setSuccess('Comprovante rejeitado.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pendente: { icon: Clock, class: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
      aprovado: { icon: CheckCircle, class: 'bg-green-100 text-green-700', label: 'Aprovado' },
      rejeitado: { icon: XCircle, class: 'bg-red-100 text-red-700', label: 'Rejeitado' }
    };
    const { icon: Icon, class: className, label } = config[status] || config.pendente;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${className}`}>
        <Icon size={14} />
        {label}
      </span>
    );
  };

  const getTipoBadge = (tipo) => {
    return tipo === 'mensalidade' 
      ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">Mensalidade</span>
      : <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">Empréstimo</span>;
  };

  const getFileIcon = (url) => {
    if (url?.toLowerCase().includes('.pdf')) {
      return <FileText className="text-red-500" size={20} />;
    }
    return <Image className="text-blue-500" size={20} />;
  };

  // Deletar comprovante
  const handleDeletarComprovante = async (comprovante) => {
    if (!confirm(`Deletar comprovante de "${comprovante.cotista?.nome}"?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comprovantes')
        .delete()
        .eq('id', comprovante.id);

      if (error) throw error;

      await loadComprovantes();
      setSuccess('Comprovante deletado!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Erro ao deletar');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Voltar comprovante para pendente (para reavaliar)
  const handleVoltarPendente = async (comprovante) => {
    if (!confirm(`Voltar comprovante de "${comprovante.cotista?.nome}" para pendente?\n\nVocê poderá reavaliá-lo.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('comprovantes')
        .update({ 
          status: 'pendente',
          validado_por: null,
          data_validacao: null,
          motivo_rejeicao: null
        })
        .eq('id', comprovante.id);

      if (error) throw error;

      await loadComprovantes();
      setSuccess('Comprovante voltou para pendente!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Cotistas ativos (não admin)
  const cotistasAtivos = cotistas.filter(c => !c.is_admin && c.status === 'ativo');

  // Função para enviar comprovante (admin)
  const handleEnviarComprovante = async () => {
    if (!enviarData.cotista_id) {
      setError('Selecione um cotista');
      return;
    }
    if (!enviarData.valor_informado || parseFloat(enviarData.valor_informado) <= 0) {
      setError('Informe o valor do pagamento');
      return;
    }
    if (!enviarData.arquivo) {
      setError('Selecione um arquivo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Upload do arquivo
      const file = enviarData.arquivo;
      const fileExt = file.name.split('.').pop();
      const fileName = `${enviarData.cotista_id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('comprovantes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(fileName);

      // Criar registro do comprovante
      const { error: insertError } = await supabase
        .from('comprovantes')
        .insert({
          cotista_id: enviarData.cotista_id,
          tipo: enviarData.tipo,
          mes_referencia: enviarData.mes_referencia || null,
          valor_informado: parseFloat(enviarData.valor_informado),
          arquivo_url: urlData.publicUrl,
          status: 'pendente'
        });

      if (insertError) throw insertError;

      // Enviar alerta via Telegram
      try {
        const { alertaNovoComprovante } = await import('../services/telegram');
        const cotistaEncontrado = cotistasAtivos.find(c => c.id === enviarData.cotista_id);
        await alertaNovoComprovante(
          cotistaEncontrado?.nome || 'Desconhecido',
          parseFloat(enviarData.valor_informado),
          enviarData.tipo
        );
      } catch (telegramError) {
        console.log('Erro ao enviar alerta Telegram:', telegramError);
      }

      await loadComprovantes();
      setShowEnviarModal(false);
      setEnviarData({ cotista_id: '', tipo: 'mensalidade', mes_referencia: '', valor_informado: '', arquivo: null });
      setSuccess('Comprovante enviado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Erro ao enviar comprovante');
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
            <FileCheck className="text-blue-600" />
            Comprovantes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Validação de comprovantes de pagamento
          </p>
        </div>
        <button
          onClick={() => setShowEnviarModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
        >
          <Upload size={20} />
          Enviar Comprovante
        </button>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-yellow-600 text-sm">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pendentes}</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-green-600 text-sm">Aprovados</p>
              <p className="text-2xl font-bold text-green-700">{stats.aprovados}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <XCircle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-red-600 text-sm">Rejeitados</p>
              <p className="text-2xl font-bold text-red-700">{stats.rejeitados}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pendentes em Destaque */}
      {stats.pendentes > 0 && filtroStatus !== 'pendente' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-yellow-600" size={24} />
            <div>
              <p className="font-medium text-yellow-800">
                Você tem {stats.pendentes} comprovante(s) aguardando validação
              </p>
              <button 
                onClick={() => setFiltroStatus('pendente')}
                className="text-yellow-600 hover:text-yellow-700 text-sm underline"
              >
                Ver pendentes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cotista..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos Status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="rejeitado">Rejeitados</option>
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos Tipos</option>
            <option value="mensalidade">Mensalidade</option>
            <option value="emprestimo">Empréstimo</option>
          </select>
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Meses</option>
            {mesesDisponiveis.map(mes => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Comprovantes */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cotista
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Valor Informado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comprovantesFiltrados.map((c) => {
                const empInfo = getEmprestimoInfo(c);
                return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {c.cotista?.nome?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{c.cotista?.nome}</p>
                        <p className="text-xs text-gray-500">{c.mes_referencia || 'Empréstimo'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {getTipoBadge(c.tipo)}
                      {empInfo && (
                        <>
                          <span className={`text-xs px-2 py-0.5 rounded ${empInfo.modalidade === 'caixinha' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {empInfo.modalidade === 'caixinha' ? '💰 Caixinha' : 'Normal'}
                          </span>
                          <span className="text-xs text-orange-600 font-medium">{empInfo.tipoPagamento}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{formatCurrency(c.valor_informado)}</span>
                      {empInfo && (
                        <span className="text-xs text-gray-500">
                          Principal: {formatCurrency(empInfo.principalRestante)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-500">
                    {formatDate(c.created_at)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(c.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <a
                        href={c.arquivo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Ver comprovante"
                      >
                        {getFileIcon(c.arquivo_url)}
                      </a>
                      {c.status === 'pendente' && (
                        <button
                          onClick={() => openModal(c)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Validar
                        </button>
                      )}
                      {(c.status === 'aprovado' || c.status === 'rejeitado') && (
                        <>
                          <button
                            onClick={() => handleVoltarPendente(c)}
                            disabled={loading}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                            title="Voltar para pendente"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button
                            onClick={() => handleDeletarComprovante(c)}
                            disabled={loading}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Deletar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {comprovantesFiltrados.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <FileCheck size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhum comprovante encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Validação */}
      {showModal && selectedComprovante && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">Validar Comprovante</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Info do Comprovante */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cotista:</span>
                  <span className="font-medium">{selectedComprovante.cotista?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span>{selectedComprovante.tipo === 'mensalidade' ? 'Mensalidade' : 'Empréstimo'}</span>
                </div>
                {selectedComprovante.mes_referencia && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referência:</span>
                    <span>{selectedComprovante.mes_referencia}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Informado:</span>
                  <span className="font-bold text-blue-600">
                    {formatCurrency(selectedComprovante.valor_informado)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data do Envio:</span>
                  <span>{formatDate(selectedComprovante.created_at)}</span>
                </div>
              </div>

              {/* Detalhes do Empréstimo */}
              {selectedComprovante.tipo === 'emprestimo' && (() => {
                const empInfo = getEmprestimoInfo(selectedComprovante);
                if (!empInfo) return <div className="bg-red-50 p-3 rounded-lg text-red-600 text-sm">Empréstimo não encontrado</div>;
                
                const taxaJuros = empInfo.tipoPagamento === 'Quitação Total' ? 20 : 30;
                const jurosEsperado = empInfo.principalRestante * (taxaJuros / 100);
                const valorQuitacao = empInfo.principalRestante + jurosEsperado;
                
                return (
                  <div className={`p-4 rounded-lg border-2 ${empInfo.diasAtraso > 0 ? 'bg-red-50 border-red-400' : empInfo.modalidade === 'caixinha' ? 'bg-blue-50 border-blue-300' : 'bg-orange-50 border-orange-300'}`}>
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      📋 Detalhes do Empréstimo
                      <span className={`px-2 py-0.5 rounded-full text-xs ${empInfo.modalidade === 'caixinha' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'}`}>
                        {empInfo.modalidade === 'caixinha' ? '💰 Caixinha' : 'Normal'}
                      </span>
                      {empInfo.diasAtraso > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white">
                          ⚠️ {empInfo.diasAtraso} dia(s) em atraso
                        </span>
                      )}
                    </h4>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Principal Original:</span>
                        <span className="font-medium">{formatCurrency(empInfo.principal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Principal Restante:</span>
                        <span className="font-bold text-red-600">{formatCurrency(empInfo.principalRestante)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tipo de Pagamento:</span>
                        <span className="font-medium text-purple-600">{empInfo.tipoPagamento}</span>
                      </div>
                      {empInfo.vencimento && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Vencimento:</span>
                          <span className={empInfo.diasAtraso > 0 ? 'text-red-600 font-medium' : ''}>
                            {new Date(empInfo.vencimento).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      
                      {/* Alerta de Juros por Atraso */}
                      {empInfo.diasAtraso > 0 && (
                        <div className="bg-red-100 border border-red-300 rounded p-2 mt-2">
                          <p className="text-red-800 font-medium text-sm">⚠️ Juros por Atraso (1% ao dia)</p>
                          <p className="text-red-700 text-sm mt-1">
                            {formatCurrency(empInfo.principalRestante)} × {empInfo.diasAtraso} dias × 1% = <strong>{formatCurrency(empInfo.jurosAtraso)}</strong>
                          </p>
                        </div>
                      )}
                      
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <p className="text-gray-500 text-xs font-medium">Valores esperados:</p>
                        {empInfo.tipoPagamento === 'Só Juros' && (
                          <>
                            <div className="flex justify-between text-orange-700">
                              <span>Só Juros ({taxaJuros}%):</span>
                              <span className="font-bold">{formatCurrency(jurosEsperado)}</span>
                            </div>
                            {empInfo.diasAtraso > 0 && (
                              <>
                                <div className="flex justify-between text-red-600">
                                  <span>+ Juros Atraso:</span>
                                  <span className="font-bold">{formatCurrency(empInfo.jurosAtraso)}</span>
                                </div>
                                <div className="flex justify-between text-red-800 font-bold border-t pt-1">
                                  <span>TOTAL:</span>
                                  <span>{formatCurrency(jurosEsperado + empInfo.jurosAtraso)}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        {empInfo.tipoPagamento === 'Quitação Total' && (
                          <>
                            <div className="flex justify-between text-green-700">
                              <span>Quitação ({taxaJuros}%):</span>
                              <span className="font-bold">{formatCurrency(valorQuitacao)}</span>
                            </div>
                            {empInfo.diasAtraso > 0 && (
                              <>
                                <div className="flex justify-between text-red-600">
                                  <span>+ Juros Atraso:</span>
                                  <span className="font-bold">{formatCurrency(empInfo.jurosAtraso)}</span>
                                </div>
                                <div className="flex justify-between text-red-800 font-bold border-t pt-1">
                                  <span>TOTAL:</span>
                                  <span>{formatCurrency(valorQuitacao + empInfo.jurosAtraso)}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        {empInfo.tipoPagamento === 'Juros + Parcial' && (
                          <>
                            <div className="flex justify-between text-blue-700">
                              <span>Mínimo (só juros):</span>
                              <span className="font-bold">{formatCurrency(jurosEsperado)}</span>
                            </div>
                            {empInfo.diasAtraso > 0 && (
                              <>
                                <div className="flex justify-between text-red-600">
                                  <span>+ Juros Atraso:</span>
                                  <span className="font-bold">{formatCurrency(empInfo.jurosAtraso)}</span>
                                </div>
                                <div className="flex justify-between text-red-800 font-bold border-t pt-1">
                                  <span>MÍNIMO TOTAL:</span>
                                  <span>{formatCurrency(jurosEsperado + empInfo.jurosAtraso)}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="bg-white/50 p-2 rounded mt-2 text-xs">
                        {empInfo.modalidade === 'caixinha' ? (
                          <p className="text-blue-700">💰 <strong>Caixinha:</strong> 100% dos juros vai proporcional para todos</p>
                        ) : (
                          <p className="text-orange-700">📊 <strong>Normal:</strong> 60% juros p/ tomador + 40% proporcional</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Ver Comprovante */}
              <div className="border rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Comprovante enviado:</p>
                <a
                  href={selectedComprovante.arquivo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                >
                  {getFileIcon(selectedComprovante.arquivo_url)}
                  <span>Abrir comprovante em nova aba</span>
                </a>
                
                {/* Preview se for imagem */}
                {selectedComprovante.arquivo_url && !selectedComprovante.arquivo_url.toLowerCase().includes('.pdf') && (
                  <img 
                    src={selectedComprovante.arquivo_url} 
                    alt="Comprovante" 
                    className="mt-3 max-h-64 rounded-lg border"
                  />
                )}
              </div>

              {/* Valor a Aprovar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Depositado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={valorAprovado}
                  onChange={(e) => setValorAprovado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0,00"
                />
              </div>

              {/* Juros por Atraso */}
              {(() => {
                // Calcular dias de atraso para exibição
                let diasAtraso = 0;
                let principalRestante = 0;
                if (selectedComprovante.tipo === 'emprestimo') {
                  const emp = emprestimos.find(e => e.id === selectedComprovante.referencia_id);
                  if (emp && emp.data_vencimento && emp.status === 'ativo') {
                    const hoje = new Date();
                    const vencimento = new Date(emp.data_vencimento);
                    diasAtraso = Math.max(0, Math.floor((hoje - vencimento) / (1000 * 60 * 60 * 24)));
                    principalRestante = Number(emp.principal_restante || emp.valor_emprestimo || 0);
                  }
                }
                
                return (
                  <div className={`border rounded-lg p-4 ${diasAtraso > 0 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-200'}`}>
                    <label className={`block text-sm font-medium mb-1 ${diasAtraso > 0 ? 'text-red-700' : 'text-orange-700'}`}>
                      Juros por Atraso (R$)
                      {diasAtraso > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-xs">
                          ⚠️ {diasAtraso} dia(s) em atraso
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={jurosAtraso}
                      onChange={(e) => setJurosAtraso(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 ${diasAtraso > 0 ? 'border-red-300 focus:ring-red-500' : 'border-orange-300 focus:ring-orange-500'}`}
                      placeholder="0,00"
                    />
                    
                    {diasAtraso > 0 && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-700">
                        <p className="font-medium">Cálculo automático (1% por dia):</p>
                        <p>{formatCurrency(principalRestante)} × {diasAtraso} dias × 1% = <strong>{formatCurrency(principalRestante * diasAtraso * 0.01)}</strong></p>
                      </div>
                    )}
                    
                    <p className={`text-xs mt-2 ${diasAtraso > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {diasAtraso > 0 
                        ? 'Valor preenchido automaticamente. Você pode ajustar se necessário.'
                        : 'Se houver juros por atraso, informe o valor. Este valor vai para a caixinha (proporcional).'}
                    </p>
                    
                    {/* Resumo do cálculo */}
                    {parseFloat(jurosAtraso) > 0 && parseFloat(valorAprovado) > 0 && (
                      <div className="mt-3 pt-3 border-t border-orange-200 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Valor depositado:</span>
                          <span className="font-medium">{formatCurrency(parseFloat(valorAprovado))}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Juros por atraso:</span>
                          <span className="font-medium">- {formatCurrency(parseFloat(jurosAtraso))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-700 pt-1 border-t border-orange-200">
                          <span>Valor p/ cotista:</span>
                          <span>{formatCurrency(parseFloat(valorAprovado) - parseFloat(jurosAtraso))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Motivo de Rejeição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo da Rejeição (se aplicável)
                </label>
                <textarea
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={2}
                  placeholder="Informe o motivo caso rejeite..."
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 p-4 border-t bg-gray-50 sticky bottom-0">
              <button
                onClick={handleRejeitar}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <XCircle size={18} />}
                Rejeitar
              </button>
              <button
                onClick={handleAprovar}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Comprovante */}
      {showEnviarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Upload size={24} />
                  Enviar Comprovante
                </h3>
                <button onClick={() => setShowEnviarModal(false)} className="text-white/80 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cotista *</label>
                <select
                  value={enviarData.cotista_id}
                  onChange={(e) => setEnviarData({ ...enviarData, cotista_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Selecione...</option>
                  {cotistasAtivos.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={enviarData.tipo}
                  onChange={(e) => setEnviarData({ ...enviarData, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="mensalidade">Mensalidade</option>
                  <option value="emprestimo">Empréstimo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês Referência</label>
                <input
                  type="text"
                  value={enviarData.mes_referencia}
                  onChange={(e) => setEnviarData({ ...enviarData, mes_referencia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: 01/2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  value={enviarData.valor_informado}
                  onChange={(e) => setEnviarData({ ...enviarData, valor_informado: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprovante *</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setEnviarData({ ...enviarData, arquivo: e.target.files[0] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
                {enviarData.arquivo && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ {enviarData.arquivo.name}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEnviarModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEnviarComprovante}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Comprovantes;
