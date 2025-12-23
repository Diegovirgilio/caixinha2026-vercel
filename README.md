# 🏦 Caixinha 2026 - Sistema de Gestão Financeira

Sistema completo de gestão de caixinha/consórcio com React + Supabase.

## 📁 Estrutura do Projeto

```
src/
├── components/
│   ├── ui/                    # Componentes reutilizáveis
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── Loading.jsx
│   │   └── Alert.jsx
│   ├── layout/                # Layout da aplicação
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── Footer.jsx
│   └── features/              # Componentes específicos
│       ├── ModalPix.jsx
│       ├── NotificationPanel.jsx
│       └── ChangePasswordModal.jsx
├── pages/
│   ├── LoginRegister.jsx      # Tela de login/cadastro
│   ├── Dashboard.jsx          # Dashboard admin
│   ├── UserArea.jsx           # Área do cotista
│   ├── Cotistas.jsx           # Gestão de cotistas
│   ├── Mensalidades.jsx       # Controle de mensalidades
│   ├── Emprestimos.jsx        # Gestão de empréstimos
│   ├── RifasCDI.jsx           # Rifas e CDI
│   ├── Relatorio.jsx          # Relatório final
│   └── Gerenciamento.jsx      # CRUD geral
├── services/
│   ├── supabase.js            # Cliente Supabase
│   ├── api.js                 # Funções de API
│   └── auth.js                # Autenticação
├── hooks/
│   ├── useAuth.js             # Hook de autenticação
│   ├── useCotistas.js         # Hook de cotistas
│   ├── useMensalidades.js     # Hook de mensalidades
│   └── useEmprestimos.js      # Hook de empréstimos
├── store/
│   └── useStore.js            # Estado global (Zustand)
├── utils/
│   ├── storage.js             # LocalStorage helpers
│   ├── formatters.js          # Formatação de valores
│   ├── validators.js          # Validações
│   └── constants.js           # Constantes
├── styles/
│   └── index.css              # Estilos globais
├── App.jsx                    # Componente principal
└── main.jsx                   # Entry point
```

## 🚀 Instalação

```bash
# Clonar/extrair o projeto
cd caixinha2026

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Supabase

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build
```

## ⚙️ Configuração do Supabase

1. Crie uma conta em https://supabase.com
2. Crie um novo projeto
3. Vá em Settings > API e copie:
   - Project URL
   - anon public key
4. Cole no arquivo `.env`
5. Execute o SQL do arquivo `database/schema.sql` no SQL Editor

## 🔧 Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_APP_NAME=Caixinha 2026
```

## 📚 Tecnologias

- **React 18** + Vite
- **Supabase** (PostgreSQL + Auth + Realtime)
- **TailwindCSS** (Styling)
- **Zustand** (Estado global)
- **Lucide React** (Ícones)
- **React Router** (Navegação)

## 🔐 Funcionalidades

- ✅ Login/Cadastro de cotistas
- ✅ Dashboard administrativo
- ✅ Área do usuário personalizada
- ✅ Controle de mensalidades
- ✅ Sistema de empréstimos com aprovação
- ✅ Gestão de rifas e CDI
- ✅ Relatório final com distribuição
- ✅ Notificações em tempo real
- ✅ Integração PIX

## 📝 Licença

MIT
