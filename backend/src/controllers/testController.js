const prisma = require('../prismaClient');
const { normalizeDifficulty, serializeProblem, toClientDifficulty } = require('../lib/problemHelpers');
const { buildAssignmentReport } = require('../lib/testReportService');

function serializeAssignment(assignment, problems = []) {
  return {
    id: assignment.id,
    title: assignment.title,
    difficulty: assignment.difficulty ? toClientDifficulty(assignment.difficulty) : null,
    dbDifficulty: assignment.difficulty || null,
    durationMinutes: assignment.durationMinutes,
    status: assignment.status,
    problemIds: assignment.problemIds || [],
    questionCount: Array.isArray(assignment.problemIds) ? assignment.problemIds.length : 0,
    createdById: assignment.createdById,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    problems,
  };
}

async function closeExpiredAssignments() {
  const now = new Date();
  await prisma.testAssignment.updateMany({
    where: {
      status: 'LIVE',
      endsAt: { lt: now },
    },
    data: {
      status: 'ENDED',
    },
  });
}

async function loadAssignmentsWithProblems(where = {}) {
  const assignments = await prisma.testAssignment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  const uniqueProblemIds = [...new Set(assignments.flatMap((assignment) => assignment.problemIds || []))];
  const problems = uniqueProblemIds.length
    ? await prisma.problem.findMany({ where: { id: { in: uniqueProblemIds } } })
    : [];
  const problemsById = new Map(problems.map((problem) => [problem.id, problem]));

  return assignments.map((assignment) => {
    const orderedProblems = (assignment.problemIds || [])
      .map((problemId) => problemsById.get(problemId))
      .filter(Boolean)
      .map((problem) => serializeProblem(problem, { includeContent: true }));

    return serializeAssignment(assignment, orderedProblems);
  });
}

exports.list = async (req, res) => {
  try {
    await closeExpiredAssignments();
    const assignments = await loadAssignmentsWithProblems();
    return res.json({ assignments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.active = async (req, res) => {
  try {
    await closeExpiredAssignments();
    const assignments = await loadAssignmentsWithProblems({ status: 'LIVE' });
    return res.json({ assignment: assignments[0] || null, assignments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const durationMinutes = Math.max(1, Number(req.body?.durationMinutes || req.body?.duration || 0));
    const difficulty = req.body?.difficulty ? normalizeDifficulty(req.body.difficulty) : null;
    const rawProblemIds = Array.isArray(req.body?.problemIds) ? req.body.problemIds : [];
    const problemIds = rawProblemIds
      .map((problemId) => String(problemId || '').trim())
      .filter(Boolean);

    if (!title) return res.status(400).json({ error: 'title required' });
    if (!problemIds.length) return res.status(400).json({ error: 'at least one problem is required' });
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
      return res.status(400).json({ error: 'valid duration required' });
    }

    const availableProblems = await prisma.problem.findMany({
      where: { id: { in: problemIds } },
      select: { id: true },
    });
    if (availableProblems.length !== problemIds.length) {
      return res.status(400).json({ error: 'one or more selected problems do not exist' });
    }

    const assignment = await prisma.testAssignment.create({
      data: {
        title,
        difficulty,
        durationMinutes,
        problemIds,
        createdById: req.user.id,
      },
    });

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: assignment.id });
    return res.status(201).json({ assignment: fullAssignment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.start = async (req, res) => {
  try {
    await closeExpiredAssignments();

    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });
    if (!assignment.problemIds?.length) {
      return res.status(400).json({ error: 'assignment must contain at least one problem' });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + (assignment.durationMinutes * 60 * 1000));

    const startedAssignment = await prisma.testAssignment.update({
      where: { id },
      data: {
        status: 'LIVE',
        startsAt: now,
        endsAt,
      },
    });

    const students = await prisma.user.findMany({
      where: {
        role: 'USER',
        loginCount: { gt: 0 },
      },
      select: { id: true },
    });

    if (students.length) {
      await prisma.$transaction(
        students.map((student) => prisma.notification.create({
          data: {
            userId: student.id,
            type: 'TEST_STARTED',
            title: `Test started: ${startedAssignment.title}`,
            message: `Your assigned coding test "${startedAssignment.title}" is now live. The timer has started.`,
            assignmentId: startedAssignment.id,
          },
        })),
      );
    }

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: startedAssignment.id });
    return res.json({
      assignment: fullAssignment,
      notifiedStudents: students.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.stop = async (req, res) => {
  try {
    await closeExpiredAssignments();

    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });
    if (assignment.status !== 'LIVE') {
      return res.status(400).json({ error: 'only a live test can be stopped' });
    }

    const now = new Date();
    const stoppedAssignment = await prisma.testAssignment.update({
      where: { id },
      data: {
        status: 'ENDED',
        endsAt: now,
      },
    });

    const students = await prisma.user.findMany({
      where: {
        role: 'USER',
        loginCount: { gt: 0 },
      },
      select: { id: true },
    });

    if (students.length) {
      await prisma.$transaction(
        students.map((student) => prisma.notification.create({
          data: {
            userId: student.id,
            type: 'TEST_ENDED',
            title: `Test stopped: ${stoppedAssignment.title}`,
            message: `The coding test "${stoppedAssignment.title}" has been stopped by the admin.`,
            assignmentId: stoppedAssignment.id,
          },
        })),
      );
    }

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: stoppedAssignment.id });
    return res.json({
      assignment: fullAssignment,
      notifiedStudents: students.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

async function getAttemptOrNull(assignmentId, userId) {
  return prisma.testAttempt.findFirst({
    where: { assignmentId, userId },
    orderBy: [{ startedAt: 'desc' }],
  });
}

exports.startAttempt = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });

    const existing = await getAttemptOrNull(id, req.user.id);
    if (existing && existing.status === 'IN_PROGRESS') {
      return res.json({ attempt: existing });
    }

    const attempt = await prisma.testAttempt.create({
      data: {
        assignmentId: id,
        userId: req.user.id,
        startedAt: new Date(),
      },
    });
    return res.status(201).json({ attempt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.recordInterruption = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || 'Security interruption').trim();
    const attempt = await getAttemptOrNull(id, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'attempt not found' });

    const interruptions = Array.isArray(attempt.interruptions) ? attempt.interruptions : [];
    const nextAttempt = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        interruptionCount: Number(attempt.interruptionCount || 0) + 1,
        interruptions: [
          ...interruptions,
          { reason, at: new Date().toISOString() },
        ],
      },
    });
    return res.json({ attempt: nextAttempt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.finishAttempt = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || 'Submitted').trim();
    const interrupted = Boolean(req.body?.interrupted);
    const attempt = await getAttemptOrNull(id, req.user.id);
    if (!attempt) return res.status(404).json({ error: 'attempt not found' });

    const finishedAttempt = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        finishedAt: new Date(),
        status: interrupted ? 'INTERRUPTED' : 'COMPLETED',
        finishReason: reason,
      },
    });
    return res.json({ attempt: finishedAttempt });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.report = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });
    const report = await buildAssignmentReport(assignment);
    return res.json({ report });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
