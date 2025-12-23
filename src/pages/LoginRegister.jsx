import React, { useState, useEffect } from 'react';
import { 
  PiggyBank, LogIn, Eye, EyeOff, UserPlus, CheckCircle, 
  Loader2, Wifi, Mail, Lock, User, Hash, AlertTriangle
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/useStore';
import { CONFIG } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

const LoginRegister = () => {
  const [mode, setMode] = useState('login'); // 'login', 'select', 'register'
  
  const [loginData, setLoginData] = useState({ email: '', password: '', nome: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  const [registerData, setRegisterData] = useState({
    nome: '', email: '', password: '', confirmPassword: '', cotas: ''
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, loginByName, register } = useAuthStore();
  const { cotistas, loadCotistas } = useAppStore();

  // Carregar lista de cotistas para o select
  useEffect(() => {
    loadCotistas();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'select') {
        if (!loginData.nome) {
          setError('Selecione um nome');
          setLoading(false);
          return;
        }
        await loginByName(loginData.nome, loginData.password);
      } else {
        if (!loginData.email) {
          setError('Digite seu email');
          setLoading(false);
          return;
        }
        await login(loginData.email, loginData.password);
      }
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validações
    if (!registerData.nome.trim() || registerData.nome.trim().length < 2) {
      setError('Nome deve ter pelo menos 2 caracteres');
      return;
    }
    if (!registerData.email.includes('@')) {
      setError('Digite um email válido');
      return;
    }
    if (registerData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    const cotasNum = parseInt(registerData.cotas);
    if (!registerData.cotas || isNaN(cotasNum) || cotasNum < 1) {
      setError('Informe um número válido de cotas (mínimo 1)');
      return;
    }
    if (cotasNum > 50) {
      setError('Número de cotas deve ser entre 1 e 50');
      return;
    }

    setLoading(true);
    try {
      await register({
        email: registerData.email,
        password: registerData.password,
        nome: registerData.nome.trim(),
        cotas: parseInt(registerData.cotas)
      });
      setSuccess('Cadastro realizado! Verifique seu email (inclusive a pasta de spam) para confirmar sua conta. Seu acesso será liberado após a confirmação.');
      setRegisterData({ nome: '', email: '', password: '', confirmPassword: '', cotas: '' });
      setTimeout(() => { setMode('login'); setSuccess(''); }, 8000);
    } catch (err) {
      // Verificar se é erro de nome duplicado
      if (err.message.includes('sobrenome') || err.message.includes('já existe')) {
        setError(err.message);
      } else if (err.message.includes('already registered')) {
        setError('Este email já está cadastrado. Tente fazer login.');
      } else {
        setError(err.message || 'Erro ao cadastrar');
      }
    } finally {
      setLoading(false);
    }
  };

  const cotasNum = parseInt(registerData.cotas) || 0;
  const valorMensalidade = cotasNum * CONFIG.VALOR_POR_COTA;
  const valorTotal = valorMensalidade * 11;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center relative">
          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-100">
              <Wifi size={12} />
              Online
            </div>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PiggyBank className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">{CONFIG.APP_NAME}</h1>
          <p className="text-blue-200 mt-2">Sistema de Gestão Financeira</p>
        </div>

        {/* Conteúdo */}
        <div className="p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'login' || mode === 'select' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {/* Mensagens */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle size={18} />
              {success}
            </div>
          )}

          {/* ===== FORMULÁRIO DE LOGIN ===== */}
          {(mode === 'login' || mode === 'select') && (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Toggle Login/Select */}
              <div className="flex gap-2 mb-4">
                <button 
                  type="button" 
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 text-xs rounded transition-colors ${
                    mode === 'login' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Login com Email
                </button>
                <button 
                  type="button" 
                  onClick={() => setMode('select')}
                  className={`flex-1 py-2 text-xs rounded transition-colors ${
                    mode === 'select' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Selecionar Nome
                </button>
              </div>

              {mode === 'login' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="email" 
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="seu@email.com" 
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <select 
                      value={loginData.nome}
                      onChange={(e) => setLoginData({ ...loginData, nome: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">Selecione seu nome...</option>
                      {cotistas.map((c) => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  {cotistas.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">Nenhum cotista cadastrado ainda.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Sua senha" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <p className="text-center text-gray-500 text-sm">
                Não tem cadastro?{' '}
                <button 
                  type="button" 
                  onClick={() => { setMode('register'); setError(''); }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Cadastre-se
                </button>
              </p>
            </form>
          )}

          {/* ===== FORMULÁRIO DE CADASTRO ===== */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="text" 
                    value={registerData.nome}
                    onChange={(e) => setRegisterData({ ...registerData, nome: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Seu nome completo" 
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use nome e sobrenome para evitar duplicidade
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="email" 
                    value={registerData.email}
                    onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="seu@email.com" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Cotas <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type="number" 
                    min="1" 
                    max="50" 
                    value={registerData.cotas}
                    onChange={(e) => setRegisterData({ ...registerData, cotas: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Digite o número de cotas"
                  />
                </div>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg text-xs">
                  <div className="flex justify-between text-blue-600">
                    <span>Valor por cota:</span>
                    <span className="font-medium">{formatCurrency(CONFIG.VALOR_POR_COTA)}/mês</span>
                  </div>
                  <div className="flex justify-between text-blue-600 mt-1">
                    <span>Sua mensalidade:</span>
                    <span className="font-medium">{formatCurrency(valorMensalidade)}/mês</span>
                  </div>
                  <div className="flex justify-between text-blue-700 mt-1 pt-1 border-t border-blue-200">
                    <span className="font-semibold">Total (11 meses):</span>
                    <span className="font-bold">{formatCurrency(valorTotal)}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type={showRegisterPassword ? "text" : "password"} 
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Mínimo 6 caracteres" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showRegisterPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Senha <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input 
                    type={showRegisterPassword ? "text" : "password"} 
                    value={registerData.confirmPassword}
                    onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Repita a senha" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                {loading ? 'Cadastrando...' : 'Criar Conta'}
              </button>

              <p className="text-center text-gray-500 text-sm">
                Já tem cadastro?{' '}
                <button 
                  type="button" 
                  onClick={() => { setMode('login'); setError(''); }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Faça login
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;
