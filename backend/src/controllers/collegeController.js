const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const prisma = require('../prismaClient');
const { listColleges, invalidateColleges, isSuperAdmin, canAccessCollege, checkCollegeSeparation, backfillRecordColleges, idForms } = require('../lib/collegeScope');

const cleanName = (value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
const cleanEmail = (value) => String(value || '').trim().toLowerCase();
const cleanText = (value, max) => String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);

// Extra details the main admin keeps for each college.
function readDetails(body = {}) {
  const details = {
    code: cleanText(body.code, 20).toUpperCase(),
    city: cleanText(body.city, 80),
    address: cleanText(body.address, 300),
    contactName: cleanText(body.contactName, 100),
    contactEmail: cleanEmail(body.contactEmail).slice(0, 150),
    contactPhone: cleanText(body.contactPhone, 20),
    notes: cleanText(body.notes, 1000),
  };
  if (details.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.contactEmail)) {
    return { error: 'Enter a valid contact email.' };
  }
  return { details };
}

function presentCollege(college) {
  return {
    id: college.id,
    name: college.name,
    inviteCode: college.inviteCode || '',
    inviteEnabled: college.inviteEnabled !== false,
    code: college.code || '',
    city: college.city || '',
    address: college.address || '',
    contactName: college.contactName || '',
    contactEmail: college.contactEmail || '',
    contactPhone: college.contactPhone || '',
    notes: college.notes || '',
    createdAt: college.createdAt || null,
  };
}

// ── Invite codes ─────────────────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomPart(length) {
  return Array.from({ length }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

async function newInviteCode(college) {
  const base = (String(college.code || '').replace(/[^A-Z0-9]/gi, '')
    || String(college.name || '').split(/\s+/).map((word) => word[0] || '').join('').replace(/[^A-Z0-9]/gi, '')
    || 'COL').toUpperCase().slice(0, 6);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `${base}-${randomPart(4)}`;
    if (!(await prisma.college.findFirst({ where: { inviteCode: code }, select: { id: true } }))) return code;
  }
  return `${base}-${randomPart(8)}`;
}

async function withInviteCode(college) {
  if (!college || college.inviteCode) return college;
  const inviteCode = await newInviteCode(college);
  return prisma.college.update({ where: { id: college.id }, data: { inviteCode, inviteEnabled: true } });
}

// Months follow India time, like the rest of the backend.
const monthKey = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);

// Numbers for each college (and every college together) for the main admin's dashboard.
async function collegeStats() {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const monthStart = new Date(`${monthKey()}-01T00:00:00+05:30`).getTime();
  const [users, tests, attempts, results, interviews] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, collegeId: true, lastLoginAt: true, createdAt: true, loginCount: true } }),
    prisma.testAssignment.findMany({ select: { id: true, title: true, status: true, collegeId: true, startsAt: true, createdAt: true } }),
    prisma.testAttempt.findMany({ select: { id: true, assignmentId: true } }),
    prisma.assessmentSubmission.findMany({ select: { id: true, assignmentId: true, percentage: true } }),
    prisma.aiHireInterview.findMany({ where: { month: monthKey() }, select: { id: true, userId: true, status: true } }),
  ]);
  const testCollege = new Map(tests.map((test) => [String(test.id), String(test.collegeId || '')]));
  const userCollege = new Map(users.map((user) => [String(user.id), String(user.collegeId || '')]));

  const build = (inCollege) => {
    const members = users.filter((user) => inCollege(String(user.collegeId || '')));
    const students = members.filter((user) => user.role !== 'ADMIN');
    const collegeTests = tests.filter((test) => inCollege(String(test.collegeId || '')));
    const collegeResults = results.filter((row) => inCollege(testCollege.get(String(row.assignmentId)) || ''));
    const scores = collegeResults.map((row) => Number(row.percentage)).filter(Number.isFinite);
    const lastTest = [...collegeTests].sort((x, y) => new Date(y.startsAt || y.createdAt) - new Date(x.startsAt || x.createdAt))[0];
    return {
      studentCount: students.length,
      activeThisWeek: students.filter((user) => user.lastLoginAt && new Date(user.lastLoginAt).getTime() >= weekAgo).length,
      newThisMonth: students.filter((user) => user.createdAt && new Date(user.createdAt).getTime() >= monthStart).length,
      testCount: collegeTests.length,
      liveTests: collegeTests.filter((test) => test.status === 'LIVE').length,
      scheduledTests: collegeTests.filter((test) => test.status === 'SCHEDULED').length,
      attempts: attempts.filter((row) => inCollege(testCollege.get(String(row.assignmentId)) || '')).length,
      results: collegeResults.length,
      averageScore: scores.length ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10 : null,
      aiInterviewsThisMonth: interviews.filter((row) => inCollege(userCollege.get(String(row.userId)) || '')).length,
      lastTest: lastTest ? { title: lastTest.title, status: lastTest.status, at: lastTest.startsAt || lastTest.createdAt } : null,
      admins: members
        .filter((user) => user.role === 'ADMIN')
        .map((user) => ({ id: user.id, name: user.name || '', email: user.email, lastLoginAt: user.lastLoginAt || null, loginCount: user.loginCount || 0, createdAt: user.createdAt })),
    };
  };
  return { build, unassigned: users.filter((user) => user.role !== 'ADMIN' && !user.collegeId).length };
}

// Only the super admin (ADMIN_EMAIL) manages colleges and college admins.
exports.requireSuperAdmin = (req, res, next) => {
  if (!isSuperAdmin(req.user)) return res.status(403).json({ error: 'Only the main admin can manage colleges.' });
  return next();
};

// GET /api/colleges — public list for the sign-up form.
exports.publicList = async (req, res) => {
  try {
    const colleges = await listColleges();
    return res.json({ colleges: colleges.map((college) => ({ id: college.id, name: college.name })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/colleges/manage — every college with its details, admins and numbers (main admin).
exports.manageList = async (req, res) => {
  try {
    const [stored, stats] = await Promise.all([
      prisma.college.findMany({ orderBy: [{ name: 'asc' }] }),
      collegeStats(),
    ]);
    const colleges = await Promise.all(stored.map(withInviteCode));
    const { admins: allAdmins, ...totals } = stats.build(() => true);
    return res.json({
      colleges: colleges.map((college) => ({ ...presentCollege(college), ...stats.build((id) => id === college.id) })),
      totals: { ...totals, collegeCount: colleges.length, adminCount: allAdmins.length },
      // General students: everyone who is not in a partner college.
      general: (({ admins, ...rest }) => rest)(stats.build((id) => id === '')),
      unassignedStudents: stats.unassigned,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/colleges/mine — the signed-in college admin's own college (details, admins, numbers).
exports.mine = async (req, res) => {
  try {
    const collegeId = String(req.user?.collegeId || '');
    if (!collegeId) return res.json({ college: null });
    const [stored, stats] = await Promise.all([
      prisma.college.findUnique({ where: { id: collegeId } }),
      collegeStats(),
    ]);
    if (!stored) return res.json({ college: null });
    const college = await withInviteCode(stored);
    // Notes are the main admin's private notes about the college.
    const { notes: _privateNotes, ...details } = presentCollege(college);
    return res.json({ college: { ...details, ...stats.build((id) => id === collegeId) } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// POST /api/colleges { name, code, city, address, contactName, contactEmail, contactPhone, notes }
exports.create = async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'College name is required.' });
    const existing = await listColleges();
    if (existing.some((college) => college.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'A college with this name already exists.' });
    }
    const { details, error } = readDetails(req.body);
    if (error) return res.status(400).json({ error });
    const now = new Date();
    const created = await prisma.college.create({ data: { name, ...details, inviteEnabled: true, createdAt: now, updatedAt: now } });
    const college = await withInviteCode(created);
    invalidateColleges();
    return res.status(201).json({ college: presentCollege(college) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// PUT /api/colleges/:id { name, code, city, address, contactName, contactEmail, contactPhone, notes }
exports.rename = async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'College name is required.' });
    const college = await prisma.college.findUnique({ where: { id: req.params.id } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const existing = await listColleges();
    if (existing.some((item) => item.id !== college.id && item.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'A college with this name already exists.' });
    }
    const { details, error } = readDetails(req.body);
    if (error) return res.status(400).json({ error });
    const updated = await prisma.college.update({ where: { id: college.id }, data: { name, ...details, updatedAt: new Date() } });
    invalidateColleges();
    return res.json({ college: presentCollege(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// DELETE /api/colleges/:id — only an empty college (no students, admins or tests).
exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    const college = await prisma.college.findUnique({ where: { id } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const [member, test] = await Promise.all([
      prisma.user.findFirst({ where: { collegeId: id }, select: { id: true } }),
      prisma.testAssignment.findFirst({ where: { collegeId: id }, select: { id: true } }),
    ]);
    if (member || test) {
      return res.status(400).json({ error: "Move or remove this college's students, admins and tests before deleting it." });
    }
    await prisma.college.delete({ where: { id } });
    invalidateColleges();
    return res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// POST /api/colleges/:id/admins { name, email, password } — a login for that college's admin.
exports.createAdmin = async (req, res) => {
  try {
    const collegeId = req.params.id;
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const name = cleanName(req.body?.name);
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (isSuperAdmin({ email })) return res.status(400).json({ error: 'That is the main admin email.' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'This email already has an account (maybe a student). Use a different email for the college admin.' });
    }
    const now = new Date();
    const admin = await prisma.user.create({
      data: {
        email,
        name,
        password: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        collegeId,
        verified: true,
        loginCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    return res.status(201).json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error(err);
    if (err?.code === 11000) return res.status(409).json({ error: 'This email already has an account.' });
    return res.status(500).json({ error: 'server error' });
  }
};

async function findCollegeAdmin(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== 'ADMIN' || !user.collegeId || isSuperAdmin(user)) return null;
  return user;
}

// POST /api/colleges/admins/:userId/password { password }
exports.resetAdminPassword = async (req, res) => {
  try {
    const admin = await findCollegeAdmin(req.params.userId);
    if (!admin) return res.status(404).json({ error: 'College admin not found.' });
    const password = String(req.body?.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    await prisma.user.update({ where: { id: admin.id }, data: { password: await bcrypt.hash(password, 10) } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// DELETE /api/colleges/admins/:userId — removes the college admin's login.
exports.removeAdmin = async (req, res) => {
  try {
    const admin = await findCollegeAdmin(req.params.userId);
    if (!admin) return res.status(404).json({ error: 'College admin not found.' });
    await Promise.all([
      prisma.notification.deleteMany({ where: { userId: admin.id } }),
      prisma.verificationToken.deleteMany({ where: { userId: admin.id } }),
      prisma.resetToken.deleteMany({ where: { userId: admin.id } }),
    ]);
    await prisma.user.delete({ where: { id: admin.id } });
    return res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// Students matched by email or USN (case-insensitive).
async function findStudents(identifiersInput) {
  const identifiers = [...new Set((Array.isArray(identifiersInput) ? identifiersInput : [])
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean))];
  if (!identifiers.length) return { error: 'Paste at least one student email or USN.' };
  if (identifiers.length > 5000) return { error: 'At most 5000 students at a time.' };
  const wanted = new Set(identifiers);
  const students = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true, email: true, usn: true, collegeId: true } });
  const matches = students.filter((student) => wanted.has(String(student.email || '').toLowerCase()) || wanted.has(String(student.usn || '').toLowerCase()));
  const found = new Set();
  matches.forEach((student) => {
    found.add(String(student.email || '').toLowerCase());
    if (student.usn) found.add(String(student.usn).toLowerCase());
  });
  return { matches, notFound: identifiers.filter((value) => !found.has(value)) };
}

// A student's own practice work, AI interviews and notifications follow them. Test attempts and
// results stay with the college (or general group) whose test it was.
async function moveStudentRecords(userIds, collegeId) {
  const ids = idForms(userIds);
  const update = collegeId ? { $set: { collegeId } } : { $unset: { collegeId: '' } };
  for (const name of ['submission', 'aiHireInterview', 'aiHireAnswer', 'notification']) {
    await (await prisma[name].collection()).updateMany({ userId: { $in: ids } }, update);
  }
  await (await prisma.testFeedback.collection()).updateMany({ userId: { $in: ids }, assignmentId: 'ai-hire' }, update);
}

// Puts general students into a college (their own records follow them).
async function joinCollege(userIds, collegeId) {
  if (!userIds.length) return;
  await (await prisma.user.collection()).updateMany(
    { _id: { $in: userIds.map((id) => new ObjectId(String(id))) } },
    { $set: { collegeId: String(collegeId), updatedAt: new Date() } },
  );
  await moveStudentRecords(userIds, String(collegeId));
}

// Only the main admin, or this college's own admin, may change who is in the college.
function canManageCollegeStudents(user, collegeId) {
  return isSuperAdmin(user) || (Boolean(user?.collegeId) && String(user.collegeId) === String(collegeId));
}

// POST /api/colleges/:id/move-students { identifiers: ["email or USN", ...] }
// Adds students to this college. A college admin can only add general students (not ones that
// already belong to another college); the main admin can move anyone.
exports.moveStudents = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const { matches, notFound, error } = await findStudents(req.body?.identifiers);
    if (error) return res.status(400).json({ error });

    const alreadyThere = matches.filter((student) => String(student.collegeId || '') === collegeId);
    const inOtherCollege = isSuperAdmin(req.user)
      ? []
      : matches.filter((student) => student.collegeId && String(student.collegeId) !== collegeId);
    const toMove = matches.filter((student) => !alreadyThere.includes(student) && !inOtherCollege.includes(student));
    await joinCollege(toMove.map((student) => student.id), collegeId);
    return res.json({
      moved: toMove.length,
      alreadyThere: alreadyThere.length,
      inOtherCollege: inOtherCollege.length,
      notFound,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// POST /api/colleges/:id/remove-students { identifiers } — takes students out of this college;
// they become general students again.
exports.removeStudents = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const { matches, notFound, error } = await findStudents(req.body?.identifiers);
    if (error) return res.status(400).json({ error });
    const inCollege = matches.filter((student) => String(student.collegeId || '') === collegeId);
    if (inCollege.length) {
      await (await prisma.user.collection()).updateMany(
        { _id: { $in: inCollege.map((student) => new ObjectId(student.id)) } },
        { $unset: { collegeId: '' }, $set: { updatedAt: new Date() } },
      );
      await moveStudentRecords(inCollege.map((student) => student.id), null);
    }
    return res.json({
      removed: inCollege.length,
      notInCollege: matches.length - inCollege.length,
      notFound,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/colleges/check — is every record tagged with a college, and with the right one?
// (main admin). Records still missing a college are filled in first.
exports.check = async (req, res) => {
  try {
    await backfillRecordColleges();
    return res.json({ report: await checkCollegeSeparation() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/colleges/:id/export — one college's data as a JSON backup (no passwords).
// The main admin can export any college; a college admin only their own.
exports.exportCollege = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canAccessCollege(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return res.status(404).json({ error: 'College not found.' });

    const rows = async (name, projection = {}) => (await (await prisma[name].collection())
      .find({ collegeId: { $in: idForms([collegeId]) } }, { projection }).toArray());
    const [users, tests, attempts, results, feedback, submissions, aiAssignments, aiInterviews, aiAnswers, emails] = await Promise.all([
      rows('user', { password: 0 }),
      rows('testAssignment'),
      rows('testAttempt'),
      rows('assessmentSubmission'),
      rows('testFeedback'),
      rows('submission'),
      rows('aiHireAssignment'),
      rows('aiHireInterview'),
      rows('aiHireAnswer'),
      rows('emailLog'),
    ]);
    const { notes, ...collegeDetails } = college;
    const data = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.email || '',
      college: isSuperAdmin(req.user) ? college : collegeDetails,
      counts: {
        students: users.filter((user) => user.role !== 'ADMIN').length,
        admins: users.filter((user) => user.role === 'ADMIN').length,
        tests: tests.length,
        attempts: attempts.length,
        results: results.length,
        feedback: feedback.length,
        practiceSubmissions: submissions.length,
        aiInterviewAssignments: aiAssignments.length,
        aiInterviews: aiInterviews.length,
        aiAnswers: aiAnswers.length,
        emailLogs: emails.length,
      },
      students: users.filter((user) => user.role !== 'ADMIN'),
      admins: users.filter((user) => user.role === 'ADMIN'),
      tests,
      testAttempts: attempts,
      testResults: results,
      feedback,
      practiceSubmissions: submissions,
      aiInterviewAssignments: aiAssignments,
      aiInterviews,
      aiInterviewAnswers: aiAnswers,
      emailLogs: emails,
    };
    const fileName = `${String(college.code || college.name).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// ── Invite link ──────────────────────────────────────────────────────────────

// POST /api/colleges/:id/invite { enabled?: boolean, regenerate?: true } — turn the link on/off or
// make a new code (the old link stops working). Main admin or that college's admin.
exports.updateInvite = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    let college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const data = { updatedAt: new Date() };
    if (typeof req.body?.enabled === 'boolean') data.inviteEnabled = req.body.enabled;
    if (req.body?.regenerate) data.inviteCode = await newInviteCode(college);
    college = await withInviteCode(await prisma.college.update({ where: { id: collegeId }, data }));
    return res.json({ inviteCode: college.inviteCode, inviteEnabled: college.inviteEnabled !== false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

async function collegeByInvite(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,30}$/.test(clean)) return null;
  return prisma.college.findFirst({ where: { inviteCode: clean } });
}

// GET /api/colleges/join/:code — public: which college an invite link is for.
exports.invitePreview = async (req, res) => {
  try {
    const college = await collegeByInvite(req.params.code);
    if (!college) return res.status(404).json({ error: 'This invite link is not valid. Ask your college for the correct link.' });
    if (college.inviteEnabled === false) return res.status(410).json({ error: `${college.name} has turned this invite link off. Ask your college for a new one.` });
    return res.json({ college: { name: college.name, city: college.city || '' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// POST /api/colleges/join { code } — the signed-in student joins the college of that invite code.
exports.joinWithCode = async (req, res) => {
  try {
    if (req.user.role !== 'USER') return res.status(400).json({ error: 'Only student accounts can join a college.' });
    const college = await collegeByInvite(req.body?.code);
    if (!college) return res.status(404).json({ error: 'This college code is not valid. Check it with your college.' });
    if (college.inviteEnabled === false) return res.status(410).json({ error: `${college.name} has turned this invite off. Ask your college for a new code.` });
    const current = String(req.user.collegeId || '');
    if (current === college.id) return res.json({ joined: true, already: true, college: { id: college.id, name: college.name } });
    if (current) {
      const other = await prisma.college.findUnique({ where: { id: current } });
      return res.status(409).json({ error: `Your account is already in ${other?.name || 'another college'}. Ask the ScholarLogic team to move you.` });
    }
    await joinCollege([req.user.id], college.id);
    await prisma.collegeRoster.updateMany({ where: { collegeId: college.id, email: String(req.user.email || '').toLowerCase() }, data: { joinedUserId: req.user.id, joinedAt: new Date() } });
    return res.json({ joined: true, college: { id: college.id, name: college.name } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// ── Uploaded class list ──────────────────────────────────────────────────────

const ROSTER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/colleges/:id/roster { students: [{ name, email, usn }] }
// Students already on DevOrbit join now; the rest join automatically when they sign up with that
// email or USN. Main admin or that college's admin.
exports.uploadRoster = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return res.status(404).json({ error: 'College not found.' });
    const rows = Array.isArray(req.body?.students) ? req.body.students.slice(0, 5000) : [];
    if (!rows.length) return res.status(400).json({ error: 'The file has no students. It needs an Email or USN column.' });

    const seen = new Set();
    const entries = [];
    let invalid = 0;
    rows.forEach((row) => {
      const email = String(row?.email || '').trim().toLowerCase();
      const usn = String(row?.usn || '').trim().toUpperCase();
      const name = String(row?.name || '').trim().slice(0, 120);
      const validEmail = ROSTER_EMAIL.test(email) ? email : '';
      if (!validEmail && !usn) { invalid += 1; return; }
      const key = validEmail || `usn:${usn}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({ email: validEmail, usn, name });
    });

    const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true, email: true, usn: true, collegeId: true } });
    const byEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));
    const byUsn = new Map(users.filter((user) => user.usn).map((user) => [String(user.usn).toUpperCase(), user]));

    const toJoin = [];
    let alreadyIn = 0;
    let inOtherCollege = 0;
    let waiting = 0;
    const rosterRows = [];
    entries.forEach((entry) => {
      const user = (entry.email && byEmail.get(entry.email)) || (entry.usn && byUsn.get(entry.usn)) || null;
      let joinedUserId = null;
      if (user) {
        if (String(user.collegeId || '') === collegeId) { alreadyIn += 1; joinedUserId = user.id; }
        else if (user.collegeId && !isSuperAdmin(req.user)) inOtherCollege += 1;
        else { toJoin.push(user.id); joinedUserId = user.id; }
      } else {
        waiting += 1;
      }
      rosterRows.push({ ...entry, joinedUserId });
    });

    await joinCollege(toJoin, collegeId);

    // Remember the whole list, so students who sign up later join automatically.
    const roster = await prisma.collegeRoster.collection();
    const now = new Date();
    for (const row of rosterRows) {
      const filter = row.email ? { collegeId, email: row.email } : { collegeId, usn: row.usn, email: '' };
      await roster.updateOne(filter, {
        $set: { ...row, collegeId, updatedAt: now, ...(row.joinedUserId ? { joinedAt: now } : {}) },
        $setOnInsert: { createdAt: now, addedBy: req.user.email || '' },
      }, { upsert: true });
    }

    return res.json({
      total: entries.length,
      joinedNow: toJoin.length,
      alreadyIn,
      waitingToSignUp: waiting,
      inOtherCollege,
      invalid,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/colleges/:id/roster — the uploaded list with who has joined and who has not signed up yet.
exports.listRoster = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const rows = await prisma.collegeRoster.findMany({ where: { collegeId }, orderBy: [{ createdAt: 'desc' }] });
    const members = new Set((await prisma.user.findMany({ where: { collegeId }, select: { id: true } })).map((user) => user.id));
    const list = rows.map((row) => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
      usn: row.usn || '',
      status: row.joinedUserId && members.has(String(row.joinedUserId)) ? 'joined' : row.joinedUserId ? 'left' : 'waiting',
    }));
    return res.json({
      roster: list,
      counts: {
        total: list.length,
        joined: list.filter((row) => row.status === 'joined').length,
        waiting: list.filter((row) => row.status === 'waiting').length,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// DELETE /api/colleges/:id/roster — clears the students still waiting to sign up from the list.
exports.clearWaitingRoster = async (req, res) => {
  try {
    const collegeId = String(req.params.id);
    if (!canManageCollegeStudents(req.user, collegeId)) return res.status(404).json({ error: 'College not found.' });
    const result = await (await prisma.collegeRoster.collection()).deleteMany({ collegeId, $or: [{ joinedUserId: null }, { joinedUserId: { $exists: false } }] });
    return res.json({ removed: result.deletedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// Called after a student signs up: if a college uploaded a list with their email or USN, they join it.
exports.joinFromRoster = async (user) => {
  try {
    if (!user || user.collegeId) return null;
    const email = String(user.email || '').toLowerCase();
    const usn = String(user.usn || '').trim().toUpperCase();
    const roster = await prisma.collegeRoster.collection();
    const match = await roster.findOne({
      $and: [
        { $or: [{ joinedUserId: null }, { joinedUserId: { $exists: false } }] },
        { $or: [...(email ? [{ email }] : []), ...(usn ? [{ usn }] : [])] },
      ],
    });
    if (!match) return null;
    const college = await prisma.college.findUnique({ where: { id: String(match.collegeId) } });
    if (!college) return null;
    await joinCollege([user.id], college.id);
    await roster.updateOne({ _id: match._id }, { $set: { joinedUserId: String(user.id), joinedAt: new Date() } });
    return college.id;
  } catch (err) {
    console.error('joinFromRoster failed', err);
    return null;
  }
};
