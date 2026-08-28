const JUDGE0_URL = String(process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/+$/, '');
const HEALTH_TIMEOUT_MS = Number(process.env.JUDGE0_HEALTH_TIMEOUT_MS || 8000);
const JUDGE0_AUTH_TOKEN = String(process.env.JUDGE0_AUTH_TOKEN || '').trim();
const JUDGE0_AUTH_USER = String(process.env.JUDGE0_AUTH_USER || '').trim();

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

async function executeSubmission(payload) {
  return executeSubmissionDirect(payload);
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
  const judge0 = await checkJudge0Health();

  return {
    ...judge0,
    ok: judge0.ok,
    executionMode: 'direct',
  };
}

module.exports = {
  checkExecutionHealth,
  executeSubmission,
  executeSubmissionDirect,
  JUDGE0_URL,
};
