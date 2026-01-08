// ==================== LOCAL STORAGE HELPERS ====================
// Usado como fallback quando Supabase não está disponível

const PREFIX = 'caixinha_';

export const storage = {
  KEYS: {
    COTISTAS: `${PREFIX}cotistas`,
    MENSALIDADES: `${PREFIX}mensalidades`,
    EMPRESTIMOS: `${PREFIX}emprestimos`,
    SOLICITACOES: `${PREFIX}solicitacoes`,
    RIFAS: `${PREFIX}rifas`,
    CDI: `${PREFIX}cdi`,
    USUARIO: `${PREFIX}usuario`,
    CONFIG: `${PREFIX}config`,
    THEME: `${PREFIX}theme`,
  },

  // Salvar dado
  save(key, data) {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`Erro ao salvar ${key}:`, error);
      return false;
    }
  },

  // Carregar dado
  load(key, defaultValue = null) {
    try {
      const serialized = localStorage.getItem(key);
      if (serialized === null) return defaultValue;
      return JSON.parse(serialized);
    } catch (error) {
      console.error(`Erro ao carregar ${key}:`, error);
      return defaultValue;
    }
  },

  // Remover dado
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Erro ao remover ${key}:`, error);
      return false;
    }
  },

  // Limpar todos os dados da aplicação
  clear() {
    try {
      Object.values(this.KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Erro ao limpar storage:', error);
      return false;
    }
  },

  // Verificar se existe
  exists(key) {
    return localStorage.getItem(key) !== null;
  },

  // Obter tamanho usado
  getSize() {
    let total = 0;
    Object.values(this.KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        total += item.length * 2; // UTF-16 = 2 bytes por caractere
      }
    });
    return {
      bytes: total,
      kb: (total / 1024).toFixed(2),
      mb: (total / (1024 * 1024)).toFixed(4)
    };
  },

  // Exportar todos os dados
  exportAll() {
    const data = {};
    Object.entries(this.KEYS).forEach(([name, key]) => {
      const value = this.load(key);
      if (value !== null) {
        data[name] = value;
      }
    });
    return data;
  },

  // Importar dados
  importAll(data) {
    Object.entries(data).forEach(([name, value]) => {
      const key = this.KEYS[name];
      if (key) {
        this.save(key, value);
      }
    });
  }
};

// ==================== SESSION STORAGE HELPERS ====================
export const session = {
  save(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  load(key, defaultValue = null) {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  remove(key) {
    sessionStorage.removeItem(key);
  },

  clear() {
    sessionStorage.clear();
  }
};

export default storage;
