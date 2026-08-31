const prisma = require('../prismaClient');
const { executeSubmission } = require('../lib/executionService');
const { getBadgePresentation, resolveBadgeForSolvedCount, syncUserBadge } = require('../lib/badgeService');
const LEVEL_LABELS = {
  0: 'No Submission',
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};
const AVATAR_GRADIENTS = [
  ['#f6c453', '#ff8f5c'],
  ['#d9dde6', '#8f98a8'],
  ['#c88a56', '#8f5a3a'],
  ['#7c6af7', '#4fd1c5'],
  ['#56ccf2', '#2f80ed'],
  ['#ff7eb3', '#ff758c'],
  ['#11998e', '#38ef7d'],
  ['#f2994a', '#f2c94c'],
];

function parseRuntimeMs(runtime) {
  const match = String(runtime || '').match(/(\d+)/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveSubmissionStatus(tests) {
  const normalizedTests = Array.isArray(tests) ? tests : [];
  if (normalizedTests.length && normalizedTests.every((test) => test.status === 'pass')) {
    return 'ACCEPTED';
  }

  if (normalizedTests.some((test) => test.status === 'error')) {
    return 'RUNTIME_ERROR';
  }

  return 'WRONG_ANSWER';
}

function formatStudentName(user) {
  const explicitName = String(user?.name || '').trim();
  if (explicitName) return explicitName;

  const emailHandle = String(user?.email || '').split('@')[0];
  return emailHandle
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Student';
}

function getAvatarGradient(seed) {
  const hash = String(seed || '')
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function getDifficultyPriority(problem) {
  const difficulty = String(problem?.difficulty || '').toUpperCase();
  if (difficulty === 'HARD') return 3;
  if (difficulty === 'MEDIUM') return 2;
  if (difficulty === 'EASY') return 1;
  return 0;
}

function getDifficultyWeight(problem) {
  const priority = getDifficultyPriority(problem);
  if (priority === 3) return 50;
  if (priority === 2) return 35;
  if (priority === 1) return 20;
  return 15;
}

function formatPenalty(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '--';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function calculateTrend(submissions) {
  if (!submissions.length) return 0;
  if (submissions.some((submission) => submission.status === 'ACCEPTED')) return 1;
  if (submissions.some((submission) => submission.status === 'RUNTIME_ERROR')) return -1;
  return 0;
}

function calculateScopeMetrics(submissions, problemsById, options = {}) {
  const allowedProblemIds = Array.isArray(options.problemIds) ? new Set(options.problemIds) : null;
  const filtered = (submissions || [])
    .filter((submission) => !allowedProblemIds || allowedProblemIds.has(submission.problemId))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  const grouped = new Map();
  let highestLevel = 0;
  let lastActivityAt = 0;

  filtered.forEach((submission) => {
    const bucket = grouped.get(submission.problemId) || [];
    bucket.push(submission);
    grouped.set(submission.problemId, bucket);

    const problem = submission.problem || problemsById.get(submission.problemId);
    highestLevel = Math.max(highestLevel, getDifficultyPriority(problem));
    lastActivityAt = Math.max(lastActivityAt, new Date(submission.createdAt).getTime());
  });

  const defaultStart = filtered[0] ? new Date(filtered[0].createdAt).getTime() : 0;
  const referenceStart = options.assignmentStartAt
    ? new Date(options.assignmentStartAt).getTime()
    : defaultStart;

  let solved = 0;
  let acceptedWeight = 0;
  let penaltyMs = 0;

  grouped.forEach((entries, problemId) => {
    const accepted = entries.find((submission) => submission.status === 'ACCEPTED');
    if (!accepted) return;

    solved += 1;
    acceptedWeight += getDifficultyWeight(accepted.problem || problemsById.get(problemId));

    const acceptedAt = new Date(accepted.createdAt).getTime();
    const wrongBeforeAccepted = entries.filter((submission) => (
      new Date(submission.createdAt).getTime() < acceptedAt
      && submission.status !== 'ACCEPTED'
    )).length;

    penaltyMs += Math.max(0, acceptedAt - (referenceStart || acceptedAt));
    penaltyMs += wrongBeforeAccepted * 5 * 60 * 1000;
  });

  const totalPossibleWeight = allowedProblemIds
    ? [...allowedProblemIds].reduce(
      (total, problemId) => total + getDifficultyWeight(problemsById.get(problemId)),
      0,
    )
    : 0;
  const submissionLevel = LEVEL_LABELS[highestLevel] || LEVEL_LABELS[0];

  return {
    submissionCount: filtered.length,
    uniqueProblems: grouped.size,
    solved,
    acceptedWeight,
    penaltyMs: solved > 0 ? penaltyMs : Number.MAX_SAFE_INTEGER,
    timePenalty: solved > 0 ? formatPenalty(penaltyMs) : '--',
    submissionLevel,
    submissionLevelPriority: highestLevel,
    totalPossibleWeight,
    lastActivityAt,
    trend: calculateTrend(filtered),
  };
}

function buildScoreCard(student, submissions, problemsById, activeAssignment, assessmentSub = null, testAttempt = null) {
  const overallMetrics = calculateScopeMetrics(submissions, problemsById);
  const contestMetrics = activeAssignment?.problemIds?.length
    ? calculateScopeMetrics(submissions, problemsById, {
      problemIds: activeAssignment.problemIds,
      assignmentStartAt: activeAssignment.startsAt || null,
    })
    : overallMetrics;

  const maxScore = assessmentSub?.maxScore || testAttempt?.maxScore || (activeAssignment?.problemIds?.length ? activeAssignment.problemIds.length * 10 : 10);
  const contestScore = assessmentSub ? Number(assessmentSub.totalScore || 0) : (testAttempt ? Number(testAttempt.score || 0) : contestMetrics.acceptedWeight);
  const percentage = assessmentSub ? Number(assessmentSub.percentage || 0) : (testAttempt ? Number(testAttempt.percentage || 0) : 0);
  const contestSolved = assessmentSub?.details?.questions
    ? assessmentSub.details.questions.filter((q) => q.status === 'ACCEPTED' || q.status === 'Correct' || q.status === 'Passed' || (q.earnedMarks && q.earnedMarks > 0)).length
    : contestMetrics.solved;

  const startRef = testAttempt?.startsAt || activeAssignment?.startsAt || activeAssignment?.createdAt;
  const endRef = assessmentSub?.createdAt || testAttempt?.submittedAt || testAttempt?.finishedAt;
  const contestPenaltyMs = (startRef && endRef)
    ? Math.max(0, new Date(endRef).getTime() - new Date(startRef).getTime())
    : contestMetrics.penaltyMs;

  const contestTimePenalty = (startRef && endRef)
    ? formatPenalty(contestPenaltyMs)
    : contestMetrics.timePenalty;

  const contestLastActivityAt = assessmentSub ? new Date(assessmentSub.createdAt).getTime() : (testAttempt ? new Date(testAttempt.submittedAt || testAttempt.startedAt).getTime() : contestMetrics.lastActivityAt);

  const overallScore = overallMetrics.acceptedWeight;
  const globalScore = overallMetrics.acceptedWeight;
  const earnedBadge = resolveBadgeForSolvedCount(overallMetrics.solved);

  return {
    userId: student.id,
    username: formatStudentName(student),
    email: student.email,
    usn: student.usn || '',
    department: student.department || '',
    badgeTier: earnedBadge?.tier || student.badgeTier || null,
    badgeLabel: earnedBadge?.label || getBadgePresentation(student).badgeLabel,
    solvedProblemCount: overallMetrics.solved,
    rating: overallScore,
    avatarGradient: getAvatarGradient(student.email || student.id),
    contest: {
      rank: 0,
      score: contestScore,
      maxScore,
      percentage,
      problemsSolved: contestSolved,
      timePenalty: contestTimePenalty,
      trend: contestMetrics.trend,
      timePenaltyMs: contestPenaltyMs,
      submissionLevel: contestMetrics.submissionLevel,
      submissionLevelPriority: contestMetrics.submissionLevelPriority,
      lastActivityAt: contestLastActivityAt,
      submittedAt: assessmentSub ? assessmentSub.createdAt : (testAttempt ? testAttempt.submittedAt : null),
    },
    overall: {
      rank: 0,
      score: overallScore,
      problemsSolved: overallMetrics.solved,
      timePenalty: overallMetrics.timePenalty,
      trend: overallMetrics.trend,
      timePenaltyMs: overallMetrics.penaltyMs,
      submissionLevel: overallMetrics.submissionLevel,
      submissionLevelPriority: overallMetrics.submissionLevelPriority,
      lastActivityAt: overallMetrics.lastActivityAt,
    },
    global: {
      rank: 0,
      score: globalScore,
      problemsSolved: overallMetrics.solved,
      timePenalty: overallMetrics.timePenalty,
      trend: overallMetrics.trend,
      timePenaltyMs: overallMetrics.penaltyMs,
      submissionLevel: overallMetrics.submissionLevel,
      submissionLevelPriority: overallMetrics.submissionLevelPriority,
      lastActivityAt: overallMetrics.lastActivityAt,
    },
  };
}

function compareEntries(scope) {
  return (left, right) => {
    const leftStats = left[scope];
    const rightStats = right[scope];

    if (rightStats.score !== leftStats.score) {
      return rightStats.score - leftStats.score;
    }

    if (rightStats.problemsSolved !== leftStats.problemsSolved) {
      return rightStats.problemsSolved - leftStats.problemsSolved;
    }

    if (leftStats.timePenaltyMs !== rightStats.timePenaltyMs) {
      return leftStats.timePenaltyMs - rightStats.timePenaltyMs;
    }

    if (rightStats.submissionLevelPriority !== leftStats.submissionLevelPriority) {
      return rightStats.submissionLevelPriority - leftStats.submissionLevelPriority;
    }

    if (rightStats.lastActivityAt !== leftStats.lastActivityAt) {
      return rightStats.lastActivityAt - leftStats.lastActivityAt;
    }

    return String(left.username || '').localeCompare(String(right.username || ''));
  };
}

function applyRanks(entries, scope) {
  const rankedIds = new Map();
  [...entries]
    .sort(compareEntries(scope))
    .forEach((entry, index) => {
      rankedIds.set(entry.userId, index + 1);
    });

  return entries.map((entry) => ({
    ...entry,
    [scope]: {
      ...entry[scope],
      rank: rankedIds.get(entry.userId) || 0,
    },
  }));
}

async function resolveProblem(problemId) {
  const direct = await prisma.problem.findUnique({ where: { id: String(problemId || '') } });
  if (direct) return direct;

  const legacyId = Number(problemId);
  if (Number.isInteger(legacyId)) {
    return prisma.problem.findFirst({ where: { legacyId } });
  }

  return null;
}

exports.runSample = async (req, res) => {
  try {
    const { problemId, language, code, customInput } = req.body;
    if (!problemId || !language || !code) {
      return res.status(400).json({ error: 'problemId, language, and code are required' });
    }

    const problem = await resolveProblem(problemId);
    if (!problem) {
      return res.status(404).json({ error: 'problem not found' });
    }

    const execution = await executeSubmission(
      {
        language,
        sourceCode: code,
        fnName: problem.fnName,
        testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
        input: customInput || '',
      },
      { priority: 10 },
    );
    const tests = Array.isArray(execution.tests) ? execution.tests : [];
    const storedStatus = resolveSubmissionStatus(tests);
    const submission = await prisma.submission.create({
      data: {
        userId: req.user.id,
        problemId: problem.id,
        language,
        code,
        status: storedStatus,
        results: tests,
        timeMs: parseRuntimeMs(execution.runtime),
      },
    });

    const userWithBadge = await syncUserBadge(req.user.id);

    return res.json({
      submissionId: submission.id,
      submission,
      badge: getBadgePresentation(userWithBadge || req.user),
      passed: Boolean(execution.passed),
      status: execution.status || (storedStatus === 'ACCEPTED' ? 'passed' : 'failed'),
      tests,
      runtime: execution.runtime || 'N/A',
      memory: execution.memory || 'N/A',
      beats: execution.beats || 'N/A',
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || 'Execution failed.',
    });
  }
};

exports.submit = async (req, res) => {
  try {
    const { problemId, language, code } = req.body;
    if (!problemId || !language || !code) {
      return res.status(400).json({ error: 'problemId, language, and code are required' });
    }

    const problem = await resolveProblem(problemId);
    if (!problem) {
      return res.status(404).json({ error: 'problem not found' });
    }

    const execution = await executeSubmission(
      {
        language,
        sourceCode: code,
        fnName: problem.fnName,
        testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
      },
      { priority: 1 },
    );
    const tests = Array.isArray(execution.tests) ? execution.tests : [];
    const storedStatus = resolveSubmissionStatus(tests);
    const submission = await prisma.submission.create({
      data: {
        userId: req.user.id,
        problemId: problem.id,
        language,
        code,
        status: storedStatus,
        results: tests,
        timeMs: parseRuntimeMs(execution.runtime),
      },
    });

    const userWithBadge = await syncUserBadge(req.user.id);

    return res.json({
      submission,
      badge: getBadgePresentation(userWithBadge || req.user),
      passed: Boolean(execution.passed),
      status: execution.status || (storedStatus === 'ACCEPTED' ? 'passed' : 'failed'),
      tests,
      runtime: execution.runtime || 'N/A',
      memory: execution.memory || 'N/A',
      beats: execution.beats || 'N/A',
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || 'Unable to save submission right now.',
    });
  }
};

exports.listByUser = async (req, res) => {
  const { userId } = req.params;
  if (req.user.id !== userId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'forbidden' });
  }

  const list = await prisma.submission.findMany({
    where: { userId },
    include: { problem: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ submissions: list });
};

exports.leaderboard = async (req, res) => {
  try {
    const activeAssignment = await prisma.testAssignment.findFirst({
      where: { status: 'LIVE' },
      orderBy: { startsAt: 'desc' },
    });

    const students = await prisma.user.findMany({
      where: {
        role: { in: ['USER', 'STUDENT', 'user', 'student'] },
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!students.length) {
      return res.json({
        leaderboard: [],
        contestLeaderboard: [],
        activeAssignmentId: activeAssignment?.id || null,
        activeAssignmentTitle: activeAssignment?.title || null,
        submittedCount: 0,
        totalRegisteredCount: 0,
      });
    }

    const [submissions, assessmentSubmissions, testAttempts] = await Promise.all([
      prisma.submission.findMany({
        where: { userId: { in: students.map((student) => student.id) } },
        include: { problem: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.assessmentSubmission.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.testAttempt.findMany({
        where: { status: { in: ['SUBMITTED', 'AUTO_SUBMITTED'] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const assessmentSubmissionByUserId = new Map();
    assessmentSubmissions.forEach((sub) => {
      if (!assessmentSubmissionByUserId.has(sub.userId)) {
        if (!activeAssignment || sub.assignmentId === activeAssignment.id) {
          assessmentSubmissionByUserId.set(sub.userId, sub);
        }
      }
    });

    const testAttemptByUserId = new Map();
    testAttempts.forEach((att) => {
      if (!testAttemptByUserId.has(att.userId)) {
        if (!activeAssignment || att.assignmentId === activeAssignment.id) {
          testAttemptByUserId.set(att.userId, att);
        }
      }
    });

    const completedUserIdsForContest = new Set([
      ...assessmentSubmissionByUserId.keys(),
      ...testAttemptByUserId.keys(),
    ]);

    const problemsById = new Map();
    submissions.forEach((submission) => {
      if (submission.problem) {
        problemsById.set(submission.problemId, submission.problem);
      }
    });

    if (activeAssignment?.problemIds?.length) {
      const contestProblems = await prisma.problem.findMany({
        where: { id: { in: activeAssignment.problemIds } },
      });
      contestProblems.forEach((problem) => {
        problemsById.set(problem.id, problem);
      });
    }

    const groupedSubmissions = new Map();
    submissions.forEach((submission) => {
      const bucket = groupedSubmissions.get(submission.userId) || [];
      bucket.push(submission);
      groupedSubmissions.set(submission.userId, bucket);
    });

    let leaderboard = students
      .map((student) => {
        const assessmentSub = assessmentSubmissionByUserId.get(student.id) || null;
        const testAttempt = testAttemptByUserId.get(student.id) || null;
        const card = buildScoreCard(student, groupedSubmissions.get(student.id) || [], problemsById, activeAssignment, assessmentSub, testAttempt);
        const hasContestSubmission = completedUserIdsForContest.has(student.id);
        const attemptStatus = testAttempt?.status || (assessmentSub ? 'SUBMITTED' : 'NOT_STARTED');
        return {
          ...card,
          hasContestSubmission,
          attemptStatus,
        };
      });

    // Only students who have submitted the contest appear in contest rankings
    const contestEligible = leaderboard.filter((entry) => entry.hasContestSubmission);
    const contestRanked = applyRanks(contestEligible, 'contest');
    const contestRankMap = new Map(contestRanked.map((item) => [item.userId, item.contest.rank]));

    leaderboard = leaderboard.map((entry) => ({
      ...entry,
      contest: {
        ...entry.contest,
        rank: contestRankMap.get(entry.userId) || 0,
      },
    }));

    leaderboard = applyRanks(leaderboard, 'overall');
    leaderboard = applyRanks(leaderboard, 'global');

    return res.json({
      leaderboard,
      contestLeaderboard: contestRanked,
      activeAssignmentId: activeAssignment?.id || null,
      activeAssignmentTitle: activeAssignment?.title || null,
      submittedCount: contestRanked.length,
      totalRegisteredCount: students.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'server error' });
  }
};
