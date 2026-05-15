const prisma = require('../prismaClient');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const { getBadgePresentation, syncUserBadge } = require('../lib/badgeService');

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'ADMIN';
  if (normalized === 'setter') return 'SETTER';
  if (normalized === 'student' || normalized === 'user') return 'USER';
  return null;
}

function toClientRole(role) {
  if (role === 'ADMIN') return 'admin';
  if (role === 'SETTER') return 'setter';
  return 'student';
}

function serializeUser(user) {
  const badge = getBadgePresentation(user);

  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    usn: user.usn || '',
    department: user.department || '',
    role: toClientRole(user.role),
    dbRole: user.role,
    verified: Boolean(user.verified),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    loginCount: user.loginCount || 0,
    badgeTier: badge.badgeTier,
    badgeLabel: badge.badgeLabel,
    badgeIds: badge.badgeIds,
    solvedProblemCount: badge.solvedProblemCount,
    badgeUpdatedAt: user.badgeUpdatedAt || null,
  };
}

function extractRequestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || req.ip || null;
}

async function recordAuthEvent(req, user, eventType) {
  await prisma.loginEvent.create({
    data: {
      userId: user.id,
      email: user.email,
      role: user.role,
      eventType,
      ip: extractRequestIp(req),
      userAgent: req.headers['user-agent'] || null,
    },
  });
}

async function sendVerificationEmail(user, token) {
  // Simple transporter; in prod use SES/SendGrid or SMTP credentials
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify?token=${token}`;

  const msg = {
    from: process.env.SMTP_USER || 'no-reply@hackercit.local',
    to: user.email,
    subject: 'Verify your email',
    text: `Click to verify: ${verifyUrl}`,
  };

  try {
    if (!process.env.SMTP_USER) {
      console.log('Verification URL (dev):', verifyUrl);
      return;
    }
    await transporter.sendMail(msg);
  } catch (err) {
    console.error('email send fail', err);
  }
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRY || '7d' });
}

function getDuplicateField(error) {
  const keyValue = error?.keyValue && typeof error.keyValue === 'object'
    ? Object.keys(error.keyValue)[0]
    : '';
  if (keyValue) return keyValue;

  const message = String(error?.message || '');
  if (message.includes('email')) return 'email';
  if (message.includes('usn')) return 'usn';
  return '';
}

function isDatabaseConnectionError(error) {
  const message = String(error?.message || '');
  const normalizedMessage = message.toLowerCase();
  const errorName = String(error?.name || '').toLowerCase();
  return (
    normalizedMessage.includes('database connection')
    || normalizedMessage.includes('querysrv')
    || normalizedMessage.includes('econnrefused')
    || normalizedMessage.includes('enotfound')
    || normalizedMessage.includes('mongodb')
    || normalizedMessage.includes('mongo')
    || normalizedMessage.includes('invalid scheme')
    || normalizedMessage.includes('invalid connection string')
    || normalizedMessage.includes('uri malformed')
    || normalizedMessage.includes('server selection')
    || normalizedMessage.includes('failed to connect')
    || errorName.includes('mongo')
  );
}

function getDatabaseConnectionErrorMessage(error) {
  const message = String(error?.message || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('set database_url or mongodb_uri')) {
    return 'database connection failed: missing DATABASE_URL or MONGODB_URI on the deployed backend';
  }

  if (
    normalized.includes('authentication failed')
    || normalized.includes('auth failed')
    || normalized.includes('scram')
    || normalized.includes('bad auth')
  ) {
    return 'database connection failed: invalid MongoDB credentials';
  }

  if (
    normalized.includes('enotfound')
    || normalized.includes('econnrefused')
    || normalized.includes('unreachable network')
    || normalized.includes('timed out')
    || normalized.includes('server selection')
    || normalized.includes('failed to connect')
    || normalized.includes('getaddrinfo')
  ) {
    return 'database connection failed: backend could not reach MongoDB. Check Atlas network access and the connection string host list.';
  }

  if (
    normalized.includes('mongoparseerror')
    || normalized.includes('invalid scheme')
    || normalized.includes('invalid connection string')
    || normalized.includes('uri malformed')
  ) {
    return 'database connection failed: invalid MongoDB connection string';
  }

  return 'database connection failed';
}

function sendDatabaseConnectionError(res, error) {
  return res.status(503).json({ error: getDatabaseConnectionErrorMessage(error) });
}

exports.register = async (req, res) => {
  const { email, password, name, role, usn, department } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  try {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) return res.status(400).json({ error: 'valid role required' });

    const trimmedName = String(name || '').trim();
    const trimmedUsn = String(usn || '').trim();
    const trimmedDepartment = String(department || '').trim();

    if (!trimmedName) return res.status(400).json({ error: 'name required' });
    if (!trimmedDepartment) return res.status(400).json({ error: 'department required' });
    if (normalizedRole === 'USER' && !trimmedUsn) return res.status(400).json({ error: 'usn required for student signup' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'email in use' });
    if (trimmedUsn) {
      const usnExists = await prisma.user.findFirst({ where: { usn: trimmedUsn } });
      if (usnExists) return res.status(409).json({ error: 'usn in use' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const lastLoginAt = new Date();
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: trimmedName,
        role: normalizedRole,
        // Keep optional fields undefined when blank so sparse unique indexes do not
        // treat multiple admin accounts as the same `null` USN value.
        usn: trimmedUsn || undefined,
        department: trimmedDepartment || undefined,
        lastLoginAt,
        loginCount: 1,
      },
    });

    // create verification token
    const token = uuidv4();
    const inOneDay = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.verificationToken.create({ data: { token, userId: user.id, expiresAt: inOneDay } });
    await sendVerificationEmail(user, token);
    await recordAuthEvent(req, user, 'SIGNUP');

    const authToken = signToken(user);
    return res.status(201).json({ token: authToken, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) {
      const duplicateField = getDuplicateField(err);
      if (duplicateField === 'email') {
        return res.status(409).json({ error: 'email in use' });
      }
      if (duplicateField === 'usn') {
        return res.status(409).json({ error: 'usn in use' });
      }
      return res.status(409).json({ error: 'account data already exists' });
    }
    if (isDatabaseConnectionError(err)) {
      return sendDatabaseConnectionError(res, err);
    }
    return res.status(500).json({ error: 'server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) return res.status(400).json({ error: 'invalid or expired' });
    await prisma.user.update({ where: { id: record.userId }, data: { verified: true } });
    await prisma.verificationToken.delete({ where: { id: record.id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    if (isDatabaseConnectionError(err)) {
      return sendDatabaseConnectionError(res, err);
    }
    return res.status(500).json({ error: 'server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email+password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const requestedRole = normalizeRole(role);
    if (requestedRole && user.role !== requestedRole) {
      return res.status(403).json({ error: 'selected role does not match this account' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
    });
    await recordAuthEvent(req, updatedUser, 'LOGIN');

    const userWithBadge = await syncUserBadge(updatedUser.id);
    const token = signToken(userWithBadge || updatedUser);
    return res.json({ token, user: serializeUser(userWithBadge || updatedUser) });
  } catch (err) {
    console.error(err);
    if (isDatabaseConnectionError(err)) {
      return sendDatabaseConnectionError(res, err);
    }
    return res.status(500).json({ error: 'server error' });
  }
};

exports.me = async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'auth required' });
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await syncUserBadge(payload.sub);
    if (!user) return res.status(404).json({ error: 'not found' });
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json({ ok: true }); // don't reveal existence
  const token = uuidv4();
  const expires = new Date(Date.now() + 3600 * 1000);
  await prisma.resetToken.create({ data: { token, userId: user.id, expiresAt: expires } });
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset?token=${token}`;
  console.log('Password reset URL (dev):', resetUrl);
  return res.json({ ok: true });
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'token+password required' });
  const record = await prisma.resetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return res.status(400).json({ error: 'invalid or expired' });
  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: record.userId }, data: { password: hashed } });
  await prisma.resetToken.delete({ where: { id: record.id } });
  return res.json({ ok: true });
};

exports.listStudents = async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
    });
    const studentsWithBadges = await Promise.all(
      students.map(async (student) => await syncUserBadge(student.id) || student),
    );

    return res.json({
      students: studentsWithBadges.map((student) => ({
        ...serializeUser(student),
        status: student.lastLoginAt ? 'Logged In' : 'Registered',
      })),
    });
  } catch (err) {
    console.error(err);
    if (isDatabaseConnectionError(err)) {
      return sendDatabaseConnectionError(res, err);
    }
    return res.status(500).json({ error: 'server error' });
  }
};

exports.listLoginEvents = async (req, res) => {
  try {
    const events = await prisma.loginEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json({ events });
  } catch (err) {
    console.error(err);
    if (isDatabaseConnectionError(err)) {
      return sendDatabaseConnectionError(res, err);
    }
    return res.status(500).json({ error: 'server error' });
  }
};
