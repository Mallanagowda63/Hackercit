const { checkExecutionHealth, executeSubmission } = require('../lib/executionService');

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

exports.health = async (req, res) => {
  const execution = await checkExecutionHealth();

  return res.status(execution.ok ? 200 : 502).json({
    ok: execution.ok,
    backend: 'up',
    ...execution,
  });
};
