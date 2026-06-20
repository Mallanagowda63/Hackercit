require('dotenv').config({ override: true });

const { executeSubmissionDirect } = require('./lib/executionService');
const {
  checkExecutionQueueHealth,
  closeExecutionQueue,
  registerExecutionProcessor,
} = require('./lib/executionQueue');

async function start() {
  const registration = registerExecutionProcessor(executeSubmissionDirect, { lazy: true });

  if (!registration.started) {
    if (registration.reason === 'disabled') {
      console.warn('Execution worker not started because EXECUTION_QUEUE_ENABLED disables the queue.');
      process.exit(0);
    }

    console.warn(`Execution worker not started: ${registration.reason || 'unknown reason'}.`);
    return;
  }

  const health = await checkExecutionQueueHealth();
  if (health.degraded && health.transport === 'local') {
    console.warn('Redis is unavailable, so the dedicated Bull worker is not needed. The backend will use its local in-process queue.');
    process.exit(0);
  }

  if (!health.ok) {
    console.error(`Execution worker could not connect to Redis: ${health.error || 'queue health check failed'}`);
    process.exit(1);
  }

  console.log(
    `Execution worker listening on queue "${registration.name}" with concurrency ${registration.concurrency}.`,
  );
}

async function shutdown() {
  try {
    await closeExecutionQueue();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(async (error) => {
  console.error('Execution worker failed to start:', error.message);
  await closeExecutionQueue();
  process.exit(1);
});
