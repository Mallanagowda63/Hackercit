const prisma = require('../prismaClient');
const { canAccessCollege, scopedAssignmentIds } = require('../lib/collegeScope');

// Feedback in the admin's scope (their college's tests; every test for the super admin).
async function scopedFeedback(req, where = {}, orderBy = undefined) {
  const [feedback, testIds] = await Promise.all([
    prisma.testFeedback.findMany({ where, ...(orderBy ? { orderBy } : {}) }),
    scopedAssignmentIds(req),
  ]);
  return testIds ? feedback.filter((entry) => testIds.has(String(entry.assignmentId))) : feedback;
}

const MAX_COMMENT_LENGTH = 1000;

// POST /api/tests/:id/feedback — a student's rating (1-5) and optional comment after a test.
// One feedback per student per test; sending again replaces the earlier one.
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || '').trim().slice(0, MAX_COMMENT_LENGTH);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a whole number from 1 to 5' });
    }

    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment || !canAccessCollege(req.user, assignment.collegeId)) return res.status(404).json({ error: 'test not found' });

    const existing = await prisma.testFeedback.findFirst({
      where: { assignmentId: id, userId: req.user.id },
    });

    const data = {
      rating,
      comment,
      assignmentTitle: assignment.title,
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      updatedAt: new Date(),
      // New or changed feedback shows up as "new" in the admin Feedback tab.
      seenByAdmin: false,
    };

    const feedback = existing
      ? await prisma.testFeedback.update({ where: { id: existing.id }, data })
      : await prisma.testFeedback.create({ data: { ...data, assignmentId: id, userId: req.user.id } });

    return res.status(existing ? 200 : 201).json({ feedback: { id: feedback.id, rating, comment } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

function averageOf(feedback) {
  const ratings = feedback.map((entry) => Number(entry.rating)).filter(Number.isFinite);
  return ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
    : null;
}

// GET /api/admin/feedback — every student's test feedback, newest first (admin only).
// Feedback the admin hasn't marked as seen has isNew: true.
exports.listAllFeedback = async (req, res) => {
  try {
    const feedback = await scopedFeedback(req, {}, { updatedAt: 'desc' });
    const userIds = [...new Set(feedback.map((entry) => String(entry.userId || '')).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, usn: true, department: true },
      })
      : [];
    const usersById = new Map(users.map((user) => [String(user.id), user]));

    const rows = feedback.map((entry) => {
      const user = usersById.get(String(entry.userId)) || {};
      return {
        id: entry.id,
        assignmentId: entry.assignmentId,
        testTitle: entry.assignmentTitle || 'Test',
        rating: Number(entry.rating) || null,
        comment: entry.comment || '',
        userId: entry.userId,
        name: user.name || entry.userName || String(user.email || entry.userEmail || '').split('@')[0] || 'Student',
        email: user.email || entry.userEmail || '',
        usn: user.usn || '',
        department: user.department || '',
        createdAt: entry.createdAt || null,
        updatedAt: entry.updatedAt || entry.createdAt || null,
        isNew: entry.seenByAdmin !== true,
      };
    });

    return res.json({
      feedback: rows,
      count: rows.length,
      newCount: rows.filter((row) => row.isNew).length,
      averageRating: averageOf(feedback),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load feedback.' });
  }
};

// GET /api/admin/feedback/new-count — just the number of unseen feedback (for the tab badge).
exports.newFeedbackCount = async (req, res) => {
  try {
    const unseen = await scopedFeedback(req, { seenByAdmin: { not: true } });
    return res.json({ newCount: unseen.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load feedback.' });
  }
};

// POST /api/admin/feedback/mark-seen — body { ids?: string[] }. Without ids, marks everything seen.
exports.markFeedbackSeen = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : null;
    const allowed = (await scopedFeedback(req, ids ? { id: { in: ids } } : { seenByAdmin: { not: true } })).map((entry) => entry.id);
    const result = allowed.length
      ? await prisma.testFeedback.updateMany({ where: { id: { in: allowed } }, data: { seenByAdmin: true } })
      : { count: 0 };
    return res.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to update feedback.' });
  }
};

// GET /api/tests/:id/feedback — all feedback for a test (admin only).
exports.listFeedback = async (req, res) => {
  try {
    const assignment = await prisma.testAssignment.findUnique({ where: { id: req.params.id } });
    if (!assignment || !canAccessCollege(req.user, assignment.collegeId)) return res.status(404).json({ error: 'test not found' });
    const feedback = await prisma.testFeedback.findMany({ where: { assignmentId: req.params.id } });
    const ratings = feedback.map((entry) => Number(entry.rating)).filter(Number.isFinite);
    const averageRating = ratings.length
      ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
      : null;
    return res.json({ feedback, averageRating, count: feedback.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
