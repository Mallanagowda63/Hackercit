// Colleges (partner colleges) on top of DevOrbit's normal students.
//
// - General students have no college. They and their tests work exactly as before colleges
//   existed, and they never see anything about colleges.
// - A partner college's students are added to it by that college's admin (or the main admin).
//   From then on they see that college's name and only that college's tests and leaderboard.
// - The main admin (ADMIN_EMAIL) sees everything. The admin panel sends the group being viewed
//   in the `X-College-Id` header: "general" (default), a college id, or "all".
// - A college admin (role ADMIN with a collegeId) only ever sees and changes their own college.
const { ObjectId } = require('mongodb');
const prisma = require('../prismaClient');
const { isDesignatedAdmin } = require('./adminConfig');

const COLLEGE_HEADER = 'x-college-id';
const GENERAL = 'general';

// The group a record or user belongs to: its college id, or "general" when it has none.
function collegeKey(collegeId) {
  return collegeId ? String(collegeId) : GENERAL;
}

function isSuperAdmin(user) {
  return isDesignatedAdmin(user);
}

function isCollegeAdmin(user) {
  return String(user?.role || '').toUpperCase() === 'ADMIN' && !isSuperAdmin(user) && Boolean(user?.collegeId);
}

// The group an admin request is limited to: a college id, "general", or null for everything
// (main admin with "all" picked).
function scopeCollegeId(req) {
  const user = req.user;
  if (isSuperAdmin(user)) {
    const picked = String(req.headers?.[COLLEGE_HEADER] || req.query?.college || '').trim();
    if (picked === 'all') return null;
    return picked || GENERAL;
  }
  return collegeKey(user?.collegeId);
}

// Can this user see / change a record of that college? The main admin always can; everyone else
// only within their own group (general students with general records, college with college).
function canAccessCollege(user, collegeId) {
  if (isSuperAdmin(user)) return true;
  return collegeKey(user?.collegeId) === collegeKey(collegeId);
}

// Filters records with a `collegeId` field down to the request's scope.
function filterByScope(req, records, field = 'collegeId') {
  const scope = scopeCollegeId(req);
  if (scope === null) return records;
  return records.filter((record) => collegeKey(record?.[field]) === scope);
}

// The college a test or AI interview created by this admin belongs to. College admins always
// create for their own college. The main admin creates for the college being viewed, or for
// general students when "General students" or "All" is picked.
async function resolveNewRecordCollege(req, explicit) {
  if (!isSuperAdmin(req.user)) {
    return req.user?.collegeId ? { collegeId: String(req.user.collegeId) } : { error: 'Your admin account has no college.' };
  }
  const picked = String(explicit || '').trim() || scopeCollegeId(req);
  if (!picked || picked === GENERAL || picked === 'all') return { collegeId: null };
  if (!(await collegeExists(picked))) return { error: 'That college no longer exists. Pick another one at the top of the admin panel.' };
  return { collegeId: picked };
}

// Ids of students in the request's scope, or null when the scope is everything.
async function scopedStudentIds(req) {
  if (scopeCollegeId(req) === null) return null;
  const users = filterByScope(req, await prisma.user.findMany({ select: { id: true, collegeId: true } }));
  return new Set(users.map((user) => user.id));
}

// Ids of tests in the request's scope, or null when the scope is everything.
async function scopedAssignmentIds(req) {
  if (scopeCollegeId(req) === null) return null;
  const tests = filterByScope(req, await prisma.testAssignment.findMany({ select: { id: true, collegeId: true } }));
  return new Set(tests.map((test) => test.id));
}

// ── Colleges collection ─────────────────────────────────────────────────────

let collegeCache = { at: 0, list: null };

function invalidateColleges() {
  collegeCache = { at: 0, list: null };
}

async function listColleges() {
  if (collegeCache.list && Date.now() - collegeCache.at < 30000) return collegeCache.list;
  const list = await prisma.college.findMany({ orderBy: [{ name: 'asc' }] });
  collegeCache = { at: Date.now(), list };
  return list;
}

async function collegeExists(id) {
  if (!id) return false;
  return (await listColleges()).some((college) => college.id === String(id));
}

// On every start: stamp the college on records of college students/tests that do not carry it
// yet, and keep the collegeId indexes. General students and their records are never touched.
async function ensureColleges() {
  await backfillRecordColleges();
  await ensureCollegeIndexes();
  invalidateColleges();
}

const MISSING_COLLEGE = { $or: [{ collegeId: { $exists: false } }, { collegeId: null }, { collegeId: '' }] };

// Ids can be stored as hex strings or ObjectIds; match both.
function idForms(ids) {
  return ids.flatMap((id) => (/^[0-9a-f]{24}$/i.test(String(id)) ? [String(id), new ObjectId(String(id))] : [String(id)]));
}

// Records about a test belong to the test's college; personal records to the student's college.
const TEST_RECORDS = ['testAttempt', 'assessmentSubmission', 'testFeedback'];
const STUDENT_RECORDS = ['submission', 'aiHireInterview', 'aiHireAnswer', 'testFeedback', 'notification'];

// Stamps collegeId on older records that were saved before every record carried one. Safe to run
// on every start: it only touches records that have no college yet.
async function backfillRecordColleges() {
  const counts = {};
  const add = (name, n) => { if (n) counts[name] = (counts[name] || 0) + n; };

  const tests = (await prisma.testAssignment.findMany({ select: { id: true, collegeId: true } })).filter((test) => test.collegeId);
  const testsByCollege = new Map();
  tests.forEach((test) => testsByCollege.set(String(test.collegeId), [...(testsByCollege.get(String(test.collegeId)) || []), test.id]));
  for (const name of TEST_RECORDS) {
    const collection = await prisma[name].collection();
    for (const [collegeId, ids] of testsByCollege) {
      const result = await collection.updateMany({ ...MISSING_COLLEGE, assignmentId: { $in: idForms(ids) } }, { $set: { collegeId } });
      add(name, result.modifiedCount);
    }
  }

  const users = (await prisma.user.findMany({ select: { id: true, collegeId: true } })).filter((user) => user.collegeId);
  const usersByCollege = new Map();
  users.forEach((user) => usersByCollege.set(String(user.collegeId), [...(usersByCollege.get(String(user.collegeId)) || []), user.id]));
  for (const name of STUDENT_RECORDS) {
    const collection = await prisma[name].collection();
    for (const [collegeId, ids] of usersByCollege) {
      const result = await collection.updateMany({ ...MISSING_COLLEGE, userId: { $in: idForms(ids) } }, { $set: { collegeId } });
      add(name, result.modifiedCount);
    }
  }

  // Email logs list who they went to; record which college(s) that was.
  const userCollege = new Map(users.map((user) => [String(user.id), String(user.collegeId)]));
  const emailLogs = await prisma.emailLog.collection();
  const unstamped = await emailLogs.find({ collegeIds: { $exists: false } }, { projection: { _id: 1, userIds: 1 } }).toArray();
  for (const log of unstamped) {
    const collegeIds = [...new Set((log.userIds || []).map((id) => userCollege.get(String(id))).filter(Boolean))];
    await emailLogs.updateOne({ _id: log._id }, { $set: { collegeIds, collegeId: collegeIds.length === 1 ? collegeIds[0] : null } });
    add('emailLog', 1);
  }

  if (Object.keys(counts).length) console.log('Colleges: stamped college on older records', counts);
  return counts;
}

// Indexes so filtering by college stays fast as the data grows.
async function ensureCollegeIndexes() {
  const names = ['user', 'testAssignment', 'testAttempt', 'assessmentSubmission', 'testFeedback', 'submission',
    'aiHireInterview', 'aiHireAnswer', 'aiHireAssignment', 'emailLog', 'notification'];
  await Promise.all(names.map(async (name) => {
    try {
      await (await prisma[name].collection()).createIndex({ collegeId: 1 });
    } catch (error) {
      console.error(`Colleges: could not index ${name}.collegeId`, error.message);
    }
  }));
}

// Checks that every record sits in the same group (college or general) as its test or student.
async function checkCollegeSeparation() {
  const tests = await prisma.testAssignment.findMany({ select: { id: true, collegeId: true } });
  const testCollege = new Map(tests.map((test) => [String(test.id), collegeKey(test.collegeId)]));
  const users = await prisma.user.findMany({ select: { id: true, role: true, collegeId: true } });
  const userCollege = new Map(users.map((user) => [String(user.id), collegeKey(user.collegeId)]));
  const report = { mismatched: {}, crossCollegeAttempts: 0 };

  for (const name of TEST_RECORDS) {
    const rows = await (await prisma[name].collection()).find({}, { projection: { assignmentId: 1, userId: 1, collegeId: 1 } }).toArray();
    const forTests = rows.filter((row) => testCollege.has(String(row.assignmentId)));
    report.mismatched[name] = forTests.filter((row) => collegeKey(row.collegeId) !== testCollege.get(String(row.assignmentId))).length;
    if (name === 'testAttempt') {
      // Students who sat a test of another group (only possible if they were moved afterwards).
      report.crossCollegeAttempts = forTests.filter((row) => userCollege.has(String(row.userId)) && userCollege.get(String(row.userId)) !== testCollege.get(String(row.assignmentId))).length;
    }
  }
  for (const name of ['submission', 'aiHireInterview', 'aiHireAnswer']) {
    const rows = await (await prisma[name].collection()).find({}, { projection: { userId: 1, collegeId: 1 } }).toArray();
    report.mismatched[name] = rows.filter((row) => userCollege.has(String(row.userId)) && collegeKey(row.collegeId) !== userCollege.get(String(row.userId))).length;
  }

  report.generalStudents = users.filter((user) => user.role !== 'ADMIN' && !user.collegeId).length;
  report.collegeStudents = users.filter((user) => user.role !== 'ADMIN' && user.collegeId).length;
  report.ok = Object.values(report.mismatched).every((n) => n === 0);
  report.checkedAt = new Date().toISOString();
  return report;
}

module.exports = {
  COLLEGE_HEADER,
  GENERAL,
  collegeKey,
  resolveNewRecordCollege,
  isSuperAdmin,
  isCollegeAdmin,
  scopeCollegeId,
  canAccessCollege,
  filterByScope,
  scopedStudentIds,
  scopedAssignmentIds,
  listColleges,
  collegeExists,
  invalidateColleges,
  ensureColleges,
  backfillRecordColleges,
  checkCollegeSeparation,
  idForms,
  STUDENT_RECORDS,
};
