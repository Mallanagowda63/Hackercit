const prisma = require('../prismaClient');
const { effectiveRole } = require('../lib/adminConfig');
const { sendEmail, sendBulk, isMailConfigured, mailFrom } = require('../lib/mailer');
const { renderAnnouncementEmail } = require('../lib/emailTemplate');

// Admin email announcements (weekly / monthly challenges, notices) to students the admin selects.
// At most MAX_RECIPIENTS per send (Resend's free plan allows 100 emails a day). Each send is
// recorded in EmailLog so the admin can see who already got an email with the same subject.
const MAX_RECIPIENTS = Number(process.env.ANNOUNCEMENT_MAX_RECIPIENTS || 100);
const MAX_SUBJECT = 150;
const MAX_MESSAGE = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let currentJob = null; // { id, subject, total, sent, failed, errors, status, startedAt, finishedAt }

function siteUrl(req) {
  const configured = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function firstName(user) {
  const name = String(user?.name || '').trim();
  return name ? name.split(/\s+/)[0] : 'there';
}

function buildEmail({ subject, message, link, linkLabel, name }) {
  const logoUrl = link ? `${link}/scholarlogic-logo.png` : '';
  return renderAnnouncementEmail({ subject, message, name, link, linkLabel, logoUrl });
}

function readInput(body = {}) {
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').replace(/\r\n/g, '\n').trim();
  if (!subject) return { error: 'Enter a subject.' };
  if (!message) return { error: 'Enter a message.' };
  if (subject.length > MAX_SUBJECT) return { error: `Subject must be ${MAX_SUBJECT} characters or less.` };
  if (message.length > MAX_MESSAGE) return { error: `Message must be ${MAX_MESSAGE} characters or less.` };
  return { subject, message };
}

async function loadStudents() {
  const users = await prisma.user.findMany({});
  const seen = new Set();
  return users.filter((user) => {
    if (String(effectiveRole(user) || '').toUpperCase() !== 'USER') return false;
    const email = String(user.email || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function presentJob(job) {
  if (!job) return null;
  const { errors, ...rest } = job;
  return { ...rest, errors: errors.slice(0, 5) };
}

// GET /api/admin/announcements/status
exports.status = async (req, res) => {
  try {
    const students = await loadStudents();
    const logs = await prisma.emailLog.findMany({ orderBy: { sentAt: 'desc' }, take: 200 });
    return res.json({
      configured: isMailConfigured(),
      from: mailFrom(),
      maxRecipients: MAX_RECIPIENTS,
      studentCount: students.length,
      students: students.map((student) => ({
        id: String(student.id),
        name: student.name || String(student.email).split('@')[0],
        email: student.email,
        usn: student.usn || '',
        department: student.department || '',
      })),
      // For each subject: which students already received it (newest sends first).
      history: logs.map((log) => ({
        subject: log.subject,
        sentAt: log.sentAt,
        sent: log.sent,
        userIds: Array.isArray(log.userIds) ? log.userIds.map(String) : [],
      })),
      adminEmail: req.user.email || '',
      job: presentJob(currentJob),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load the email status.' });
  }
};

// POST /api/admin/announcements/email
// body: { subject, message, userIds } or { subject, message, testTo } for one preview email.
exports.send = async (req, res) => {
  try {
    if (!isMailConfigured()) return res.status(503).json({ error: 'Email is not configured on the server (RESEND_API_KEY / MAIL_FROM).' });
    const { subject, message, error } = readInput(req.body);
    if (error) return res.status(400).json({ error });

    const link = siteUrl(req);
    const linkLabel = 'Open DevOrbit';

    const testTo = String(req.body.testTo || '').trim();
    if (testTo) {
      if (!EMAIL_PATTERN.test(testTo)) return res.status(400).json({ error: 'Enter a valid test email address.' });
      await sendEmail({ to: testTo, ...buildEmail({ subject: `[TEST] ${subject}`, message, link, linkLabel, name: firstName(req.user) }) });
      return res.json({ ok: true, test: true, to: testTo });
    }

    if (currentJob?.status === 'SENDING') return res.status(409).json({ error: 'An email is already being sent. Wait for it to finish.' });

    const requestedIds = [...new Set((Array.isArray(req.body.userIds) ? req.body.userIds : []).map(String).filter(Boolean))];
    if (!requestedIds.length) return res.status(400).json({ error: 'Select at least one student.' });
    if (requestedIds.length > MAX_RECIPIENTS) {
      return res.status(400).json({ error: `You can email at most ${MAX_RECIPIENTS} students at a time. You selected ${requestedIds.length}.` });
    }
    const wanted = new Set(requestedIds);
    const students = (await loadStudents()).filter((student) => wanted.has(String(student.id)));
    if (!students.length) return res.status(400).json({ error: 'None of the selected students could be found.' });

    const messages = students.map((student) => ({
      to: String(student.email).trim().toLowerCase(),
      ...buildEmail({ subject, message, link, linkLabel, name: firstName(student) }),
    }));

    const job = {
      id: Date.now().toString(36),
      subject,
      total: messages.length,
      sent: 0,
      failed: 0,
      errors: [],
      status: 'SENDING',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      sentBy: req.user.email || '',
    };
    currentJob = job;

    sendBulk(messages, (progress) => {
      job.sent = progress.sent;
      job.failed = progress.failed;
      job.errors = progress.errors;
    })
      .then(async (result) => {
        job.sent = result.sent;
        job.failed = result.failed;
        job.errors = result.errors;
        // With up to 100 recipients everything goes in one batch, so it is all sent or all failed.
        if (result.sent && !result.failed) {
          await prisma.emailLog.create({
            data: { subject, userIds: students.map((student) => String(student.id)), sent: result.sent, sentAt: new Date(), sentBy: job.sentBy },
          }).catch((logError) => console.error('emailLog write failed', logError));
        }
        job.status = result.failed ? (result.sent ? 'PARTIAL' : 'FAILED') : 'DONE';
      })
      .catch((sendError) => {
        job.status = 'FAILED';
        job.errors.push(sendError.message);
      })
      .finally(() => {
        job.finishedAt = new Date().toISOString();
        console.log(`[announcement] "${subject}" sent=${job.sent} failed=${job.failed} total=${job.total}`);
      });

    return res.status(202).json({ ok: true, job: presentJob(job) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Unable to send the email.' });
  }
};
