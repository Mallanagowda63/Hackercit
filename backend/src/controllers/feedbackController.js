const prisma = require('../prismaClient');

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
    if (!assignment) return res.status(404).json({ error: 'test not found' });

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

// GET /api/tests/:id/feedback — all feedback for a test (admin only).
exports.listFeedback = async (req, res) => {
  try {
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
