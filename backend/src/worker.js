require('dotenv').config();
const Queue = require('bull');
const prisma = require('./prismaClient');
const { exec } = require('child_process');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const execQueue = new Queue('exec', redisUrl);

execQueue.process(async (job, done) => {
  const { submissionId, runHidden, customInput } = job.data;
  try {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { problem: true, user: true } });
    if (!sub) return done(new Error('submission not found'));

    await prisma.submission.update({ where: { id: submissionId }, data: { status: 'RUNNING' } });

    // Legacy worker path kept for local experiments. The deployed `/api/run`
    // and submission routes now execute through Judge0 directly.
    const tmpFile = `/tmp/${submissionId}.js`;
    const code = sub.code;
    const fs = require('fs');
    fs.writeFileSync(tmpFile, code);

    const child = exec(`node ${tmpFile}`, { timeout: parseInt(process.env.EXECUTION_TIMEOUT_MS || '5000') }, (error, stdout, stderr) => {
      let status = 'ACCEPTED';
      if (error) {
        if (error.killed) status = 'TLE';
        else status = 'RUNTIME_ERROR';
      }
      const results = { stdout, stderr };
      prisma.submission.update({ where: { id: submissionId }, data: { status, results, timeMs: 0 } });
    });

    child.on('exit', (code, signal) => {
      done();
    });
  } catch (err) {
    console.error('worker error', err);
    await prisma.submission.update({ where: { id: submissionId }, data: { status: 'INTERNAL_ERROR' } });
    done(err);
  }
});

console.log('Worker listening for execution jobs');
