// ==================== CONSTANTES DA APLICAÇÃO ====================

// Configurações fixas (não mudam)
export const CONFIG = {
  APP_NAME: 'Caixinha 2026',
  APP_VERSION: '2.0.0',
  
  // Período - meses fixos do ano (formato YYYY-MM)
  MESES: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', 
          '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
};

// Status das mensalidades
export const STATUS_MENSALIDADE = {
  PENDENTE: 'pendente',
  PARCIAL: 'parcial',
  PAGO: 'pago',
  ATRASADO: 'atrasado'
};

export const STATUS_MENSALIDADE_LABELS = {
  [STATUS_MENSALIDADE.PENDENTE]: 'Pendente',
  [STATUS_MENSALIDADE.PARCIAL]: 'Parcial',
  [STATUS_MENSALIDADE.PAGO]: 'Pago',
  [STATUS_MENSALIDADE.ATRASADO]: 'Atrasado'
};

export const STATUS_MENSALIDADE_COLORS = {
  [STATUS_MENSALIDADE.PENDENTE]: 'bg-yellow-100 text-yellow-800',
  [STATUS_MENSALIDADE.PARCIAL]: 'bg-orange-100 text-orange-800',
  [STATUS_MENSALIDADE.PAGO]: 'bg-green-100 text-green-800',
  [STATUS_MENSALIDADE.ATRASADO]: 'bg-red-100 text-red-800'
};

// Status dos empréstimos
export const STATUS_EMPRESTIMO = {
  PENDENTE: 'pendente',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
  ATIVO: 'ativo',
  PAGO: 'pago',
  CANCELADO: 'cancelado'
};

export const STATUS_EMPRESTIMO_LABELS = {
  [STATUS_EMPRESTIMO.PENDENTE]: 'Aguardando Aprovação',
  [STATUS_EMPRESTIMO.APROVADO]: 'Aprovado',
  [STATUS_EMPRESTIMO.REJEITADO]: 'Rejeitado',
  [STATUS_EMPRESTIMO.ATIVO]: 'Em Aberto',
  [STATUS_EMPRESTIMO.PAGO]: 'Quitado',
  [STATUS_EMPRESTIMO.CANCELADO]: 'Cancelado'
};

export const STATUS_EMPRESTIMO_COLORS = {
  [STATUS_EMPRESTIMO.PENDENTE]: 'bg-yellow-100 text-yellow-800',
  [STATUS_EMPRESTIMO.APROVADO]: 'bg-blue-100 text-blue-800',
  [STATUS_EMPRESTIMO.REJEITADO]: 'bg-red-100 text-red-800',
  [STATUS_EMPRESTIMO.ATIVO]: 'bg-orange-100 text-orange-800',
  [STATUS_EMPRESTIMO.PAGO]: 'bg-green-100 text-green-800',
  [STATUS_EMPRESTIMO.CANCELADO]: 'bg-gray-100 text-gray-800'
};

// Tipos de empréstimo
export const TIPO_EMPRESTIMO = {
  VISTA: 'vista',
  PARCELADO: 'parcelado'
};

export const TIPO_EMPRESTIMO_LABELS = {
  [TIPO_EMPRESTIMO.VISTA]: 'À Vista',
  [TIPO_EMPRESTIMO.PARCELADO]: 'Parcelado'
};

// Meses por extenso
export const MESES_EXTENSO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Cores para gráficos
export const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

// Mensagens de erro comuns
export const ERROR_MESSAGES = {
  GENERIC: 'Ocorreu um erro. Tente novamente.',
  NETWORK: 'Erro de conexão. Verifique sua internet.',
  UNAUTHORIZED: 'Sessão expirada. Faça login novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  NOT_FOUND: 'Registro não encontrado.',
  VALIDATION: 'Verifique os dados informados.'
};

// Mensagens de sucesso
export const SUCCESS_MESSAGES = {
  SAVED: 'Dados salvos com sucesso!',
  DELETED: 'Registro excluído com sucesso!',
  UPDATED: 'Dados atualizados com sucesso!',
  PASSWORD_CHANGED: 'Senha alterada com sucesso!'
};

export default CONFIG;
