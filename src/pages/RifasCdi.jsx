import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Plus, Calendar, DollarSign, 
  Loader2, X, Save, Trash2, Edit2
} from 'lucide-react';
import { useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const RifasCdi = () => {
  const { cdi, loadCdi } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [cdiForm, setCdiForm] = useState({
    mes_referencia: '', valor: '', taxa_percentual: '', observacao: ''
  });

  useEffect(() => {
    loadCdi();
  }, []);

  // Total
  const totalCdi = cdi.reduce((sum, c) => sum + Number(c.valor || 0), 0);

  const openAddCdi = () => {
    setEditingItem(null);
    setCdiForm({ mes_referencia: '', valor: '', taxa_percentual: '', observacao: '' });
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
    setError('');
    setShowModal(true);
  };

  const handleSaveCdi = async () => {
    if (!cdiForm.mes_referencia || !cdiForm.valor) {
      setError('Preencha mês e valor');
      return;
    }

    setLoading(true);
    try {
      const dados = {
        mes_referencia: cdiForm.mes_referencia,
        valor: parseFloat(cdiForm.valor),
        taxa_percentual: cdiForm.taxa_percentual ? parseFloat(cdiForm.taxa_percentual) : null,
        observacao: cdiForm.observacao || null
      };

      if (editingItem) {
        const { error } = await supabase.from('cdi').update(dados).eq('id', editingItem.id);
        if (error) throw error;
        setSuccess('CDI atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('cdi').insert(dados);
        if (error) throw error;
        setSuccess('CDI cadastrado com sucesso!');
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

  const handleDeleteCdi = async (item) => {
    if (!confirm(`Excluir o CDI de ${formatarMes(item.mes_referencia)}?`)) return;

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-green-600" />
            Rendimentos CDI
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerenciamento de rendimentos do CDI
          </p>
        </div>
        <button
          onClick={openAddCdi}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Novo CDI
        </button>
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

      {/* Card Total */}
      <div className="bg-white rounded-xl shadow p-4 max-w-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-gray-500 text-sm">Total Rendimentos CDI</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalCdi)}</p>
          </div>
        </div>
      </div>

      {/* Lista de CDI */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mês</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Taxa %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observação</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cdi.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-green-500" />
                      <span className="font-medium">{formatarMes(item.mes_referencia)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">
                    {formatCurrency(item.valor)}
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {item.taxa_percentual ? `${item.taxa_percentual}%` : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {item.observacao || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditCdi(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCdi(item)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cdi.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <TrendingUp size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>Nenhum rendimento CDI cadastrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CDI */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="text-green-600" />
                {editingItem ? 'Editar CDI' : 'Novo Rendimento CDI'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês Referência</label>
                <input
                  type="month"
                  value={cdiForm.mes_referencia}
                  onChange={(e) => setCdiForm({ ...cdiForm, mes_referencia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
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
                  step="0.01"
                  value={cdiForm.taxa_percentual}
                  onChange={(e) => setCdiForm({ ...cdiForm, taxa_percentual: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: 0.85"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                <input
                  type="text"
                  value={cdiForm.observacao}
                  onChange={(e) => setCdiForm({ ...cdiForm, observacao: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCdi}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RifasCdi;
