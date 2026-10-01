const { app, logger } = require('./app');
const { refreshAssignmentStatuses } = require('./controllers/testController');

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
