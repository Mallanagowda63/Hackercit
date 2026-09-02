require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');
const prisma = require('./prismaClient');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(cors());
app.use(pinoHttp({ logger }));

const authRoutes = require('./routes/auth');
const { ensureDefaultAdmin } = require('./controllers/authController');

ensureDefaultAdmin().catch((err) => console.error('Admin seed error:', err));
const notificationRoutes = require('./routes/notification');
const problemRoutes = require('./routes/problem');
const runRoutes = require('./routes/run');
const submissionRoutes = require('./routes/submission');
const testRoutes = require('./routes/test');
const reportsRoutes = require('./routes/reports');
const proctoringRoutes = require('./routes/proctoring');

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/run', runRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/admin/reports', reportsRoutes);
app.use('/api/proctoring', proctoringRoutes);

async function health(req, res) {
  const database = await prisma.$ping()
    .then(() => ({ ok: true }))
    .catch((error) => ({ ok: false, error: error.message || 'Database health check failed.' }));
  const ok = database.ok;

  return res.status(ok ? 200 : 503).json({
    ok,
    service: 'backend',
    database,
    execution: {
      mode: 'direct',
    },
  });
}

app.get('/health', health);
app.get('/api/health', health);

module.exports = { app, logger };
