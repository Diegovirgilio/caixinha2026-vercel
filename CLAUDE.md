# Caixinha 2026

App de gestão de uma caixinha (fundo coletivo de poupança e empréstimos entre cotistas).
Deploy automático na Vercel a partir da `main`.

## Stack

- React 18 + Vite 5, Tailwind CSS 3, lucide-react
- Estado global: Zustand (`src/store/useStore.js`)
- Backend: Supabase (Postgres + Auth + RLS), acessado direto do front
- Roteamento: react-router-dom 6
- Comandos: `npm run dev`, `npm run build`, `npm run lint`

## Estrutura real (o README está desatualizado)

- `src/pages/`: telas. Admin: Dashboard, Cotistas, Mensalidades, Emprestimos, Rifas, RifasCdi, Comprovantes, Relatorio, Gerenciamento, Auditoria, ExtratoCotista. Cotista: UserArea.
- `src/store/useStore.js`: estado e acesso ao Supabase.
- `src/services/`: `supabase.js`, `auth.js`, `api.js`, `telegram.js`.
- `src/utils/`: `formatters.js`, `pix.js` (QR Pix estático), `constants.js`, `storage.js`.
- `database/`: scripts SQL versionados. Não existem `components/` nem `hooks/`.

## Fluxo de trabalho

- Nunca commitar direto na `main`. Sempre branch + Pull Request.
- Nomes de branch: `fix/...`, `feat/...`, `docs/...`, `chore/...`.
- Mensagens de commit em português, curtas e no imperativo.
- O PR deve descrever o que mudou, o porquê e como testar.
- Mudança de banco vira um novo arquivo em `database/` com numeração sequencial (último: `v20_padronizar_mes_referencia.sql`; próximo: `v21_...`). O SQL é aplicado manualmente no Supabase pelo dono do projeto. Nunca editar scripts já aplicados.
- Antes de gerar código novo, apresentar a proposta e esperar aprovação. Depois, listar as mudanças feitas.
- Nunca commitar `.env`. As variáveis ficam no `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e na Vercel.

## Regras de negócio (não alterar sem confirmar)

**Formato de mês:** `mes_referencia` é sempre `YYYY-MM` (ex.: `2026-03`) em banco e front.

**Multa de mensalidade em atraso** (`UserArea.jsx`, `openComprovanteModal`): vence no último dia do mês de referência. Após isso: multa fixa de 20% do valor devido + 1% do valor devido por dia corrido de atraso. Se o cotista participa da rifa, soma R$ 20 por cota ao valor base.

**Empréstimo** (`UserArea.jsx`, `calcularJurosAtraso`, `calcularPagamentoEmprestimo`, `calcularTotalQuitacao`):
- Taxas vêm de `configuracoes`: `juros_vista` (padrão 20%, para quitação) e `juros_parcelado` (padrão 30%, para pagar só os juros).
- Juros de atraso incidem sobre o principal restante, sem juros sobre juros: +30% por cada vencimento mensal ultrapassado após o original, +1% por dia corrido desde o vencimento original.
- Quitação = principal + juros à vista + juros de atraso. Só juros = juros parcelado + juros de atraso.
- Datas devem ser interpretadas em horário local, para evitar bug de timezone.

**Limite de empréstimo** (`getLimiteEmprestimo`): `investido × percentual` menos os empréstimos ativos ou pendentes da mesma modalidade. Padrão: 80% (modalidade normal) e 100% (modalidade caixinha), configurável por cotista.

**Valor investido** (`getInvestidoByCotista`): soma de `valor_devido` (só a mensalidade) das mensalidades com status `pago` ou `parcial`. Não usar `valor_pago`, que mistura mensalidade e rifa. A mesma lógica vale em `ExtratoCotista.jsx`; as duas telas (admin e cotista) devem sempre mostrar o mesmo valor.

**Saldo** (`Relatorio.jsx`): mensalidades recebidas + rifas pagas + juros de empréstimos recebidos + juros de atraso + CDI − empréstimos ativos − prêmios de rifa pagos. Admins são excluídos dos cálculos (ver `database/verificar_calculos.sql`).

## Pendências conhecidas

- `src/services/telegram.js` tem token do bot e chat id escritos no código. Mover para variáveis de ambiente (`VITE_*` ou, melhor, uma Edge Function do Supabase) e revogar o token atual.
- Pagamento Pix é por QR estático: não há confirmação automática. Identificação automática exigiria PicPay Business API + webhook em Edge Function (adiado).
- O README descreve uma estrutura que não existe mais.
