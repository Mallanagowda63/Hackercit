const {
  checkExecutionQueueHealth,
  enqueueExecution,
  isExecutionQueueEnabled,
} = require('./executionQueue');

const JUDGE0_URL = String(process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
const HEALTH_TIMEOUT_MS = Number(process.env.JUDGE0_HEALTH_TIMEOUT_MS || 8000);
const JUDGE0_AUTH_TOKEN = String(process.env.JUDGE0_AUTH_TOKEN || '').trim();
const JUDGE0_AUTH_USER = String(process.env.JUDGE0_AUTH_USER || '').trim();
const DIRECT_FALLBACK_DISABLED_VALUES = new Set(['0', 'false', 'off', 'disabled', 'no']);
const DIRECT_FALLBACK_ENABLED_VALUES = new Set(['1', 'true', 'on', 'enabled', 'yes']);

let runnerModulePromise = null;

function getRunnerModule() {
  if (!runnerModulePromise) {
    runnerModulePromise = import('../../../runner/index.js');
  }

  return runnerModulePromise;
}

function buildJudge0Headers() {
  const headers = {};

  if (JUDGE0_AUTH_TOKEN) {
    headers['X-Auth-Token'] = JUDGE0_AUTH_TOKEN;
  }

  if (JUDGE0_AUTH_USER) {
    headers['X-Auth-User'] = JUDGE0_AUTH_USER;
  }

  return headers;
}

async function executeSubmissionDirect(payload) {
  const runner = await getRunnerModule();
  return runner.runSubmission(payload);
}

function isDirectFallbackEnabled() {
  const configured = String(process.env.EXECUTION_QUEUE_DIRECT_FALLBACK || '').trim().toLowerCase();
  if (DIRECT_FALLBACK_ENABLED_VALUES.has(configured)) return true;
  if (DIRECT_FALLBACK_DISABLED_VALUES.has(configured)) return false;

  return process.env.NODE_ENV !== 'production';
}

function isQueueAvailabilityError(error) {
  const message = String(error?.message || '');
  return error?.statusCode === 503
    || /execution queue is unavailable|redis|bull|execution queue processor/i.test(message);
}

async function executeSubmission(payload, options = {}) {
  if (options.useQueue === false || !isExecutionQueueEnabled()) {
    return executeSubmissionDirect(payload);
  }

  try {
    return await enqueueExecution(payload, {
      priority: options.priority,
    });
  } catch (error) {
    if (isDirectFallbackEnabled() && isQueueAvailabilityError(error)) {
      console.warn(`Execution queue failed (${error.message}). Running locally for this request.`);
      return executeSubmissionDirect(payload);
    }

    throw error;
  }
}

async function checkJudge0Health() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${JUDGE0_URL}/languages`, {
      method: 'GET',
      headers: buildJudge0Headers(),
      signal: controller.signal,
    });

    const text = await response.text();
    let languages = null;

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          languages = parsed.length;
        }
      } catch {
        languages = null;
      }
    }

    return {
      ok: response.ok,
      executionProvider: 'Judge0',
      judge0Url: JUDGE0_URL,
      judge0Status: response.status,
      languagesAvailable: languages,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        ok: false,
        executionProvider: 'Judge0',
        judge0Url: JUDGE0_URL,
        error: 'Judge0 health check timed out.',
      };
    }

    return {
      ok: false,
      executionProvider: 'Judge0',
      judge0Url: JUDGE0_URL,
      error: error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkExecutionHealth() {
  const [judge0, queue] = await Promise.all([
    checkJudge0Health(),
    checkExecutionQueueHealth(),
  ]);

  return {
    ...judge0,
    ok: judge0.ok && queue.ok,
    queue,
  };
}

module.exports = {
  checkExecutionHealth,
  executeSubmission,
  executeSubmissionDirect,
  JUDGE0_URL,
};
