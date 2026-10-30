require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const { init } = require('./db');
const { syncAllOrderTotals } = require('./lib/order-totals');
const { authenticate } = require('./middleware/auth');
const remoteStore = require('./lib/remote-store');

const authRoutes = require('./routes/auth');
const customersRoutes = require('./routes/customers');
const itemsRoutes = require('./routes/items');
const servicesRoutes = require('./routes/services');
const ordersRoutes = require('./routes/orders');
const configRoutes = require('./routes/config');
const whatsappRoutes = require('./routes/whatsapp');
const brandingRoutes = require('./routes/branding');

const { UPLOADS_DIR, SEED_UPLOADS_DIR, DB_PATH } = require('./lib/paths');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

// Garante a pasta de uploads antes do multer ser usado
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Primeira execução em disco persistente: copia os uploads empacotados (logo etc.)
if (UPLOADS_DIR !== SEED_UPLOADS_DIR && fs.existsSync(SEED_UPLOADS_DIR)) {
  for (const entry of fs.readdirSync(SEED_UPLOADS_DIR)) {
    const source = path.join(SEED_UPLOADS_DIR, entry);
    const target = path.join(UPLOADS_DIR, entry);
    if (!fs.existsSync(target) && fs.statSync(source).isFile()) {
      fs.copyFileSync(source, target);
    }
  }
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos de upload (fotos/vídeos/logo)
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'it-service-app', timestamp: new Date().toISOString() });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/customers', authenticate, customersRoutes);
app.use('/api/items', authenticate, itemsRoutes);
app.use('/api/services', authenticate, servicesRoutes);
app.use('/api/orders', authenticate, ordersRoutes);
app.use('/api/config', authenticate, configRoutes);
// Identidade visual pública (login / rastreamento), sem exigir login
app.use('/api/branding', brandingRoutes);
// O rastreamento público da OS não exige login; as demais rotas aplicam auth internamente
app.use('/api/whatsapp', whatsappRoutes);

// Frontend compilado (se existir)
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// 404 em JSON para a API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratamento de erros (inclui erros do multer) sempre em JSON
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Erro interno do servidor' });
});

// Restaura o backup remoto (se configurado) e inicializa o banco antes de aceitar requisições
remoteStore
  .restore()
  .catch((err) => {
    // Sem restauração confiável não sobrescrevemos o backup remoto
    console.error('⚠️  Falha ao restaurar backup remoto:', err.message);
  })
  .then(() => init())
  .then(() => {
    // Recalcula os totais das OS (linhas riscadas deixam de ser cobradas)
    const synced = syncAllOrderTotals();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📁 Banco de dados: ${DB_PATH}`);
      console.log(`🖼️  Uploads: ${UPLOADS_DIR}`);
      console.log(`🌐 Acesse: http://localhost:${PORT}`);
      console.log(`🧾 Totais recalculados em ${synced} OS`);
      if (remoteStore.enabled()) {
        console.log('☁️  Backup automático no GitHub ativado.');
      }
      if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        console.warn('⚠️  JWT_SECRET não definido: usando o segredo padrão (inseguro em produção)!');
      }
    });
  })
  .catch((err) => {
    console.error('❌ Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });

if (remoteStore.enabled()) {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      remoteStore.shutdown().finally(() => process.exit(0));
    });
  }
}

module.exports = app;
