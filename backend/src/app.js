require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');

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

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/run', runRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/tests', testRoutes);

app.get('/health', (req, res) => res.json({ ok: true, service: 'backend' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'backend' }));

module.exports = { app, logger };
