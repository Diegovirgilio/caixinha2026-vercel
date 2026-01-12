import React, { useEffect, useState } from 'react';
import { 
  PiggyBank, TrendingUp, Users, Calendar, DollarSign, 
  FileText, Settings, Home, LogOut, FileCheck,
  Wifi, WifiOff, Loader2, Copy, CheckCircle, AlertCircle, Key, Lock, Eye, EyeOff,
  Download, Smartphone, X
} from 'lucide-react';
import { useAuthStore, useAppStore, useUIStore } from './store/useStore';
import { checkConnection } from './services/supabase';

// Pages
import LoginRegister from './pages/LoginRegister';
import Dashboard from './pages/Dashboard';
import UserArea from './pages/UserArea';
import Cotistas from './pages/Cotistas';
import Mensalidades from './pages/Mensalidades';
import Emprestimos from './pages/Emprestimos';
import RifasCdi from './pages/RifasCdi';
import Rifas from './pages/Rifas';
import Relatorio from './pages/Relatorio';
import Gerenciamento from './pages/Gerenciamento';
import Comprovantes from './pages/Comprovantes';

import { CONFIG } from './utils/constants';

// Modal PIX
const ModalPix = ({ onClose, configuracoes }) => {
  const [copiado, setCopiado] = useState(false);
  const pixChave = configuracoes?.pix_chave || '';
  const pixNome = configuracoes?.pix_nome || '';

  const copiarChave = () => {
    navigator.clipboard.writeText(pixChave);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-green-500 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <DollarSign className="text-white" size={32} />
          </div>
          <h3 className="text-xl font-bold text-white">Pagar via PIX</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600 text-center mb-4">
            Copie a chave PIX abaixo para realizar seu pagamento:
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p className="text-xs text-gray-500 mb-1">Chave PIX (E-mail)</p>
            <p className="font-mono text-gray-800 break-all">{pixChave}</p>
            {pixNome && <p className="text-xs text-gray-500 mt-2">Titular: {pixNome}</p>}
          </div>
          <button
            onClick={copiarChave}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              copiado 
                ? 'bg-green-500 text-white' 
                : 'bg-gradient-to-r from-teal-500 to-green-500 text-white hover:from-teal-600 hover:to-teal-600'
            }`}
          >
            {copiado ? <><CheckCircle size={20} />Chave Copiada!</> : <><Copy size={20} />Copiar Chave PIX</>}
          </button>
          <button onClick={onClose} className="w-full mt-3 py-2 text-gray-600 hover:text-gray-800">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal Trocar Senha
const ModalTrocarSenha = ({ onClose }) => {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenhas, setShowSenhas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensagem({ tipo: '', texto: '' });

    if (novaSenha.length < 6) {
      setMensagem({ tipo: 'erro', texto: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setMensagem({ tipo: 'erro', texto: 'As senhas não coincidem' });
      return;
    }

    setLoading(true);
    try {
      const { supabase } = await import('./services/supabase');
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      
      if (error) throw error;
      
      setMensagem({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' });
      setTimeout(() => onClose(), 2000);
    } catch (error) {
      setMensagem({ tipo: 'erro', texto: error.message || 'Erro ao alterar senha' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Key className="text-white" size={32} />
          </div>
          <h3 className="text-xl font-bold text-white">Trocar Senha</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mensagem.texto && (
            <div className={`p-3 rounded-lg text-sm ${
              mensagem.tipo === 'erro' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}>
              {mensagem.texto}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showSenhas ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Mínimo 6 caracteres"
                required
              />
              <button
                type="button"
                onClick={() => setShowSenhas(!showSenhas)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showSenhas ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showSenhas ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Repita a nova senha"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Key size={20} />}
            {loading ? 'Alterando...' : 'Alterar Senha'}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-gray-600 hover:text-gray-800"
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
};

const App = () => {
  // ==================== TODOS OS HOOKS PRIMEIRO ====================
  const { isAuthenticated, cotista, logout, checkAuth } = useAuthStore();
  const { loadAllData, cotistas, configuracoes, isLoading: dataLoading } = useAppStore();
  const { currentTab, setCurrentTab, showPixModal, setShowPixModal, showChangePasswordModal, setShowChangePasswordModal } = useUIStore();
  
  const [appLoading, setAppLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Effect PWA: Capturar evento de instalação
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setDeferredPrompt(null);
  };

  // Effect 1: Inicializar app
  useEffect(() => {
    const init = async () => {
      setAppLoading(true);
      
      // Verificar conexão com Supabase
      const connected = await checkConnection();
      setIsOnline(connected);
      setConnectionError(!connected);
      
      if (connected) {
        await checkAuth();
      }
      
      setAppLoading(false);
    };

    init();
  }, []);

  // Effect 2: Carregar dados quando autenticar
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      loadAllData();
    }
  }, [isAuthenticated, isOnline]);

  // Effect 3: Definir aba inicial
  useEffect(() => {
    if (cotista && !currentTab) {
      setCurrentTab(cotista.is_admin ? 'dashboard' : 'minha-area');
    }
  }, [cotista, currentTab, setCurrentTab]);

  // ==================== CONFIGURAÇÕES ====================

  // Pegar número de comprovantes pendentes
  const { comprovantes_pendentes } = useAppStore();

  // Navegação
  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'cotistas', label: 'Cotistas', icon: Users },
    { id: 'mensalidades', label: 'Mensalidades', icon: Calendar },
    { id: 'emprestimos', label: 'Empréstimos', icon: DollarSign },
    { id: 'comprovantes', label: 'Comprovantes', icon: FileCheck, badge: comprovantes_pendentes },
    { id: 'rifas', label: 'Rifas', icon: PiggyBank },
    { id: 'cdi', label: 'CDI', icon: TrendingUp },
    { id: 'relatorio', label: 'Relatório', icon: FileText },
    { id: 'gerenciamento', label: 'Gerenciamento', icon: Settings }
  ];

  const userTabs = [
    { id: 'minha-area', label: 'Minha Área', icon: Home }
  ];

  const tabs = cotista?.is_admin ? adminTabs : userTabs;
  const totalCotas = (cotistas || []).reduce((sum, c) => sum + (c.cotas || 0), 0);

  // Renderizar conteúdo
  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'minha-area':
        return <UserArea />;
      case 'cotistas':
        return <Cotistas />;
      case 'mensalidades':
        return <Mensalidades />;
      case 'emprestimos':
        return <Emprestimos />;
      case 'comprovantes':
        return <Comprovantes />;
      case 'rifas':
        return <Rifas />;
      case 'cdi':
        return <RifasCdi />;
      case 'relatorio':
        return <Relatorio />;
      case 'gerenciamento':
        return <Gerenciamento />;
      default:
        return <Dashboard />;
    }
  };

  // ==================== RENDERS CONDICIONAIS ====================

  // Tela de carregamento
  if (appLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <PiggyBank className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{CONFIG.APP_NAME}</h1>
          <div className="flex items-center justify-center gap-2 text-blue-200">
            <Loader2 className="animate-spin" size={20} />
            <span>Conectando ao servidor...</span>
          </div>
        </div>
      </div>
    );
  }

  // Erro de conexão
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Erro de Conexão</h1>
          <p className="text-gray-600 mb-6">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Tela de login
  if (!isAuthenticated) {
    return <LoginRegister />;
  }

  // ==================== RENDER PRINCIPAL ====================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <PiggyBank size={28} />
                  {CONFIG.APP_NAME}
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-blue-200 text-xs">Sistema de Gestão Financeira</p>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/30 text-green-200">
                    <Wifi size={10} />
                    Online
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPixModal(true)}
                className="bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-teal-600 hidden sm:flex items-center gap-2"
              >
                <DollarSign size={16} />
                PIX
              </button>

              <div className="flex items-center gap-3 pl-3 border-l border-white/20">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium">{cotista?.nome}</p>
                  <p className="text-xs text-blue-200">
                    {cotista?.is_admin ? 'Administrador' : `${cotista?.cotas} cotas`}
                  </p>
                </div>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">
                  {cotista?.nome?.charAt(0)}
                </div>
                <button 
                  onClick={() => setShowChangePasswordModal(true)} 
                  className="p-2 hover:bg-white/10 rounded-lg" 
                  title="Trocar Senha"
                >
                  <Key size={20} />
                </button>
                <button onClick={logout} className="p-2 hover:bg-white/10 rounded-lg" title="Sair">
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navegação */}
      <nav className="bg-white shadow-md sticky top-[72px] z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap relative ${
                  currentTab === id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={18} />
                {label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {dataLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm">
          <p>{CONFIG.APP_NAME} • Sistema de Gestão Financeira</p>
          <p className="text-gray-500 mt-1">
            Janeiro a Novembro de 2026 • {totalCotas} cotas • {cotistas.length} cotistas
          </p>
        </div>
      </footer>

      {/* Modal PIX */}
      {showPixModal && <ModalPix onClose={() => setShowPixModal(false)} configuracoes={configuracoes} />}
      
      {/* Modal Trocar Senha */}
      {showChangePasswordModal && <ModalTrocarSenha onClose={() => setShowChangePasswordModal(false)} />}

      {/* Banner Instalar App PWA */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Smartphone size={22} />
            </div>
            <div>
              <p className="font-bold text-sm">Instalar App</p>
              <p className="text-xs text-blue-200">Acesso rápido na tela inicial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-2 hover:bg-white/10 rounded-lg"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleInstallClick}
              className="px-3 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 flex items-center gap-1"
            >
              <Download size={16} />
              Instalar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
