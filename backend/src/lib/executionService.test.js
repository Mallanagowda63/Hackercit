const assert = require('node:assert/strict');
const test = require('node:test');

test('execution health reports direct mode', async () => {
  const previousFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify([{ id: 63, name: 'JavaScript' }]),
  });

  try {
    const { checkExecutionHealth } = require('./executionService');
    const health = await checkExecutionHealth();

    assert.equal(health.ok, true);
    assert.equal(health.executionMode, 'direct');
  } finally {
    global.fetch = previousFetch;
  }
});
