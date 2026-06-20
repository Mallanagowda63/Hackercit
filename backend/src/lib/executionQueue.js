const Queue = require('bull');
const net = require('net');
const tls = require('tls');

const DISABLED_VALUES = new Set(['0', 'false', 'off', 'disabled', 'no']);
const ENABLED_VALUES = new Set(['1', 'true', 'on', 'enabled', 'yes']);
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';

const EXECUTION_QUEUE_NAME = process.env.EXECUTION_QUEUE_NAME || 'exec';
const REDIS_URL = process.env.REDIS_URL || DEFAULT_REDIS_URL;

let executionQueue = null;
let processorRegistered = false;
let localProcessor = null;
let localActiveCount = 0;
const localPendingJobs = [];
let fallbackWarningLogged = false;
let redisProbePromise = null;
let redisProbeResult = null;
let redisProbeCheckedAt = 0;

function readPositiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isDisabled(value) {
  return DISABLED_VALUES.has(String(value || '').trim().toLowerCase());
}

function isExecutionQueueEnabled() {
  return !isDisabled(process.env.EXECUTION_QUEUE_ENABLED);
}

function isLocalFallbackEnabled() {
  const configured = String(process.env.EXECUTION_QUEUE_LOCAL_FALLBACK || '').trim().toLowerCase();
  if (ENABLED_VALUES.has(configured)) return true;
  if (DISABLED_VALUES.has(configured)) return false;

  return process.env.NODE_ENV !== 'production';
}

function isDirectFallbackEnabled() {
  const configured = String(process.env.EXECUTION_QUEUE_DIRECT_FALLBACK || '').trim().toLowerCase();
  if (ENABLED_VALUES.has(configured)) return true;
  if (DISABLED_VALUES.has(configured)) return false;

  return process.env.NODE_ENV !== 'production';
}

function redactRedisUrl(value) {
  try {
    const url = new URL(value);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return value ? 'configured' : 'not configured';
  }
}

function makeQueueError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function withTimeout(promise, timeoutMs, message, statusCode = 503) {
  let timer = null;
  let didFinish = false;

  const guardedPromise = Promise.resolve(promise).catch((error) => {
    if (didFinish) {
      return new Promise(() => {});
    }

    throw error;
  });

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(makeQueueError(message, statusCode)), timeoutMs);
  });

  return Promise.race([guardedPromise, timeout]).finally(() => {
    didFinish = true;
    if (timer) clearTimeout(timer);
  });
}

function getLimiterConfig() {
  const max = readPositiveNumber('EXECUTION_QUEUE_RATE_LIMIT_MAX', 0);
  const duration = readPositiveNumber('EXECUTION_QUEUE_RATE_LIMIT_DURATION_MS', 60000);

  return max > 0 ? { max, duration } : null;
}

function getJobPriority(options = {}) {
  const priority = Number(options.priority);
  return Number.isInteger(priority) && priority > 0 ? priority : undefined;
}

function parseRedisSocketOptions() {
  try {
    const url = new URL(REDIS_URL);
    return {
      host: url.hostname || '127.0.0.1',
      port: Number(url.port || 6379),
      secure: url.protocol === 'rediss:',
    };
  } catch {
    return null;
  }
}

function probeRedisConnection(timeoutMs) {
  const options = parseRedisSocketOptions();
  if (!options || !Number.isFinite(options.port)) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const socket = options.secure
      ? tls.connect({ host: options.host, port: options.port, servername: options.host })
      : net.connect({ host: options.host, port: options.port });

    const finish = (available) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };

    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('secureConnect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function isRedisReachableForFallback() {
  const ttlMs = readPositiveNumber('EXECUTION_QUEUE_REDIS_PRECHECK_TTL_MS', 5000);
  const now = Date.now();

  if (redisProbeResult !== null && now - redisProbeCheckedAt < ttlMs) {
    return redisProbeResult;
  }

  if (!redisProbePromise) {
    const timeoutMs = readPositiveNumber('EXECUTION_QUEUE_REDIS_PRECHECK_TIMEOUT_MS', 300);
    redisProbePromise = probeRedisConnection(timeoutMs)
      .then((available) => {
        redisProbeResult = available;
        redisProbeCheckedAt = Date.now();
        return available;
      })
      .finally(() => {
        redisProbePromise = null;
      });
  }

  return redisProbePromise;
}

function buildQueueOptions() {
  const limiter = getLimiterConfig();

  return {
    ...(limiter ? { limiter } : {}),
    defaultJobOptions: {
      attempts: readPositiveNumber('EXECUTION_QUEUE_ATTEMPTS', 1),
      backoff: {
        type: 'exponential',
        delay: readPositiveNumber('EXECUTION_QUEUE_BACKOFF_MS', 1000),
      },
      removeOnComplete: readPositiveNumber('EXECUTION_QUEUE_KEEP_COMPLETED', 1000),
      removeOnFail: readPositiveNumber('EXECUTION_QUEUE_KEEP_FAILED', 5000),
      timeout: readPositiveNumber('EXECUTION_QUEUE_JOB_TIMEOUT_MS', 60000),
    },
    settings: {
      lockDuration: readPositiveNumber('EXECUTION_QUEUE_LOCK_MS', 120000),
      stalledInterval: readPositiveNumber('EXECUTION_QUEUE_STALLED_INTERVAL_MS', 30000),
      maxStalledCount: readPositiveNumber('EXECUTION_QUEUE_MAX_STALLED_COUNT', 1),
    },
  };
}

function getExecutionQueue() {
  if (!isExecutionQueueEnabled()) {
    throw makeQueueError('Execution queue is disabled by EXECUTION_QUEUE_ENABLED.', 503);
  }

  if (!executionQueue) {
    executionQueue = new Queue(EXECUTION_QUEUE_NAME, REDIS_URL, buildQueueOptions());
    executionQueue.on('error', (error) => {
      console.error('Execution queue error:', error.message);
    });
  }

  return executionQueue;
}

function getExecutionQueueConfig() {
  return {
    enabled: isExecutionQueueEnabled(),
    name: EXECUTION_QUEUE_NAME,
    redisUrl: redactRedisUrl(REDIS_URL),
    concurrency: readPositiveNumber('EXECUTION_QUEUE_CONCURRENCY', 2),
    processorRegistered,
    resultTimeoutMs: readPositiveNumber('EXECUTION_QUEUE_RESULT_TIMEOUT_MS', 70000),
    jobTimeoutMs: readPositiveNumber('EXECUTION_QUEUE_JOB_TIMEOUT_MS', 60000),
    rateLimit: getLimiterConfig(),
    localFallback: {
      enabled: isLocalFallbackEnabled(),
      processorRegistered: Boolean(localProcessor),
      active: localActiveCount,
      waiting: localPendingJobs.length,
    },
  };
}

function canUseLocalFallback() {
  return isLocalFallbackEnabled() && typeof localProcessor === 'function';
}

function drainLocalQueue() {
  const concurrency = readPositiveNumber('EXECUTION_QUEUE_CONCURRENCY', 2);

  while (localActiveCount < concurrency && localPendingJobs.length) {
    const job = localPendingJobs.shift();
    localActiveCount += 1;

    Promise.resolve()
      .then(() => localProcessor(job.payload))
      .then(job.resolve, job.reject)
      .finally(() => {
        localActiveCount -= 1;
        drainLocalQueue();
      });
  }
}

function enqueueLocalExecution(payload) {
  if (!canUseLocalFallback()) {
    throw makeQueueError('Execution queue is unavailable and no local execution processor is registered.', 503);
  }

  return new Promise((resolve, reject) => {
    localPendingJobs.push({ payload, resolve, reject });
    drainLocalQueue();
  });
}

function warnOnceAboutFallback(reason) {
  if (fallbackWarningLogged) return;

  fallbackWarningLogged = true;
  console.warn(`Execution queue unavailable (${reason}). Using local in-process execution queue.`);
}

function ensureBullProcessor() {
  if (processorRegistered) return;

  if (typeof localProcessor !== 'function') {
    throw makeQueueError('Execution queue processor is not registered.', 503);
  }

  const queue = getExecutionQueue();
  const concurrency = readPositiveNumber('EXECUTION_QUEUE_CONCURRENCY', 2);

  queue.process(concurrency, async (job) => {
    const payload = job.data && Object.prototype.hasOwnProperty.call(job.data, 'payload')
      ? job.data.payload
      : job.data;

    return localProcessor(payload);
  });

  processorRegistered = true;
}

async function enqueueExecution(payload, options = {}) {
  const enqueueTimeoutMs = readPositiveNumber('EXECUTION_QUEUE_ENQUEUE_TIMEOUT_MS', 5000);
  const resultTimeoutMs = readPositiveNumber('EXECUTION_QUEUE_RESULT_TIMEOUT_MS', 70000);
  const priority = getJobPriority(options);
  let job = null;

  if (canUseLocalFallback() && !(await isRedisReachableForFallback())) {
    warnOnceAboutFallback(`Redis is not reachable at ${redactRedisUrl(REDIS_URL)}`);
    return enqueueLocalExecution(payload);
  }

  if (localProcessor && !processorRegistered) {
    ensureBullProcessor();
  }

  const queue = getExecutionQueue();

  try {
    job = await withTimeout(
      queue.add({ payload }, priority ? { priority } : {}),
      enqueueTimeoutMs,
      'Execution queue is unavailable. Check Redis and the execution worker.',
      503,
    );

    return await withTimeout(
      job.finished(),
      resultTimeoutMs,
      'Execution queue timed out while waiting for a worker result.',
      504,
    );
  } catch (error) {
    if (job && error.statusCode === 504) {
      job.remove().catch(() => {});
    }

    if (canUseLocalFallback()) {
      warnOnceAboutFallback(error.message);
      return enqueueLocalExecution(payload);
    }

    if (!error.statusCode) {
      error.statusCode = 502;
    }

    throw error;
  }
}

function registerExecutionProcessor(processor, options = {}) {
  if (!isExecutionQueueEnabled()) {
    return {
      started: false,
      reason: 'disabled',
      ...getExecutionQueueConfig(),
    };
  }

  localProcessor = processor;

  if (processorRegistered) {
    return {
      started: false,
      reason: 'already registered',
      ...getExecutionQueueConfig(),
    };
  }

  if (!options.lazy) {
    ensureBullProcessor();
  }

  return {
    started: true,
    ...getExecutionQueueConfig(),
  };
}

async function checkExecutionQueueHealth() {
  const config = getExecutionQueueConfig();

  if (!config.enabled) {
    return {
      ok: false,
      ...config,
      error: 'Execution queue is disabled.',
    };
  }

  try {
    if (canUseLocalFallback() && !(await isRedisReachableForFallback())) {
      return {
        ok: true,
        degraded: true,
        ...config,
        transport: 'local',
        error: `Redis/Bull unavailable; using local in-process queue. Redis is not reachable at ${config.redisUrl}.`,
      };
    }

    if (localProcessor && !processorRegistered) {
      ensureBullProcessor();
    }

    const queue = getExecutionQueue();
    const pingTimeoutMs = readPositiveNumber('EXECUTION_QUEUE_HEALTH_TIMEOUT_MS', 2000);
    await withTimeout(queue.client.ping(), pingTimeoutMs, 'Redis ping timed out.');
    const counts = await withTimeout(
      queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      pingTimeoutMs,
      'Unable to read execution queue counts.',
    );

    return {
      ok: true,
      ...config,
      counts,
    };
  } catch (error) {
    if (canUseLocalFallback()) {
      return {
        ok: true,
        degraded: true,
        ...config,
        transport: 'local',
        error: `Redis/Bull unavailable; using local in-process queue. ${error.message || ''}`.trim(),
      };
    }

    return {
      ok: false,
      ...config,
      error: error.message || 'Execution queue health check failed.',
    };
  }
}

async function closeExecutionQueue() {
  const queue = executionQueue;
  executionQueue = null;
  processorRegistered = false;
  localProcessor = null;
  localPendingJobs.length = 0;
  localActiveCount = 0;

  if (queue) {
    await queue.close();
  }
}

module.exports = {
  checkExecutionQueueHealth,
  closeExecutionQueue,
  enqueueExecution,
  getExecutionQueue,
  getExecutionQueueConfig,
  isExecutionQueueEnabled,
  isLocalFallbackEnabled,
  isDirectFallbackEnabled,
  registerExecutionProcessor,
};
