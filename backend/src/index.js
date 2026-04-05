const { app, logger } = require('./app');

const port = process.env.PORT || 4000;
app.listen(port, () => {
  logger.info({ port }, 'Backend listening');
});
