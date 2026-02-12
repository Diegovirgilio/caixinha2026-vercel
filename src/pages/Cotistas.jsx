import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Edit2, Trash2, UserCheck, UserX,
  ChevronUp, ChevronDown, Loader2, X, Save, AlertTriangle, Info,
  Mail, CheckCircle, RefreshCw, Phone, Clock, Gift, Hash, Eye, EyeOff, Lock, FileText
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';
import ExtratoCotista from './ExtratoCotista';

const Cotistas = () => {
  const { 
    cotistas, 
    loadCotistas, 
    configuracoes,
    rifaNumeros,
    loadRifaNumeros,
    ativarRifaCotista,
    desativarRifaCotista,
    ajustarNumerosRifa,
    getNumerosRifaByCotista
  } = useAppStore();
  const [pendentes, setPendentes] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('nome');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCotista, setEditingCotista] = useState(null);
  const [showExtrato, setShowExtrato] = useState(null);
  const [formData, setFormData] = useState({ nome: '', email: '', cotas: 1, telefone: '', participa_rifa: false, senha: '', limite_emprestimo: 80, limite_emprestimo_caixinha: 100 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingRifa, setLoadingRifa] = useState(null); // ID do cotista com loading
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadCotistas();
    loadPendentes();
    loadRifaNumeros();
  }, []);

  // Carregar cotistas pendentes de aprovação
  const loadPendentes = async () => {
    try {
      const { data, error } = await supabase
        .from('cotistas')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      
      if (!error) {
        setPendentes(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar pendentes:', err);
    }
  };

  // Filtrar apenas cotistas (não admins)
  // Regra: Admin não pode ser cotista, são entidades separadas
  const apenasContistas = cotistas.filter(c => !c.is_admin);

  // Filtrar e ordenar
  const cotistasFiltrados = apenasContistas
    .filter(c => 
      c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const openAddModal = () => {
    setEditingCotista(null);
    setFormData({ nome: '', email: '', cotas: 1, telefone: '', participa_rifa: false, senha: '', limite_emprestimo: 80, limite_emprestimo_caixinha: 100 });
    setShowPassword(false);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (cotista) => {
    setEditingCotista(cotista);
    setFormData({
      nome: cotista.nome || '',
      email: cotista.email || '',
      cotas: cotista.cotas || 1,
      telefone: cotista.telefone || '',
      participa_rifa: cotista.participa_rifa || false,
      senha: '',
      limite_emprestimo: cotista.limite_emprestimo || 80,
      limite_emprestimo_caixinha: cotista.limite_emprestimo_caixinha || 100
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    
    // Admin pode ter 0 cotas, cotistas precisam ter pelo menos 1
    const isAdmin = editingCotista?.is_admin || false;
    const minCotas = isAdmin ? 0 : 1;
    
    if (formData.cotas < minCotas || formData.cotas > 50) {
      setError(`Cotas deve ser entre ${minCotas} e 50`);
      return;
    }

    // Validar senha para novo cotista
    if (!editingCotista && !formData.senha) {
      setError('Senha é obrigatória para novo cotista');
      return;
    }

    if (!editingCotista && formData.senha.length < 4) {
      setError('Senha deve ter pelo menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      const valorPorCota = parseFloat(configuracoes?.valor_por_cota || 50);
      const novoValorDevido = parseInt(formData.cotas) * valorPorCota;
      
      if (editingCotista) {
        // Atualizar cotista existente
        const { data, error: updateError } = await supabase
          .from('cotistas')
          .update({
            nome: formData.nome.trim(),
            email: formData.email || null,
            cotas: parseInt(formData.cotas),
            telefone: formData.telefone || null,
            limite_emprestimo: parseInt(formData.limite_emprestimo) || 80,
            limite_emprestimo_caixinha: parseInt(formData.limite_emprestimo_caixinha) || 100
          })
          .eq('id', editingCotista.id)
          .select();

        if (updateError) {
          console.error('Erro update:', updateError);
          throw updateError;
        }
        
        // Se mudou o número de cotas, atualizar todas as mensalidades pendentes
        if (editingCotista.cotas !== parseInt(formData.cotas)) {
          const { error: mensalidadeError } = await supabase
            .from('mensalidades')
            .update({ valor_devido: novoValorDevido })
            .eq('cotista_id', editingCotista.id)
            .in('status', ['pendente', 'parcial']);
          
          if (mensalidadeError) {
            console.error('Erro ao atualizar mensalidades:', mensalidadeError);
          }
          
          // Se participa da rifa, ajustar números
          if (editingCotista.participa_rifa) {
            await ajustarNumerosRifa(editingCotista.id, editingCotista.cotas, parseInt(formData.cotas));
          }
        }
        
        console.log('Update result:', data);
        setSuccess('Cotista atualizado com sucesso!');
      } else {
        // Criar novo cotista com usuário e senha
        // Gerar email fake se não informado
        const emailParaAuth = formData.email || `${formData.nome.trim().toLowerCase().replace(/\s+/g, '.')}@caixinha2026.local`;
        
        // Criar usuário no Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: emailParaAuth,
          password: formData.senha,
          options: {
            data: { nome: formData.nome.trim() }
          }
        });

        if (authError) {
          console.error('Erro ao criar usuário:', authError);
          throw authError;
        }

        // Criar cotista vinculado ao user_id
        const { data, error: insertError } = await supabase
          .from('cotistas')
          .insert({
            user_id: authData.user?.id,
            nome: formData.nome.trim(),
            email: formData.email || null,
            cotas: parseInt(formData.cotas),
            telefone: formData.telefone || null,
            is_admin: false,
            status: 'ativo',
            participa_rifa: formData.participa_rifa,
            email_confirmado: true // Admin criou, já está confirmado
          })
          .select()
          .single();

        if (insertError) {
          console.error('Erro insert:', insertError);
          throw insertError;
        }

        // Se marcou participar da rifa, gerar números
        if (formData.participa_rifa && data) {
          await ativarRifaCotista(data.id, parseInt(formData.cotas));
        }
        
        console.log('Insert result:', data);
        setSuccess('Cotista criado com sucesso! Senha: ' + formData.senha);
      }

      // Recarregar lista
      await loadCotistas();
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro completo:', err);
      if (err.code === '23505' || err.message?.includes('unique')) {
        if (err.message?.includes('nome') || err.details?.includes('nome')) {
          setError('Já existe um cotista com este nome');
        } else if (err.message?.includes('email') || err.details?.includes('email')) {
          setError('Já existe um cotista com este email');
        } else {
          setError('Registro duplicado');
        }
      } else {
        setError(err.message || 'Erro ao salvar');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (cotista) => {
    const novoStatus = cotista.status === 'ativo' ? 'inativo' : 'ativo';
    setLoading(true);
    
    try {
      const { error: updateError } = await supabase
        .from('cotistas')
        .update({ status: novoStatus })
        .eq('id', cotista.id);

      if (updateError) {
        console.error('Erro toggle status:', updateError);
        throw updateError;
      }
      
      await loadCotistas();
      setSuccess(`Cotista ${novoStatus === 'ativo' ? 'ativado' : 'inativado'} com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro:', err);
      setError(err.message || 'Erro ao alterar status');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cotista) => {
    if (!confirm(`Tem certeza que deseja excluir "${cotista.nome}"?\n\nEsta ação não pode ser desfeita e removerá todas as mensalidades e empréstimos associados.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('cotistas')
        .delete()
        .eq('id', cotista.id);

      if (deleteError) {
        console.error('Erro delete:', deleteError);
        throw deleteError;
      }
      
      await loadCotistas();
      setSuccess('Cotista excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro:', err);
      setError('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Toggle participação na rifa
  const handleToggleRifa = async (cotista) => {
    setLoadingRifa(cotista.id);
    try {
      if (cotista.participa_rifa) {
        // Desativar - deleta números
        await desativarRifaCotista(cotista.id);
        setSuccess(`${cotista.nome} removido da rifa`);
      } else {
        // Ativar - gera números
        const numeros = await ativarRifaCotista(cotista.id, cotista.cotas);
        setSuccess(`${cotista.nome} adicionado à rifa com ${numeros.length} números`);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao alterar rifa:', err);
      setError(err.message || 'Erro ao alterar participação na rifa');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoadingRifa(null);
    }
  };

  // Aprovar cotista pendente
  const handleAprovarPendente = async (cotista) => {
    if (!confirm(`Aprovar "${cotista.nome}"?\n\nO cotista poderá acessar o sistema.`)) {
      return;
    }

    setLoading(true);
    try {
      // Atualizar status do cotista para ativo
      const { error: updateError } = await supabase
        .from('cotistas')
        .update({ status: 'ativo' })
        .eq('id', cotista.id);

      if (updateError) throw updateError;

      // Confirmar email no Supabase Auth (usando o email do cotista)
      const emailFake = `${cotista.nome.toLowerCase().replace(/\s+/g, '.')}@gmail.com`;
      try {
        await supabase.rpc('confirm_user_email', { user_email: emailFake });
      } catch (rpcError) {
        console.log('RPC não disponível:', rpcError);
      }

      // Buscar valor por cota das configurações
      const valorPorCota = parseFloat(configuracoes?.valor_por_cota || 50);
      const valorRifaPorCota = 20; // R$ 20 por cota para rifa
      
      // Gerar mensalidades para o cotista aprovado
      const { CONFIG } = await import('../utils/constants');
      const mensalidades = CONFIG.MESES.map(mes => {
        const valorMensalidade = (cotista.cotas || 1) * valorPorCota;
        const valorRifa = cotista.participa_rifa ? (cotista.cotas || 1) * valorRifaPorCota : 0;
        
        return {
          cotista_id: cotista.id,
          mes_referencia: mes,
          valor_devido: valorMensalidade,
          valor_rifa: valorRifa,
          valor_pago: 0,
          status: 'pendente'
        };
      });
      
      await supabase.from('mensalidades').insert(mensalidades);

      // Se cotista marcou participa_rifa, gerar números
      if (cotista.participa_rifa) {
        try {
          await ativarRifaCotista(cotista.id, cotista.cotas || 1);
        } catch (rifaError) {
          console.log('Erro ao gerar números da rifa:', rifaError);
        }
      }

      await loadCotistas();
      await loadPendentes();
      await loadRifaNumeros();
      
      const msgRifa = cotista.participa_rifa ? ` com ${(cotista.cotas || 1) * 5} números da rifa` : '';
      setSuccess(`${cotista.nome} aprovado com sucesso${msgRifa}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Rejeitar/Excluir cotista pendente
  const handleRejeitarPendente = async (cotista) => {
    if (!confirm(`Rejeitar "${cotista.nome}"?\n\nO cadastro será excluído permanentemente.`)) {
      return;
    }

    setLoading(true);
    try {
      // Deletar o cotista
      const { error: deleteError } = await supabase
        .from('cotistas')
        .delete()
        .eq('id', cotista.id);

      if (deleteError) throw deleteError;

      await loadPendentes();
      setSuccess(`Cadastro de ${cotista.nome} rejeitado!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const totalCotas = cotistasFiltrados.reduce((sum, c) => sum + (c.cotas || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            Cotistas
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {cotistasFiltrados.length} cotistas • {totalCotas} cotas
          </p>
        </div>
        <button
          onClick={openAddModal}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={20} />
          Adicionar Cotista
        </button>
      </div>

      {/* Info sobre Admins */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          <strong>Nota:</strong> Administradores não aparecem nesta lista pois não são cotistas. 
          Administradores gerenciam o sistema mas não participam da caixinha.
        </p>
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

      {/* Pendentes de Aprovação */}
      {pendentes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <h2 className="font-semibold text-yellow-800 flex items-center gap-2 mb-4">
            <Clock size={20} />
            Aguardando Aprovação ({pendentes.length})
          </h2>
          <p className="text-sm text-yellow-700 mb-4">
            Estes usuários se cadastraram e aguardam sua aprovação para acessar o sistema.
          </p>
          <div className="space-y-2">
            {pendentes.map((p) => (
              <div key={p.id} className="bg-white rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 font-medium">
                    {p.nome?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{p.nome}</p>
                    <p className="text-sm text-gray-500">{p.cotas || 1} cotas</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAprovarPendente(p)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1 text-sm disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleRejeitarPendente(p)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1 text-sm disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center gap-1">
                    Nome <SortIcon field="nome" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cotas')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Cotas <SortIcon field="cotas" />
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Mensalidade
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Rifa
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cotistasFiltrados.map((cotista) => (
                <tr key={cotista.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                        {cotista.nome?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{cotista.nome}</p>
                        {cotista.telefone && (
                          <p className="text-xs text-gray-500">{cotista.telefone}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {cotista.email || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                      {cotista.cotas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {formatCurrency(cotista.cotas * parseFloat(configuracoes?.valor_por_cota || 50))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      cotista.status === 'ativo' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {cotista.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleToggleRifa(cotista)}
                        disabled={loadingRifa === cotista.id || cotista.status !== 'ativo'}
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                          cotista.participa_rifa
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } disabled:opacity-50`}
                        title={cotista.participa_rifa ? 'Remover da rifa' : 'Adicionar à rifa'}
                      >
                        {loadingRifa === cotista.id ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <Gift size={12} />
                        )}
                        {cotista.participa_rifa ? 'Participa' : 'Não participa'}
                      </button>
                      {cotista.participa_rifa && (
                        <div className="flex gap-1 flex-wrap justify-center">
                          {getNumerosRifaByCotista(cotista.id).slice(0, 4).map(n => (
                            <span key={n.id} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-xs font-mono">
                              {n.numero}
                            </span>
                          ))}
                          {getNumerosRifaByCotista(cotista.id).length > 4 && (
                            <span className="text-xs text-gray-400">+{getNumerosRifaByCotista(cotista.id).length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowExtrato(cotista)}
                        disabled={loading}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50"
                        title="Ver Extrato"
                      >
                        <FileText size={18} />
                      </button>
                      <button
                        onClick={() => openEditModal(cotista)}
                        disabled={loading}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(cotista)}
                        disabled={loading}
                        className={`p-2 rounded-lg disabled:opacity-50 ${
                          cotista.status === 'ativo'
                            ? 'text-orange-600 hover:bg-orange-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={cotista.status === 'ativo' ? 'Inativar' : 'Ativar'}
                      >
                        {cotista.status === 'ativo' ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        onClick={() => handleDelete(cotista)}
                        disabled={loading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cotistasFiltrados.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p>Nenhum cotista encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Adicionar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingCotista ? 'Editar Cotista' : 'Novo Cotista'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cotas *</label>
                <input
                  type="number"
                  min={editingCotista?.is_admin ? "0" : "1"}
                  max="50"
                  value={formData.cotas}
                  onChange={(e) => setFormData({ ...formData, cotas: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mensalidade: {formatCurrency(formData.cotas * parseFloat(configuracoes?.valor_por_cota || 50))}
                </p>
              </div>

              {/* Senha - apenas para novos cotistas */}
              {!editingCotista && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Lock size={14} className="inline mr-1" />
                    Senha de Acesso *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="Senha do cotista"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">O cotista usará esta senha para acessar o sistema</p>
                </div>
              )}

              {/* Participar da Rifa */}
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Gift size={18} className="text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Participar da Rifa</p>
                    <p className="text-xs text-gray-500">+{formatCurrency(formData.cotas * 20)}/mês</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.participa_rifa}
                    onChange={(e) => setFormData({ ...formData, participa_rifa: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Campos opcionais */}
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 mb-3">Campos opcionais:</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Limite Empréstimo Normal (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={formData.limite_emprestimo}
                      onChange={(e) => setFormData({ ...formData, limite_emprestimo: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="80"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      60% juros p/ tomador + 40% proporcional
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Limite Empréstimo Caixinha (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={formData.limite_emprestimo_caixinha}
                      onChange={(e) => setFormData({ ...formData, limite_emprestimo_caixinha: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      100% juros proporcional p/ todos
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Extrato */}
      {showExtrato && (
        <ExtratoCotista 
          cotista={showExtrato} 
          onClose={() => setShowExtrato(null)} 
        />
      )}
    </div>
  );
};

export default Cotistas;
