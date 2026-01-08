// ==================== FORMATADORES ====================

// Formatar valor em Reais
export const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatar número
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '0';
  
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

// Formatar percentual
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined) return '0%';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
};

// Formatar data
export const formatDate = (date, format = 'short') => {
  if (!date) return '-';
  
  const d = new Date(date);
  
  const formats = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    month: { month: 'long', year: 'numeric' },
    monthShort: { month: '2-digit', year: 'numeric' }
  };

  return new Intl.DateTimeFormat('pt-BR', formats[format] || formats.short).format(d);
};

// Formatar mês de referência (MM/YYYY)
export const formatMesReferencia = (mes) => {
  if (!mes) return '-';
  
  const [month, year] = mes.split('/');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  return `${meses[parseInt(month) - 1]} de ${year}`;
};

// Formatar telefone
export const formatPhone = (phone) => {
  if (!phone) return '-';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

// Formatar CPF
export const formatCPF = (cpf) => {
  if (!cpf) return '-';
  
  const cleaned = cpf.replace(/\D/g, '');
  
  if (cleaned.length !== 11) return cpf;
  
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
};

// Abreviar nome
export const abbreviateName = (name, maxLength = 20) => {
  if (!name) return '-';
  if (name.length <= maxLength) return name;
  
  const parts = name.split(' ');
  if (parts.length === 1) return name.slice(0, maxLength) + '...';
  
  // Manter primeiro e último nome
  const first = parts[0];
  const last = parts[parts.length - 1];
  
  if (`${first} ${last}`.length <= maxLength) {
    return `${first} ${last}`;
  }
  
  return `${first.charAt(0)}. ${last}`;
};

// Obter iniciais do nome
export const getInitials = (name, count = 2) => {
  if (!name) return '?';
  
  return name
    .split(' ')
    .slice(0, count)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
};

// Pluralizar
export const pluralize = (count, singular, plural) => {
  return count === 1 ? singular : plural;
};

// Tempo relativo
export const timeAgo = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} ${pluralize(diffMins, 'minuto', 'minutos')}`;
  if (diffHours < 24) return `há ${diffHours} ${pluralize(diffHours, 'hora', 'horas')}`;
  if (diffDays < 7) return `há ${diffDays} ${pluralize(diffDays, 'dia', 'dias')}`;
  
  return formatDate(date, 'short');
};

export default {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
  formatMesReferencia,
  formatPhone,
  formatCPF,
  abbreviateName,
  getInitials,
  pluralize,
  timeAgo
};
