const RUNNER_URL = process.env.CODE_RUNNER_URL || 'http://127.0.0.1:3000';
const RUNNER_TIMEOUT_MS = Number(process.env.RUNNER_TIMEOUT_MS || 45000);

function buildRunnerEndpoint(pathname) {
  const base = RUNNER_URL.endsWith('/') ? RUNNER_URL : `${RUNNER_URL}/`;
  return new URL(pathname.replace(/^\//, ''), base).toString();
}

exports.run = async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUNNER_TIMEOUT_MS);

  try {
    const response = await fetch(buildRunnerEndpoint('/api/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        return res.status(502).json({
          error: 'Code runner returned invalid JSON.',
          runnerStatus: response.status,
          runnerResponse: text.slice(0, 200),
        });
      }
    }

    return res.status(response.status).json(payload);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Code runner timed out.' });
    }

    return res.status(502).json({
      error: 'Unable to reach code runner service.',
      detail: error.message,
      runnerUrl: RUNNER_URL,
    });
  } finally {
    clearTimeout(timer);
  }
};

exports.health = async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(RUNNER_TIMEOUT_MS, 10000));

  try {
    const response = await fetch(buildRunnerEndpoint('/api/health'), {
      method: 'GET',
      signal: controller.signal,
    });

    const text = await response.text();
    let runner = {};

    if (text) {
      try {
        runner = JSON.parse(text);
      } catch {
        runner = { raw: text.slice(0, 200) };
      }
    }

    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      backend: 'up',
      runnerUrl: RUNNER_URL,
      runnerStatus: response.status,
      runner,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ ok: false, backend: 'up', error: 'Runner health check timed out.', runnerUrl: RUNNER_URL });
    }

    return res.status(502).json({ ok: false, backend: 'up', error: error.message, runnerUrl: RUNNER_URL });
  } finally {
    clearTimeout(timer);
  }
};
