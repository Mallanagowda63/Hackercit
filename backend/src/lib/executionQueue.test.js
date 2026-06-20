const assert = require('node:assert/strict');
const test = require('node:test');

class FakeQueue {
  static instances = [];

  constructor() {
    this.client = { ping: async () => 'PONG' };
    this.processor = null;
    this.added = [];
    FakeQueue.instances.push(this);
  }

  on() {}

  process(concurrency, processor) {
    this.concurrency = concurrency;
    this.processor = processor;
  }

  async add(data, options) {
    this.added.push({ data, options });
    return {
      finished: async () => ({ accepted: true }),
      remove: async () => {},
    };
  }

  async getJobCounts() {
    return { waiting: 0, active: 0, delayed: 0, failed: 0 };
  }

  async close() {}
}

function loadQueueModule() {
  const bullPath = require.resolve('bull');
  const queuePath = require.resolve('./executionQueue');

  delete require.cache[queuePath];
  require.cache[bullPath] = {
    id: bullPath,
    filename: bullPath,
    loaded: true,
    exports: FakeQueue,
    children: [],
    paths: [],
  };

  return require('./executionQueue');
}

test.beforeEach(() => {
  FakeQueue.instances = [];
  process.env.EXECUTION_QUEUE_ENABLED = 'true';
  process.env.EXECUTION_QUEUE_LOCAL_FALLBACK = 'false';
  process.env.REDIS_URL = 'redis://queue.test:6379';
});

test('producer-only mode enqueues without registering a processor', async () => {
  const queue = loadQueueModule();
  const result = await queue.enqueueExecution({ sourceCode: 'return 1;' }, { priority: 10 });
  const instance = FakeQueue.instances[0];

  assert.deepEqual(result, { accepted: true });
  assert.equal(instance.processor, null);
  assert.equal(instance.added[0].options.priority, 10);
  await queue.closeExecutionQueue();
});

test('registered worker processes wrapped payloads at configured concurrency', async () => {
  process.env.EXECUTION_QUEUE_CONCURRENCY = '10';
  const queue = loadQueueModule();

  queue.registerExecutionProcessor(async (payload) => payload.value * 2);
  const instance = FakeQueue.instances[0];

  assert.equal(instance.concurrency, 10);
  assert.equal(await instance.processor({ data: { payload: { value: 21 } } }), 42);
  await queue.closeExecutionQueue();
});

test('local fallback queues a burst of 100 jobs without exceeding concurrency', async () => {
  process.env.EXECUTION_QUEUE_CONCURRENCY = '10';
  process.env.EXECUTION_QUEUE_LOCAL_FALLBACK = 'true';
  process.env.EXECUTION_QUEUE_REDIS_PRECHECK_TIMEOUT_MS = '50';
  process.env.REDIS_URL = 'redis://127.0.0.1:6399';
  const queue = loadQueueModule();
  let active = 0;
  let maxActive = 0;

  queue.registerExecutionProcessor(async ({ value }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return value;
  }, { lazy: true });

  const results = await Promise.all(
    Array.from({ length: 100 }, (_, value) => queue.enqueueExecution({ value })),
  );

  assert.deepEqual(results, Array.from({ length: 100 }, (_, value) => value));
  assert.equal(maxActive, 10);
  await queue.closeExecutionQueue();
});
