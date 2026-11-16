const nodemailer = require('nodemailer');

// Sends email through Resend (RESEND_API_KEY + MAIL_FROM) when configured, otherwise through
// plain SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS). With neither, nothing is sent.
const RESEND_API = 'https://api.resend.com';
const RESEND_BATCH_SIZE = 100; // Resend's limit per batch request.
const RESEND_BATCH_GAP_MS = 600; // Stay under Resend's request rate limit.

function resendKey() {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function mailFrom() {
  return String(process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
}

function isMailConfigured() {
  if (resendKey()) return Boolean(mailFrom());
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function resendRequest(path, body) {
  const response = await fetch(`${RESEND_API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Resend request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

let smtpTransport = null;
function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return smtpTransport;
}

// message: { to, subject, text, html }
async function sendEmail(message) {
  if (!isMailConfigured()) throw new Error('Email is not configured on the server (RESEND_API_KEY / MAIL_FROM).');
  const payload = { from: mailFrom(), ...message };
  if (resendKey()) return resendRequest('/emails', { ...payload, to: [message.to] });
  return getSmtpTransport().sendMail(payload);
}

// Sends one separate email per message (recipients never see each other), in batches.
// onProgress({ sent, failed }) is called after every batch. Returns { sent, failed, errors }.
async function sendBulk(messages, onProgress = () => {}) {
  if (!isMailConfigured()) throw new Error('Email is not configured on the server (RESEND_API_KEY / MAIL_FROM).');
  const result = { sent: 0, failed: 0, errors: [] };
  const from = mailFrom();

  if (!resendKey()) {
    for (const message of messages) {
      try {
        await getSmtpTransport().sendMail({ from, ...message });
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push(`${message.to}: ${error.message}`);
      }
      onProgress(result);
    }
    return result;
  }

  for (let start = 0; start < messages.length; start += RESEND_BATCH_SIZE) {
    const chunk = messages.slice(start, start + RESEND_BATCH_SIZE);
    const body = chunk.map((message) => ({ from, ...message, to: [message.to] }));
    let attempt = 0;
    for (;;) {
      try {
        await resendRequest('/emails/batch', body);
        result.sent += chunk.length;
        break;
      } catch (error) {
        attempt += 1;
        // Rate limited: wait and retry the same batch a few times.
        if (error.status === 429 && attempt < 4) {
          await sleep(2000 * attempt);
          continue;
        }
        result.failed += chunk.length;
        result.errors.push(`batch ${start / RESEND_BATCH_SIZE + 1}: ${error.message}`);
        break;
      }
    }
    onProgress(result);
    if (start + RESEND_BATCH_SIZE < messages.length) await sleep(RESEND_BATCH_GAP_MS);
  }
  return result;
}

module.exports = { sendEmail, sendBulk, isMailConfigured, mailFrom };
