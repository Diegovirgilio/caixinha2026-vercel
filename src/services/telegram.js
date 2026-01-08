// Serviço de notificação via Telegram

const TELEGRAM_BOT_TOKEN = '8408798026:AAHneAgNMg4T2qU3tEwpfyScdeLUv_GJex0';
const TELEGRAM_CHAT_ID = '766730992';

export const enviarAlertaTelegram = async (mensagem) => {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: 'HTML'
      })
    });
    
    console.log('Alerta Telegram enviado!');
  } catch (error) {
    console.error('Erro ao enviar alerta Telegram:', error);
  }
};

// Funções de alerta específicas
export const alertaNovoComprovante = async (cotistaNome, valor, tipo) => {
  const mensagem = `📄 <b>Novo Comprovante!</b>

👤 Cotista: <b>${cotistaNome}</b>
💰 Valor: <b>R$ ${valor.toFixed(2)}</b>
📝 Tipo: ${tipo === 'mensalidade' ? 'Mensalidade' : 'Empréstimo'}

🔗 Acesse o sistema para validar.`;

  await enviarAlertaTelegram(mensagem);
};

export const alertaNovoCadastro = async (cotistaNome, cotas) => {
  const mensagem = `🆕 <b>Novo Cadastro!</b>

👤 Nome: <b>${cotistaNome}</b>
🎫 Cotas: <b>${cotas}</b>

⏳ Aguardando sua aprovação.`;

  await enviarAlertaTelegram(mensagem);
};
