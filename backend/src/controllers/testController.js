const prisma = require('../prismaClient');
const { normalizeDifficulty, serializeProblem, toClientDifficulty } = require('../lib/problemHelpers');
const { buildAssignmentReport } = require('../lib/testReportService');

// A test can be started again after it ends. Only attempts/submissions made since the
// current start count, so students get a fresh attempt each time the admin restarts it.
function inCurrentRun(record, assignment, field = 'startedAt') {
  if (!record) return false;
  if (!assignment?.startsAt) return true;
  return new Date(record[field]).getTime() >= new Date(assignment.startsAt).getTime();
}

function serializeAssignment(assignment, problems = [], attempt = null) {
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
    attempt,
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

async function notifyStudents({ type, title, message, assignmentId }) {
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
          type,
          title,
          message,
          assignmentId,
        },
      })),
    );
  }

  return students.length;
}

// The DB wrapper's updates are read-then-write, so activation runs one at a time
// to avoid going live (and notifying students) twice for the same test.
let activationInFlight = null;

async function activateScheduledAssignments() {
  if (activationInFlight) return activationInFlight;

  activationInFlight = (async () => {
    const now = new Date();
    const due = await prisma.testAssignment.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { lte: now },
      },
    });

    for (const assignment of due) {
      // The whole window passed while the server was down: end it without telling students it started.
      if (assignment.endsAt && new Date(assignment.endsAt) <= now) {
        await prisma.testAssignment.update({
          where: { id: assignment.id },
          data: { status: 'ENDED' },
        });
        continue;
      }

      await prisma.testAssignment.update({
        where: { id: assignment.id },
        data: { status: 'LIVE' },
      });
      await notifyStudents({
        type: 'TEST_STARTED',
        title: `Test started: ${assignment.title}`,
        message: `Your assigned coding test "${assignment.title}" is now live. The timer has started.`,
        assignmentId: assignment.id,
      });
    }
  })();

  try {
    await activationInFlight;
  } finally {
    activationInFlight = null;
  }
}

async function refreshAssignmentStatuses() {
  await activateScheduledAssignments();
  await closeExpiredAssignments();
}

async function loadAssignmentsWithProblems(where = {}, options = {}) {
  const assignments = await prisma.testAssignment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  const uniqueProblemIds = [...new Set(assignments.flatMap((assignment) => assignment.problemIds || []))];
  const problems = uniqueProblemIds.length
    ? await prisma.problem.findMany({ where: { id: { in: uniqueProblemIds } } })
    : [];
  const problemsById = new Map(problems.map((problem) => [problem.id, problem]));
  const attempts = options.userId && assignments.length
    ? await prisma.testAttempt.findMany({
      where: {
        userId: options.userId,
        assignmentId: { in: assignments.map((assignment) => assignment.id) },
      },
      orderBy: [{ startedAt: 'desc' }],
    })
    : [];
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const attemptByAssignmentId = new Map();
  attempts.forEach((attempt) => {
    if (!inCurrentRun(attempt, assignmentById.get(attempt.assignmentId))) return;
    if (!attemptByAssignmentId.has(attempt.assignmentId)) {
      attemptByAssignmentId.set(attempt.assignmentId, attempt);
    }
  });

  return assignments.map((assignment) => {
    const orderedProblems = (assignment.problemIds || [])
      .map((problemId) => problemsById.get(problemId))
      .filter(Boolean)
      .map((problem) => serializeProblem(problem, { includeContent: true, isCandidate: Boolean(options.isCandidate) }));

    return serializeAssignment(assignment, orderedProblems, attemptByAssignmentId.get(assignment.id) || null);
  });
}

exports.list = async (req, res) => {
  try {
    await refreshAssignmentStatuses();
    const isCandidate = req.user?.role !== 'ADMIN' && req.user?.role !== 'SETTER';
    const assignments = await loadAssignmentsWithProblems({}, { isCandidate });
    return res.json({ assignments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.active = async (req, res) => {
  try {
    await refreshAssignmentStatuses();
    const isCandidate = req.user?.role !== 'ADMIN' && req.user?.role !== 'SETTER';
    const assignments = await loadAssignmentsWithProblems(
      { status: 'LIVE' },
      req.user?.role === 'USER' ? { isCandidate, userId: req.user.id } : { isCandidate },
    );
    const upcoming = await prisma.testAssignment.findMany({ where: { status: 'SCHEDULED' } });
    const nextStartsAt = upcoming
      .map((assignment) => new Date(assignment.startsAt).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    return res.json({
      assignment: assignments[0] || null,
      assignments,
      nextStartsAt: nextStartsAt ? new Date(nextStartsAt).toISOString() : null,
    });
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
    await refreshAssignmentStatuses();

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

    const notifiedStudents = await notifyStudents({
      type: 'TEST_STARTED',
      title: `Test started: ${startedAssignment.title}`,
      message: `Your assigned coding test "${startedAssignment.title}" is now live. The timer has started.`,
      assignmentId: startedAssignment.id,
    });

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: startedAssignment.id });
    return res.json({
      assignment: fullAssignment,
      notifiedStudents,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.schedule = async (req, res) => {
  try {
    await refreshAssignmentStatuses();

    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });
    if (!assignment.problemIds?.length) {
      return res.status(400).json({ error: 'assignment must contain at least one problem' });
    }
    if (assignment.status === 'LIVE') {
      return res.status(400).json({ error: 'this test is already live' });
    }

    const startsAt = new Date(req.body?.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ error: 'valid start date and time required' });
    }
    if (startsAt.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'start time must be in the future; use Start Now to begin immediately' });
    }

    // The duration stays what the admin set (each student's time). An optional end time only
    // closes the window in which students can take the test.
    let endsAt = new Date(startsAt.getTime() + (assignment.durationMinutes * 60 * 1000));
    if (req.body?.endsAt) {
      endsAt = new Date(req.body.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return res.status(400).json({ error: 'valid end date and time required' });
      }
      if (endsAt.getTime() <= startsAt.getTime()) {
        return res.status(400).json({ error: 'end time must be after the start time' });
      }
    }

    const scheduledAssignment = await prisma.testAssignment.update({
      where: { id },
      data: {
        status: 'SCHEDULED',
        startsAt,
        endsAt,
      },
    });

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: scheduledAssignment.id });
    return res.json({ assignment: fullAssignment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.unschedule = async (req, res) => {
  try {
    await refreshAssignmentStatuses();

    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });
    if (assignment.status !== 'SCHEDULED') {
      return res.status(400).json({ error: 'only a scheduled test can be cancelled' });
    }

    const draftAssignment = await prisma.testAssignment.update({
      where: { id },
      data: {
        status: 'DRAFT',
        startsAt: null,
        endsAt: null,
      },
    });

    const [fullAssignment] = await loadAssignmentsWithProblems({ id: draftAssignment.id });
    return res.json({ assignment: fullAssignment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// GET /api/tests/:id/info — what a shared test link should do for this student
// (no questions included, so it is safe for scheduled tests too).
exports.info = async (req, res) => {
  try {
    await refreshAssignmentStatuses();

    const assignment = await prisma.testAssignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ error: 'test not found' });

    const latest = await getAttemptOrNull(assignment.id, req.user.id);
    const attempt = inCurrentRun(latest, assignment) ? latest : null;

    return res.json({
      test: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        durationMinutes: assignment.durationMinutes,
        questionCount: Array.isArray(assignment.problemIds) ? assignment.problemIds.length : 0,
        attemptStatus: attempt?.status || null,
        attemptUsed: Boolean(attempt && attempt.status !== 'IN_PROGRESS'),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

// DELETE /api/tests/:id — removes a test and everything recorded for it
// (attempts, submitted answers/scores, notifications, feedback). Live tests must be stopped first.
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'test not found' });
    if (assignment.status === 'LIVE') {
      return res.status(400).json({ error: 'stop the live test before deleting it' });
    }

    const where = { assignmentId: id };
    const [attempts, submissions, notifications, feedback] = await Promise.all([
      prisma.testAttempt.deleteMany({ where }),
      prisma.assessmentSubmission.deleteMany({ where }),
      prisma.notification.deleteMany({ where }),
      prisma.testFeedback.deleteMany({ where }),
    ]);
    await prisma.testAssignment.delete({ where: { id } });

    return res.json({
      deleted: true,
      removed: {
        attempts: attempts.count,
        submissions: submissions.count,
        notifications: notifications.count,
        feedback: feedback.count,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.refreshAssignmentStatuses = refreshAssignmentStatuses;
exports.inCurrentRun = inCurrentRun;

exports.stop = async (req, res) => {
  try {
    await refreshAssignmentStatuses();

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
    if (assignment.status !== 'LIVE') {
      return res.status(400).json({ error: 'test assignment is not currently live' });
    }

    const now = new Date();
    const durationMs = (assignment.durationMinutes || 60) * 60 * 1000;
    const endsAt = assignment.endsAt ? new Date(assignment.endsAt).toISOString() : new Date(now.getTime() + durationMs).toISOString();

    const latest = await getAttemptOrNull(id, req.user.id);
    const existing = inCurrentRun(latest, assignment) ? latest : null;
    if (existing) {
      if (existing.status === 'IN_PROGRESS') {
        return res.json({ attempt: { ...existing, endsAt } });
      }
      return res.status(409).json({
        error: 'test already attempted by this user',
        attempt: { ...existing, endsAt },
      });
    }

    const attempt = await prisma.testAttempt.create({
      data: {
        assignmentId: id,
        userId: req.user.id,
        startedAt: now,
        status: 'IN_PROGRESS',
      },
    });
    return res.status(201).json({ attempt: { ...attempt, endsAt } });
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
