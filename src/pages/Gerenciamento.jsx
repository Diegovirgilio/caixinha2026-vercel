import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Loader2, DollarSign, Percent, Calendar,
  Key, User, Shield, CheckCircle, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/useStore';
import { supabase } from '../services/supabase';
import { formatCurrency } from '../utils/formatters';
import { CONFIG } from '../utils/constants';

const Gerenciamento = () => {
  const { cotista } = useAuthStore();
  const { cotistas, loadCotistas, loadMensalidades, loadConfiguracoes: loadConfiguracoesStore } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('config');

  // Estados das configurações
  const [configForm, setConfigForm] = useState({
    valor_por_cota: '50',
    juros_vista: '20',
    juros_parcelado: '30',
    limite_emprestimo_percent: '80',
    pix_chave: '',
    pix_nome: ''
  });

  // Estados para gerenciar admins
  const [selectedAdmin, setSelectedAdmin] = useState('');

  useEffect(() => {
    loadConfiguracoes();
    loadCotistas();
  }, []);

  const loadConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*');

      if (error) throw error;

      const configObj = {};
      data.forEach(item => {
        configObj[item.chave] = item.valor;
      });

      setConfigForm({
        valor_por_cota: configObj.valor_por_cota || '50',
        juros_vista: configObj.juros_vista || '20',
        juros_parcelado: configObj.juros_parcelado || '30',
        limite_emprestimo_percent: configObj.limite_emprestimo_percent || '80',
        pix_chave: configObj.pix_chave || '',
        pix_nome: configObj.pix_nome || ''
      });
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setError('');

    try {
      const updates = Object.entries(configForm).map(([chave, valor]) => ({
        chave,
        valor: String(valor)
      }));

      for (const item of updates) {
        const { error } = await supabase
          .from('configuracoes')
          .upsert(item, { onConflict: 'chave' });

        if (error) throw error;
      }

      // Recarregar configurações no store global
      await loadConfiguracoesStore();

      setSuccess('Configurações salvas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (cotistaId, isAdmin) => {
    if (!confirm(`${isAdmin ? 'Remover' : 'Tornar'} este usuário como administrador?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('cotistas')
        .update({ is_admin: !isAdmin })
        .eq('id', cotistaId);

      if (error) throw error;

      await loadCotistas();
      setSuccess(`Permissões atualizadas com sucesso!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGerarTodasMensalidades = async () => {
    if (!confirm('Isso irá gerar mensalidades para TODOS os cotistas em TODOS os meses. Continuar?')) {
      return;
    }

    setLoading(true);
    try {
      const valorPorCota = parseFloat(configForm.valor_por_cota) || 50;

      for (const mes of CONFIG.MESES) {
        const mensalidadesParaInserir = cotistas.map(c => ({
          cotista_id: c.id,
          mes_referencia: mes,
          valor_devido: c.cotas * valorPorCota,
          valor_pago: 0,
          status: 'pendente'
        }));

        const { error } = await supabase
          .from('mensalidades')
          .upsert(mensalidadesParaInserir, { 
            onConflict: 'cotista_id,mes_referencia',
            ignoreDuplicates: true 
          });

        if (error) throw error;
      }

      await loadMensalidades();
      setSuccess('Mensalidades geradas para todos os meses!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const admins = cotistas.filter(c => c.is_admin);
  const naoAdmins = cotistas.filter(c => !c.is_admin);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="text-blue-600" />
          Gerenciamento
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configurações do sistema
        </p>
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
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'config'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Settings size={18} />
            Configurações
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'admins'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Shield size={18} />
            Administradores
          </button>
          <button
            onClick={() => setActiveTab('acoes')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'acoes'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <RefreshCw size={18} />
            Ações em Massa
          </button>
        </div>

        {/* Configurações */}
        {activeTab === 'config' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Valores */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <DollarSign className="text-green-600" size={18} />
                  Valores
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor por Cota (R$)
                  </label>
                  <input
                    type="number"
                    value={configForm.valor_por_cota}
                    onChange={(e) => setConfigForm({ ...configForm, valor_por_cota: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor mensal cobrado por cada cota
                  </p>
                </div>
              </div>

              {/* Juros */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Percent className="text-orange-600" size={18} />
                  Taxas de Juros
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Juros à Vista (%)
                  </label>
                  <input
                    type="number"
                    value={configForm.juros_vista}
                    onChange={(e) => setConfigForm({ ...configForm, juros_vista: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Juros Parcelado (%)
                  </label>
                  <input
                    type="number"
                    value={configForm.juros_parcelado}
                    onChange={(e) => setConfigForm({ ...configForm, juros_parcelado: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Limite de Empréstimo (% do investido)
                  </label>
                  <input
                    type="number"
                    value={configForm.limite_emprestimo_percent}
                    onChange={(e) => setConfigForm({ ...configForm, limite_emprestimo_percent: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* PIX */}
              <div className="space-y-4 md:col-span-2">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Key className="text-purple-600" size={18} />
                  Dados do PIX
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chave PIX
                    </label>
                    <input
                      type="text"
                      value={configForm.pix_chave}
                      onChange={(e) => setConfigForm({ ...configForm, pix_chave: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Titular
                    </label>
                    <input
                      type="text"
                      value={configForm.pix_nome}
                      onChange={(e) => setConfigForm({ ...configForm, pix_nome: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome completo"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t flex justify-end">
              <button
                onClick={handleSaveConfig}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        )}

        {/* Administradores */}
        {activeTab === 'admins' && (
          <div className="p-6">
            <div className="space-y-6">
              {/* Admins atuais */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Shield className="text-purple-600" size={18} />
                  Administradores Atuais ({admins.length})
                </h3>
                
                {admins.length > 0 ? (
                  <div className="space-y-2">
                    {admins.map(admin => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center text-purple-700 font-medium">
                            {admin.nome?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{admin.nome}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                        </div>
                        {admin.id !== cotista?.id && (
                          <button
                            onClick={() => handleToggleAdmin(admin.id, true)}
                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                          >
                            Remover Admin
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Nenhum administrador cadastrado</p>
                )}
              </div>

              {/* Adicionar admin */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="text-blue-600" size={18} />
                  Tornar Administrador
                </h3>
                
                {naoAdmins.length > 0 ? (
                  <div className="space-y-2">
                    {naoAdmins.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-medium">
                            {user.nome?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{user.nome}</p>
                            <p className="text-xs text-gray-500">{user.email || 'Sem email'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleAdmin(user.id, false)}
                          className="px-3 py-1 bg-purple-600 text-white hover:bg-purple-700 rounded-lg text-sm"
                        >
                          Tornar Admin
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Todos os cotistas já são administradores</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ações em Massa */}
        {activeTab === 'acoes' && (
          <div className="p-6">
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-yellow-800">Atenção!</p>
                    <p className="text-sm text-yellow-700">
                      As ações abaixo afetam múltiplos registros. Use com cuidado.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <Calendar className="text-blue-600" size={18} />
                    Gerar Mensalidades
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Cria mensalidades pendentes para todos os cotistas em todos os meses que ainda não existem.
                  </p>
                  <button
                    onClick={handleGerarTodasMensalidades}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    Gerar Mensalidades
                  </button>
                </div>

                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <RefreshCw className="text-green-600" size={18} />
                    Recarregar Dados
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Atualiza todos os dados do sistema a partir do banco de dados.
                  </p>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      await loadCotistas();
                      await loadMensalidades();
                      setLoading(false);
                      setSuccess('Dados recarregados!');
                      setTimeout(() => setSuccess(''), 3000);
                    }}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                    Recarregar Dados
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gerenciamento;
