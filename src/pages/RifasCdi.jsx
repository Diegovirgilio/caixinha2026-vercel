import React, { useState, useEffect } from 'react';
import { 
  Gift, TrendingUp, Plus, Calendar, DollarSign, 
  Loader2, X, Save, Trash2, Edit2
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const RifasCdi = () => {
  const { rifas, cdi, loadRifas, loadCdi } = useAppStore();
  const [activeTab, setActiveTab] = useState('rifas');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('rifa'); // 'rifa' ou 'cdi'
  const [editingItem, setEditingItem] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [rifaForm, setRifaForm] = useState({
    descricao: '', valor: '', data: '', observacao: ''
  });

  const [cdiForm, setCdiForm] = useState({
    mes_referencia: '', valor: '', taxa_percentual: '', observacao: ''
  });

  useEffect(() => {
    loadRifas();
    loadCdi();
  }, []);

  // Totais
  const totalRifas = rifas.reduce((sum, r) => sum + Number(r.valor || 0), 0);
  const totalCdi = cdi.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  const openAddRifa = () => {
    setEditingItem(null);
    setRifaForm({ descricao: '', valor: '', data: new Date().toISOString().split('T')[0], observacao: '' });
    setModalType('rifa');
    setError('');
    setShowModal(true);
  };

  const openEditRifa = (rifa) => {
    setEditingItem(rifa);
    setRifaForm({
      descricao: rifa.descricao || '',
      valor: rifa.valor || '',
      data: rifa.data || '',
      observacao: rifa.observacao || ''
    });
    setModalType('rifa');
    setError('');
    setShowModal(true);
  };

  const openAddCdi = () => {
    setEditingItem(null);
    setCdiForm({ mes_referencia: '', valor: '', taxa_percentual: '', observacao: '' });
    setModalType('cdi');
    setError('');
    setShowModal(true);
  };

  const openEditCdi = (item) => {
    setEditingItem(item);
    setCdiForm({
      mes_referencia: item.mes_referencia || '',
      valor: item.valor || '',
      taxa_percentual: item.taxa_percentual || '',
      observacao: item.observacao || ''
    });
    setModalType('cdi');
    setError('');
    setShowModal(true);
  };

  const handleSaveRifa = async () => {
    if (!rifaForm.descricao.trim() || !rifaForm.valor || !rifaForm.data) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('rifas')
          .update({
            descricao: rifaForm.descricao.trim(),
            valor: parseFloat(rifaForm.valor),
            data: rifaForm.data,
            observacao: rifaForm.observacao || null
          })
          .eq('id', editingItem.id);

        if (error) throw error;
        setSuccess('Rifa atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('rifas')
          .insert({
            descricao: rifaForm.descricao.trim(),
            valor: parseFloat(rifaForm.valor),
            data: rifaForm.data,
            observacao: rifaForm.observacao || null
          });

        if (error) throw error;
        setSuccess('Rifa adicionada com sucesso!');
      }

      await loadRifas();
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCdi = async () => {
    if (!cdiForm.mes_referencia || !cdiForm.valor) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const data = {
        mes_referencia: cdiForm.mes_referencia,
        valor: parseFloat(cdiForm.valor),
        taxa_percentual: cdiForm.taxa_percentual ? parseFloat(cdiForm.taxa_percentual) : null,
        observacao: cdiForm.observacao || null
      };

      if (editingItem) {
        const { error } = await supabase
          .from('cdi')
          .update(data)
          .eq('id', editingItem.id);

        if (error) throw error;
        setSuccess('CDI atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('cdi')
          .upsert(data, { onConflict: 'mes_referencia' });

        if (error) throw error;
        setSuccess('CDI adicionado com sucesso!');
      }

      await loadCdi();
      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRifa = async (rifa) => {
    if (!confirm(`Excluir a rifa "${rifa.descricao}"?`)) return;

    try {
      const { error } = await supabase.from('rifas').delete().eq('id', rifa.id);
      if (error) throw error;
      await loadRifas();
      setSuccess('Rifa excluída com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteCdi = async (item) => {
    if (!confirm(`Excluir o CDI de ${item.mes_referencia}?`)) return;

    try {
      const { error } = await supabase.from('cdi').delete().eq('id', item.id);
      if (error) throw error;
      await loadCdi();
      setSuccess('CDI excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatarMes = (mes) => {
    if (!mes) return '';
    const [ano, m] = mes.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(m) - 1]}/${ano}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Gift className="text-blue-600" />
          Rifas & Rendimentos CDI
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Gerenciamento de receitas extras
        </p>
      </div>

      {/* Mensagens */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {error && !showModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Gift className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Rifas</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalRifas)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total CDI</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCdi)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Extras</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRifas + totalCdi)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('rifas')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'rifas'
                ? 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Gift size={18} />
            Rifas ({rifas.length})
          </button>
          <button
            onClick={() => setActiveTab('cdi')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'cdi'
                ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <TrendingUp size={18} />
            Rendimentos CDI ({cdi.length})
          </button>
        </div>

        {/* Conteúdo Rifas */}
        {activeTab === 'rifas' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={openAddRifa}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
              >
                <Plus size={18} />
                Nova Rifa
              </button>
            </div>

            {rifas.length > 0 ? (
              <div className="space-y-3">
                {rifas.map((rifa) => (
                  <div key={rifa.id} className="bg-gray-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Gift className="text-purple-600" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{rifa.descricao}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(rifa.data)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold text-purple-600">{formatCurrency(rifa.valor)}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditRifa(rifa)}
                          className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRifa(rifa)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Gift size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhuma rifa cadastrada</p>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo CDI */}
        {activeTab === 'cdi' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button
                onClick={openAddCdi}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
              >
                <Plus size={18} />
                Novo Rendimento
              </button>
            </div>

            {cdi.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Taxa</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observação</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cdi.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{formatarMes(item.mes_referencia)}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">
                          {formatCurrency(item.valor)}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {item.taxa_percentual ? `${item.taxa_percentual}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          {item.observacao || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => openEditCdi(item)}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteCdi(item)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
                <p>Nenhum rendimento CDI cadastrado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {editingItem ? 'Editar' : 'Novo'} {modalType === 'rifa' ? 'Rifa' : 'Rendimento CDI'}
              </h3>
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

              {modalType === 'rifa' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <input
                      type="text"
                      value={rifaForm.descricao}
                      onChange={(e) => setRifaForm({ ...rifaForm, descricao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Ex: Rifa de Natal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor Arrecadado *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rifaForm.valor}
                      onChange={(e) => setRifaForm({ ...rifaForm, valor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                    <input
                      type="date"
                      value={rifaForm.data}
                      onChange={(e) => setRifaForm({ ...rifaForm, data: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                    <textarea
                      value={rifaForm.observacao}
                      onChange={(e) => setRifaForm({ ...rifaForm, observacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={2}
                      placeholder="Observações adicionais..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência *</label>
                    <select
                      value={cdiForm.mes_referencia}
                      onChange={(e) => setCdiForm({ ...cdiForm, mes_referencia: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecione...</option>
                      {CONFIG.MESES.map((mes) => (
                        <option key={mes} value={mes}>{formatarMes(mes)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Rendimento *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cdiForm.valor}
                      onChange={(e) => setCdiForm({ ...cdiForm, valor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taxa CDI (%)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={cdiForm.taxa_percentual}
                      onChange={(e) => setCdiForm({ ...cdiForm, taxa_percentual: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Ex: 0.85"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                    <textarea
                      value={cdiForm.observacao}
                      onChange={(e) => setCdiForm({ ...cdiForm, observacao: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      rows={2}
                      placeholder="Observações adicionais..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={modalType === 'rifa' ? handleSaveRifa : handleSaveCdi}
                disabled={loading}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                  modalType === 'rifa' 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RifasCdi;
