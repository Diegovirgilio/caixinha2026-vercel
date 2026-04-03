// ==================== GERADOR PIX COPIA E COLA ====================
// Padrão EMV/BRCode — compatível com todos os bancos brasileiros
// Gera string PIX estática com valor embutido (sem API externa)

/**
 * Calcula CRC16-CCITT (padrão PIX/EMV)
 */
const crc16ccitt = (str) => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Monta um campo TLV (Tag-Length-Value) do padrão EMV
 */
const tlv = (tag, value) => {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
};

/**
 * Gera a string PIX Copia e Cola (BRCode)
 * 
 * @param {Object} params
 * @param {string} params.chave - Chave PIX (email, cpf, telefone, aleatória)
 * @param {string} params.nome - Nome do recebedor (máx 25 chars)
 * @param {string} params.cidade - Cidade do recebedor (máx 15 chars)
 * @param {number} params.valor - Valor em reais (ex: 50.00)
 * @param {string} [params.txid] - ID da transação (opcional, máx 25 chars)
 * @returns {string} - String PIX Copia e Cola pronta para uso
 */
export const gerarPixCopiaCola = ({ chave, nome, cidade, valor, txid = '***' }) => {
  // Sanitizar inputs
  const nomeLimpo = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .substring(0, 25);
  const cidadeLimpa = cidade
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .substring(0, 15);
  const valorStr = valor.toFixed(2);
  const txidLimpo = txid.substring(0, 25);

  // Determinar tipo da chave para GUI do Merchant Account
  // 00 = chave PIX (domínio)
  // 01 = chave do recebedor
  const gui = 'br.gov.bcb.pix';
  const merchantAccountInfo = tlv('00', gui) + tlv('01', chave);

  // Montar payload
  let payload = '';
  payload += tlv('00', '01');                          // Payload Format Indicator
  payload += tlv('01', '12');                          // Point of Initiation (12 = estático)
  payload += tlv('26', merchantAccountInfo);           // Merchant Account Info
  payload += tlv('52', '0000');                        // Merchant Category Code
  payload += tlv('53', '986');                         // Transaction Currency (BRL = 986)
  
  if (valor > 0) {
    payload += tlv('54', valorStr);                    // Transaction Amount
  }
  
  payload += tlv('58', 'BR');                          // Country Code
  payload += tlv('59', nomeLimpo);                     // Merchant Name
  payload += tlv('60', cidadeLimpa);                   // Merchant City
  payload += tlv('62', tlv('05', txidLimpo));          // Additional Data (TxID)
  
  // CRC16 — precisa incluir o tag "6304" antes de calcular
  payload += '6304';
  const crc = crc16ccitt(payload);
  payload += crc;

  return payload;
};

/**
 * Gera dados do PIX para uma mensalidade
 */
export const gerarPixMensalidade = ({ configuracoes, cotista, mesReferencia, valorTotal }) => {
  const chave = configuracoes?.pix_chave || '';
  const nome = configuracoes?.pix_nome || 'Caixinha 2026';
  const cidade = configuracoes?.pix_cidade || 'Rio de Janeiro';
  
  if (!chave) return null;

  // TxID: identificador para rastreio (MENS + iniciais + mês)
  const iniciais = (cotista?.nome || 'XX').substring(0, 3).toUpperCase();
  const mesNum = mesReferencia ? mesReferencia.replace('-', '') : '';
  const txid = `CX${iniciais}${mesNum}`;

  return gerarPixCopiaCola({
    chave,
    nome,
    cidade,
    valor: valorTotal,
    txid
  });
};

/**
 * Gera dados do PIX para um empréstimo
 */
export const gerarPixEmprestimo = ({ configuracoes, cotista, emprestimoId, valorTotal }) => {
  const chave = configuracoes?.pix_chave || '';
  const nome = configuracoes?.pix_nome || 'Caixinha 2026';
  const cidade = configuracoes?.pix_cidade || 'Rio de Janeiro';
  
  if (!chave) return null;

  const iniciais = (cotista?.nome || 'XX').substring(0, 3).toUpperCase();
  const idCurto = (emprestimoId || '').substring(0, 6);
  const txid = `CX${iniciais}E${idCurto}`;

  return gerarPixCopiaCola({
    chave,
    nome,
    cidade,
    valor: valorTotal,
    txid
  });
};

export default { gerarPixCopiaCola, gerarPixMensalidade, gerarPixEmprestimo };
