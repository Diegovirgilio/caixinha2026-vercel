import React, { useEffect, useState } from 'react';
import { 
  PiggyBank, TrendingUp, Users, Calendar, DollarSign, 
  FileText, Settings, Home, LogOut,
  Wifi, WifiOff, Loader2, Copy, CheckCircle, AlertCircle
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
import Relatorio from './pages/Relatorio';
import Gerenciamento from './pages/Gerenciamento';

import { CONFIG } from './utils/constants';

// Modal PIX
const ModalPix = ({ onClose }) => {
  const [copiado, setCopiado] = useState(false);

  const copiarChave = () => {
    navigator.clipboard.writeText(CONFIG.PIX_CHAVE);
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
            <p className="font-mono text-gray-800 break-all">{CONFIG.PIX_CHAVE}</p>
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

const App = () => {
  // ==================== TODOS OS HOOKS PRIMEIRO ====================
  const { isAuthenticated, cotista, logout, checkAuth } = useAuthStore();
  const { loadAllData, cotistas, isLoading: dataLoading } = useAppStore();
  const { currentTab, setCurrentTab, showPixModal, setShowPixModal } = useUIStore();
  
  const [appLoading, setAppLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

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

  // Navegação
  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'cotistas', label: 'Cotistas', icon: Users },
    { id: 'mensalidades', label: 'Mensalidades', icon: Calendar },
    { id: 'emprestimos', label: 'Empréstimos', icon: DollarSign },
    { id: 'rifas', label: 'Rifas & CDI', icon: PiggyBank },
    { id: 'relatorio', label: 'Relatório', icon: FileText },
    { id: 'gerenciamento', label: 'Gerenciamento', icon: Settings }
  ];

  const userTabs = [
    { id: 'minha-area', label: 'Minha Área', icon: Home }
  ];

  const tabs = cotista?.is_admin ? adminTabs : userTabs;
  const totalCotas = cotistas.reduce((sum, c) => sum + (c.cotas || 0), 0);

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
      case 'rifas':
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
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentTab(id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  currentTab === id
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={18} />
                {label}
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
      {showPixModal && <ModalPix onClose={() => setShowPixModal(false)} />}
    </div>
  );
};

export default App;
