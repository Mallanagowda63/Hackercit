require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');
const prisma = require('./prismaClient');
const { executeSubmissionDirect } = require('./lib/executionService');
const {
  checkExecutionQueueHealth,
  registerExecutionProcessor,
} = require('./lib/executionQueue');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(cors());
app.use(pinoHttp({ logger }));

const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notification');
const problemRoutes = require('./routes/problem');
const runRoutes = require('./routes/run');
const submissionRoutes = require('./routes/submission');
const testRoutes = require('./routes/test');

if (process.env.EXECUTION_QUEUE_PROCESS_IN_APP !== 'false') {
  const queueRegistration = registerExecutionProcessor(executeSubmissionDirect, { lazy: true });
  if (queueRegistration.started) {
    logger.info(
      {
        queue: queueRegistration.name,
        concurrency: queueRegistration.concurrency,
        redisUrl: queueRegistration.redisUrl,
      },
      'Execution queue processor registered in backend process',
    );
  } else if (queueRegistration.reason === 'disabled') {
    logger.warn('Execution queue processor not started because the queue is disabled');
  }
}

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/run', runRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/tests', testRoutes);

async function health(req, res) {
  const [queue, database] = await Promise.all([
    checkExecutionQueueHealth(),
    prisma.$ping()
      .then(() => ({ ok: true }))
      .catch((error) => ({ ok: false, error: error.message || 'Database health check failed.' })),
  ]);
  const ok = queue.ok && database.ok;

  return res.status(ok ? 200 : 503).json({
    ok,
    service: 'backend',
    database,
    queue,
  });
}

app.get('/health', health);
app.get('/api/health', health);

module.exports = { app, logger };
