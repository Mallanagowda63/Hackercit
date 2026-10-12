const { app, logger } = require('./app');
const { refreshAssignmentStatuses } = require('./controllers/testController');
const { autoSubmitPendingAttempts } = require('./controllers/assessmentController');

const port = process.env.PORT || 4000;
const SCHEDULE_CHECK_MS = 5000;

app.listen(port, () => {
  logger.info({ port }, 'Backend listening');
});

// Scheduled tests go live (and notify students) on time even when nobody is browsing.
setInterval(() => {
  refreshAssignmentStatuses().catch((err) => {
    logger.error({ err }, 'Failed to refresh scheduled tests');
  });
}, SCHEDULE_CHECK_MS);

// Exams whose submit never reached the server (or whose time ran out) are submitted from the
// autosaved answers. One run at a time, since grading can call Judge0.
const AUTO_SUBMIT_CHECK_MS = Number(process.env.EXAM_AUTO_SUBMIT_CHECK_MS || 60000);
let autoSubmitRunning = false;
setInterval(() => {
  if (autoSubmitRunning) return;
  autoSubmitRunning = true;
  autoSubmitPendingAttempts()
    .then((count) => {
      if (count) logger.info({ count }, 'Auto-submitted pending exams');
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to auto-submit pending exams');
    })
    .finally(() => {
      autoSubmitRunning = false;
    });
}, AUTO_SUBMIT_CHECK_MS);
