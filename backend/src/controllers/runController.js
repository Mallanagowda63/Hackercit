const { checkExecutionHealth, executeSubmission } = require('../lib/executionService');

// Practice IDE (playground): any program with the student's own input, no test cases.
const PLAYGROUND_LANGUAGE_IDS = Object.freeze({
  python: Number(process.env.JUDGE0_LANGUAGE_ID_PYTHON || 71),
  javascript: Number(process.env.JUDGE0_LANGUAGE_ID_JAVASCRIPT || 63),
  java: Number(process.env.JUDGE0_LANGUAGE_ID_JAVA || 62),
  c: Number(process.env.JUDGE0_LANGUAGE_ID_C || 50),
  cpp: Number(process.env.JUDGE0_LANGUAGE_ID_CPP || 54),
});
const MAX_PLAYGROUND_CODE_LENGTH = 64 * 1024;
const MAX_PLAYGROUND_INPUT_LENGTH = 64 * 1024;

exports.run = async (req, res) => {
  try {
    const payload = await executeSubmission(req.body || {}, { priority: 10 });
    return res.status(200).json(payload);
  } catch (error) {
    const statusCode = error.statusCode || 502;
    return res.status(statusCode).json({
      error: error.message || 'Execution failed.',
    });
  }
};

// POST /api/run/playground { language, code, stdin }
exports.playground = async (req, res) => {
  const language = String(req.body?.language || '');
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const stdin = typeof req.body?.stdin === 'string' ? req.body.stdin : '';

  if (!Object.prototype.hasOwnProperty.call(PLAYGROUND_LANGUAGE_IDS, language)) {
    return res.status(400).json({ error: 'Unsupported language.' });
  }
  if (!code.trim()) {
    return res.status(400).json({ error: 'Write some code first.' });
  }
  if (code.length > MAX_PLAYGROUND_CODE_LENGTH) {
    return res.status(400).json({ error: 'Code is too long (64 KB max).' });
  }
  if (stdin.length > MAX_PLAYGROUND_INPUT_LENGTH) {
    return res.status(400).json({ error: 'Input is too long (64 KB max).' });
  }

  try {
    const result = await executeSubmission(
      { code, language_id: PLAYGROUND_LANGUAGE_IDS[language], input: stdin },
      { priority: 10 },
    );
    const seconds = Number(result?.time);
    const memory = Number(result?.memory);

    return res.json({
      statusId: Number(result?.status?.id) || null,
      status: String(result?.status?.description || 'Finished'),
      stdout: String(result?.stdout || ''),
      stderr: String(result?.stderr || ''),
      compileOutput: String(result?.compile_output || ''),
      message: String(result?.message || ''),
      runtime: Number.isFinite(seconds) ? `${Math.max(1, Math.round(seconds * 1000))} ms` : 'N/A',
      memory: Number.isFinite(memory) ? `${memory} KB` : 'N/A',
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || 'Execution failed.',
    });
  }
};

exports.health = async (req, res) => {
  const execution = await checkExecutionHealth();

  return res.status(execution.ok ? 200 : 502).json({
    ok: execution.ok,
    backend: 'up',
    ...execution,
  });
};
