# 🛠️ App de Atendimento para Técnico em Informática

Aplicação web completa para técnicos de informática que atendem pequenas e médias empresas (PMEs) sem setor de TI. Funciona em PC, celular e tablet (design responsivo e PWA-ready).

> 🚀 **Deploy no Render:** instruções completas em [DEPLOY-RENDER.md](./DEPLOY-RENDER.md).

## 📋 Funcionalidades

- **Cadastro de clientes** (tabela separada)
- **Catálogo de itens/equipamentos** (rede, servidor, computador, câmera IP, NVR, sistema) — tabela separada
- **Catálogo de serviços** — tabela separada
- **Ordens de Serviço (OS)** com:
  - Relatório de pane/falha/defeito pelo cliente via WhatsApp
  - Itens e serviços vinculados à OS
  - Opção de **riscar** itens/serviços não autorizados, já instalados ou já executados
  - Acompanhamento por **fotos e vídeos** (upload no serviço)
  - **Custo e despesa** internos por OS, com cálculo de lucro
  - **Impressão de orçamento/OS** em layout estilo DANFE (A4 / PDF)
- **CPF/CNPJ e CEP com preenchimento automático** (máscara, validação e consulta em ViaCEP/BrasilAPI)
- **WhatsApp**: envio de mensagens, link direto `wa.me`, histórico
- **Dashboard** com estatísticas (total de OS, por status, prioridade, receita, pagamentos pendentes)
- **Configurações extremamente completa**:
  - Alterar nome da empresa, moeda, idioma, formatos
  - Incluir logo da empresa
  - Mudar temas (escuro, claro, azul, verde, roxo)
  - Cores primária e secundária personalizáveis
  - Opções de comportamento do WhatsApp e uploads
- **Autenticação** de usuário (admin/admin123)

## 🏗️ Arquitetura

- **Backend**: Node.js + Express + SQLite (`sql.js`, SQLite compilado em WebAssembly — sem etapa de compilação nativa)
- **Frontend**: React + Vite + Tailwind CSS + React Router
- **Autenticação**: JWT (Bearer token)
- **Uploads**: Multer (fotos/vídeos) servidos estaticamente em `/uploads`

## 🚀 Como executar

### Pré-requisitos
- Node.js (v18+)
- npm

### 1. Backend

```bash
cd it-service-app/server
npm install
npm start
```

O servidor rodará em `http://localhost:3001`.

### 2. Frontend

```bash
cd it-service-app/client
npm install
npm run dev
```

A aplicação rodará em `http://localhost:5173`.

### 3. Produção (um único servidor na porta 3001)

```bash
cd it-service-app/client
npm install
npm run build      # gera client/dist

cd ../server
npm install
npm start          # serve a API e o frontend em http://localhost:3001
```

O backend detecta `client/dist` automaticamente e passa a servir o app compilado,
então em produção basta acessar `http://localhost:3001` (ou o IP do servidor na rede local).
Na primeira execução o banco é criado com o usuário `admin` e o catálogo de serviços.

### 4. Acessar

- Usuário padrão: `admin`
- Senha padrão: `admin123`

## 📱 Uso em celular (PWA)

O frontend inclui meta tags de PWA (`apple-mobile-web-app-capable`, `mobile-web-app-capable`). Você pode adicionar à tela inicial do celular para usar como app nativo.

## 📥 Importar dados de recibos (JSON)

Recibos/planilhas podem ser convertidos em cliente, itens, serviços e OS sem digitação manual:

```bash
cd it-service-app/server
node scripts/import-data.js imports/REC-2026-450.json
```

O JSON tem os blocos `customer`, `items[]`, `services[]` e `order` (opcional). A importação é **idempotente**:

- cliente casado por CNPJ (ou nome) → atualiza em vez de duplicar
- itens casados por cliente + nome
- serviços casados por nome
- OS casada por `order_number` (reimportar substitui as linhas de itens/serviços)

Os arquivos de importação ficam em `server/imports/` (pasta local, fora do repositório, pois contém dados de clientes).

> Pare o servidor antes de importar (`Ctrl+C`) e suba novamente depois: o banco fica em memória e é gravado no arquivo a cada escrita.

## 🗄️ Banco de dados

SQLite em `it-service-app/server/database.sqlite` (criado automaticamente na primeira execução com dados de exemplo).

## 📂 Estrutura

```
it-service-app/
├── server/               # Backend Node.js + Express
│   ├── server.js         # Entrada da API
│   ├── db.js             # SQLite + seed inicial
│   ├── middleware/auth.js
│   ├── routes/           # auth, customers, items, services, orders, config, whatsapp, branding
│   ├── scripts/          # import-data.js (importação de recibos em JSON)
│   ├── imports/          # arquivos JSON de importação
│   └── uploads/          # Fotos e vídeos enviados
└── client/               # Frontend React + Vite
    ├── src/
    │   ├── main.jsx
    │   ├── index.css     # Tailwind
    │   ├── App.jsx       # Roteamento
    │   ├── services/api.js
    │   ├── context/AuthContext.jsx
    │   ├── components/   # Navbar, ProtectedRoute
    │   └── pages/        # Login, Dashboard, Clientes, Itens, Servicos, Ordens, OrdemNova, OrdemDetalhe, Whatsapp, Configuracoes, Rastreamento
    └── ...
```

## 🔒 Segurança

- Senhas hasheadas com bcrypt
- Tokens JWT com expiração de 7 dias
- Middleware de autenticação em todas as rotas da API (exceto login e rastreamento público)
- Filtro de tipos de arquivo em uploads

---

Desenvolvido para técnicos de informática que prestam atendimento personalizado a PMEs sem setor de TI.
