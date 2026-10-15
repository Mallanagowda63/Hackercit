const prisma = require('../prismaClient');
const { toClientDifficulty } = require('../lib/problemHelpers');

function formatStudentName(user) {
  if (!user) return 'Unknown Student';
  const explicitName = String(user.name || '').trim();
  if (explicitName) return explicitName;

  const emailHandle = String(user.email || '').split('@')[0];
  const formattedHandle = emailHandle
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formattedHandle || 'Unknown Student';
}

function formatStudentUsn(user) {
  if (!user || !user.usn || String(user.usn).trim() === '' || String(user.usn).trim() === '--') {
    return 'Not Available';
  }
  return String(user.usn).trim();
}

function formatStudentEmail(user) {
  if (!user || !user.email || String(user.email).trim() === '') {
    return 'Not Available';
  }
  return String(user.email).trim();
}

function formatStudentDept(user) {
  if (!user || !user.department || String(user.department).trim() === '' || String(user.department).trim() === '--') {
    return 'Not Available';
  }
  return String(user.department).trim();
}

function calculateTimeUsedMinutes(createdAt, assignmentStartAt, durationMinutes) {
  if (!createdAt) return 0;
  const start = assignmentStartAt ? new Date(assignmentStartAt).getTime() : new Date(createdAt).getTime() - 60000;
  const diffMs = Math.max(0, new Date(createdAt).getTime() - start);
  const minutes = Math.round(diffMs / (1000 * 60));
  return Math.min(minutes, durationMinutes || 120);
}

// GET /api/admin/reports/tests
exports.listReportsOverview = async (req, res) => {
  try {
    const assignments = await prisma.testAssignment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Only the score fields this overview shows (not every answer and line of code).
    const submissions = await prisma.assessmentSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, assignmentId: true, userId: true, percentage: true, totalScore: true, maxScore: true, createdAt: true },
    });

    const submissionsByAssignment = new Map();
    submissions.forEach((sub) => {
      const list = submissionsByAssignment.get(sub.assignmentId) || [];
      list.push(sub);
      submissionsByAssignment.set(sub.assignmentId, list);
    });

    const reportsOverview = assignments.map((assignment) => {
      const subs = submissionsByAssignment.get(assignment.id) || [];
      const completedSubs = subs.filter((s) => s.percentage !== undefined && s.percentage !== null);
      
      const totalStudents = subs.length;
      const completedCount = completedSubs.length;

      let avgPercentage = 0;
      let topScore = 0;
      let maxScore = 0;

      if (completedSubs.length) {
        const sumPercentage = completedSubs.reduce((sum, s) => sum + (s.percentage || 0), 0);
        avgPercentage = Math.round((sumPercentage / completedSubs.length) * 10) / 10;
        topScore = Math.max(...completedSubs.map((s) => s.totalScore || 0));
        maxScore = completedSubs[0]?.maxScore || 0;
      }

      return {
        id: assignment.id,
        title: assignment.title,
        difficulty: assignment.difficulty ? toClientDifficulty(assignment.difficulty) : 'Medium',
        durationMinutes: assignment.durationMinutes,
        status: assignment.status,
        createdAt: assignment.createdAt,
        totalStudents,
        completedCount,
        avgPercentage,
        topScore,
        maxScore,
      };
    });

    return res.json({ reports: reportsOverview });
  } catch (error) {
    console.error('Error in listReportsOverview:', error);
    return res.status(500).json({ error: 'Failed to fetch reports overview.' });
  }
};

// GET /api/admin/reports/tests/:testId
exports.getTestReport = async (req, res) => {
  try {
    const { testId } = req.params;

    const assignment = await prisma.testAssignment.findUnique({
      where: { id: testId },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    const submissions = await prisma.assessmentSubmission.findMany({
      where: { assignmentId: testId },
      include: {
        user: {
          select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
        },
      },
      orderBy: [
        { totalScore: 'desc' },
        { createdAt: 'asc' },
      ],
      // Scores only: the answers and code are loaded when one student's report is opened.
      select: {
        id: true, userId: true, assignmentId: true, createdAt: true, totalScore: true, maxScore: true,
        percentage: true, theoryScore: true, codingScore: true,
        'details.maxTheoryScore': true, 'details.maxCodingScore': true,
      },
    });

    // Explicit Batch User Resolution to resolve raw DB user documents
    const missingUserIds = [...new Set(submissions.filter((s) => !s.user && s.userId).map((s) => s.userId))];
    let resolvedUserMap = new Map();
    if (missingUserIds.length) {
      const fetchedUsers = await prisma.user.findMany({
        where: { id: { in: missingUserIds } },
        select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
      });
      fetchedUsers.forEach((u) => resolvedUserMap.set(String(u.id), u));
    }

    const uniqueUserSubmissions = [];
    const seenUsers = new Set();
    submissions.forEach((sub) => {
      sub.user = sub.user || resolvedUserMap.get(String(sub.userId)) || null;
      if (!seenUsers.has(sub.userId)) {
        seenUsers.add(sub.userId);
        uniqueUserSubmissions.push(sub);
      }
    });

    // Every student who started the exam, so students whose exam never got submitted (lost submit,
    // malpractice, closed browser) are in the report too, not only the graded ones.
    const attempts = await prisma.testAttempt.findMany({
      where: { assignmentId: testId },
      select: { id: true, userId: true, assignmentId: true, status: true, startedAt: true, finishedAt: true, interruptionCount: true, finishReason: true },
    });
    const latestAttemptByUser = new Map();
    attempts
      .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
      .forEach((attempt) => {
        const key = String(attempt.userId);
        if (!latestAttemptByUser.has(key)) latestAttemptByUser.set(key, attempt);
      });
    const isLive = assignment.status === 'LIVE';

    // SUBMITTED = Final Submit; COMPLETED / AUTO_SUBMITTED = time up, test stopped or server
    // auto-submit; INTERRUPTED = ended for warnings or rejected in the proctoring review.
    const describeResult = (attempt, hasSubmission) => {
      if (attempt?.status === 'INTERRUPTED') return hasSubmission ? 'Malpractice (submitted)' : 'Malpractice (not submitted)';
      if (hasSubmission) return !attempt || attempt.status === 'SUBMITTED' ? 'Submitted' : 'Auto-submitted';
      if (attempt?.status === 'IN_PROGRESS' && isLive) return 'In progress';
      return 'Not submitted';
    };
    const attemptDetails = (attempt) => ({
      warnings: Number(attempt?.interruptionCount || 0),
      finishReason: attempt?.finishReason || '',
      startedAt: attempt?.startedAt || null,
    });

    // Rank calculation (Score desc, then submission time asc)
    const rankedSubmissions = uniqueUserSubmissions.map((sub, idx) => {
      const attempt = latestAttemptByUser.get(String(sub.userId)) || null;
      const u = sub.user;
      const studentName = formatStudentName(u);
      const studentUsn = formatStudentUsn(u);
      const studentEmail = formatStudentEmail(u);
      const studentDepartment = formatStudentDept(u);
      const timeUsed = calculateTimeUsedMinutes(sub.createdAt, assignment.startsAt || assignment.createdAt, assignment.durationMinutes);

      return {
        rank: idx + 1,
        submissionId: sub.id,
        userId: sub.userId,
        student: {
          id: u?.id || sub.userId,
          name: studentName,
          usn: studentUsn,
          email: studentEmail,
          department: studentDepartment,
        },
        studentName,
        studentEmail,
        studentUsn,
        studentDepartment,
        studentPhone: u?.phone || '',
        totalScore: sub.totalScore,
        maxScore: sub.maxScore,
        percentage: sub.percentage,
        theoryScore: sub.theoryScore,
        codingScore: sub.codingScore,
        status: sub.percentage !== undefined ? 'Completed' : 'In Progress',
        result: describeResult(attempt, true),
        ...attemptDetails(attempt),
        submittedAt: sub.createdAt,
        timeUsedMinutes: timeUsed,
      };
    });

    const unsubmittedAttempts = [...latestAttemptByUser.values()].filter((attempt) => !seenUsers.has(attempt.userId) && !seenUsers.has(String(attempt.userId)));
    const unsubmittedUsers = unsubmittedAttempts.length
      ? await prisma.user.findMany({
        where: { id: { in: unsubmittedAttempts.map((attempt) => String(attempt.userId)) } },
        select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
      })
      : [];
    const unsubmittedUserById = new Map(unsubmittedUsers.map((u) => [String(u.id), u]));
    const unsubmittedRows = unsubmittedAttempts.map((attempt) => {
      const u = unsubmittedUserById.get(String(attempt.userId)) || null;
      const studentName = formatStudentName(u);
      const startedMs = new Date(attempt.startedAt || 0).getTime();
      const endMs = attempt.finishedAt ? new Date(attempt.finishedAt).getTime() : Date.now();
      return {
        rank: null,
        submissionId: null,
        userId: attempt.userId,
        student: {
          id: u?.id || attempt.userId,
          name: studentName,
          usn: formatStudentUsn(u),
          email: formatStudentEmail(u),
          department: formatStudentDept(u),
        },
        studentName,
        studentEmail: formatStudentEmail(u),
        studentUsn: formatStudentUsn(u),
        studentDepartment: formatStudentDept(u),
        studentPhone: u?.phone || '',
        totalScore: 0,
        maxScore: rankedSubmissions[0]?.maxScore || 0,
        percentage: 0,
        theoryScore: 0,
        codingScore: 0,
        status: 'Not Submitted',
        result: describeResult(attempt, false),
        ...attemptDetails(attempt),
        submittedAt: null,
        timeUsedMinutes: Number.isFinite(startedMs) && startedMs > 0
          ? Math.min(Math.round(Math.max(0, endMs - startedMs) / 60000), assignment.durationMinutes || 120)
          : 0,
      };
    });
    const allStudentRows = [...rankedSubmissions, ...unsubmittedRows];
    const countResult = (prefix) => allStudentRows.filter((row) => row.result.startsWith(prefix)).length;
    const resultCounts = {
      tookExam: allStudentRows.length,
      submitted: countResult('Submitted'),
      autoSubmitted: countResult('Auto-submitted'),
      malpractice: countResult('Malpractice'),
      notSubmitted: countResult('Not submitted'),
      inProgress: countResult('In progress'),
    };

    const top3 = rankedSubmissions.slice(0, 3).map((student) => ({
      ...student,
      medal: student.rank === 1 ? '🥇' : student.rank === 2 ? '🥈' : '🥉',
    }));

    // Scores/averages below are over graded exams only; the student counts include everyone who started.
    const gradedCount = rankedSubmissions.length;
    const totalStudents = allStudentRows.length;
    const completedStudents = rankedSubmissions.filter((s) => s.status === 'Completed').length;
    const inProgressStudents = totalStudents - completedStudents;

    let avgPercentage = 0;
    let avgScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let avgTheoryScore = 0;
    let maxTheoryScore = 0;
    let avgCodingScore = 0;
    let maxCodingScore = 0;

    if (gradedCount > 0) {
      const sumScore = rankedSubmissions.reduce((sum, s) => sum + s.totalScore, 0);
      const sumPercentage = rankedSubmissions.reduce((sum, s) => sum + s.percentage, 0);
      const sumTheory = rankedSubmissions.reduce((sum, s) => sum + s.theoryScore, 0);
      const sumCoding = rankedSubmissions.reduce((sum, s) => sum + s.codingScore, 0);

      avgScore = Math.round((sumScore / gradedCount) * 10) / 10;
      avgPercentage = Math.round((sumPercentage / gradedCount) * 10) / 10;
      avgTheoryScore = Math.round((sumTheory / gradedCount) * 10) / 10;
      avgCodingScore = Math.round((sumCoding / gradedCount) * 10) / 10;

      highestScore = Math.max(...rankedSubmissions.map((s) => s.totalScore));
      lowestScore = Math.min(...rankedSubmissions.map((s) => s.totalScore));
      maxTheoryScore = Math.max(0, ...uniqueUserSubmissions.map((s) => s.details?.maxTheoryScore || 0));
      maxCodingScore = Math.max(0, ...uniqueUserSubmissions.map((s) => s.details?.maxCodingScore || 0));
    }

    return res.json({
      test: {
        id: assignment.id,
        title: assignment.title,
        difficulty: assignment.difficulty ? toClientDifficulty(assignment.difficulty) : 'Medium',
        durationMinutes: assignment.durationMinutes,
        status: assignment.status,
        createdAt: assignment.createdAt,
      },
      stats: {
        totalStudents,
        completedStudents,
        inProgressStudents,
        avgScore,
        highestScore,
        lowestScore,
        avgPercentage,
        avgTheoryScore,
        avgCodingScore,
        maxScore: rankedSubmissions[0]?.maxScore || 0,
        ...resultCounts,
      },
      top3,
      students: allStudentRows,
    });
  } catch (error) {
    console.error('Error in getTestReport:', error);
    return res.status(500).json({ error: 'Failed to fetch test report.' });
  }
};

// GET /api/admin/reports/tests/:testId/students/:studentId
exports.getStudentDetailReport = async (req, res) => {
  try {
    const { testId, studentId } = req.params;

    const assignment = await prisma.testAssignment.findUnique({
      where: { id: testId },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const submission = await prisma.assessmentSubmission.findFirst({
      where: {
        assignmentId: testId,
        userId: studentId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!submission) {
      return res.status(404).json({ error: 'No submission found for this student on this test.' });
    }

    // Get proctoring attempt details for this student & test
    const attempt = await prisma.testAttempt.findFirst({
      where: { assignmentId: testId, userId: studentId },
      orderBy: { startedAt: 'desc' },
    });

    // Get rank among all students for this test
    const allTestSubmissions = await prisma.assessmentSubmission.findMany({
      where: { assignmentId: testId },
      select: { userId: true, totalScore: true, createdAt: true },
      orderBy: [
        { totalScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const uniqueUserSubs = [];
    const seenUsers = new Set();
    allTestSubmissions.forEach((s) => {
      if (!seenUsers.has(s.userId)) {
        seenUsers.add(s.userId);
        uniqueUserSubs.push(s);
      }
    });

    const rankIdx = uniqueUserSubs.findIndex((s) => s.userId === studentId);
    const rank = rankIdx >= 0 ? rankIdx + 1 : uniqueUserSubs.length;

    const studentName = formatStudentName(user);
    const studentUsn = formatStudentUsn(user);
    const studentEmail = formatStudentEmail(user);
    const studentDept = formatStudentDept(user);
    const timeUsedMinutes = calculateTimeUsedMinutes(submission.createdAt, assignment.startsAt || assignment.createdAt, assignment.durationMinutes);

    return res.json({
      student: {
        id: user.id,
        name: studentName,
        email: studentEmail,
        usn: studentUsn,
        department: studentDept,
      },
      test: {
        id: assignment.id,
        title: assignment.title,
        durationMinutes: assignment.durationMinutes,
      },
      submission: {
        id: submission.id,
        rank,
        totalStudents: uniqueUserSubs.length,
        totalScore: submission.totalScore,
        maxScore: submission.maxScore,
        percentage: submission.percentage,
        theoryScore: submission.theoryScore,
        codingScore: submission.codingScore,
        timeUsedMinutes,
        createdAt: submission.createdAt,
        details: submission.details || {},
      },
      proctoring: attempt ? {
        attemptId: attempt.id,
        status: attempt.status,
        finishReason: attempt.finishReason,
        interruptionCount: attempt.interruptionCount || 0,
        interruptions: attempt.interruptions || [],
      } : null,
    });
  } catch (error) {
    console.error('Error in getStudentDetailReport:', error);
    return res.status(500).json({ error: 'Failed to fetch student detail report.' });
  }
};

// GET /api/admin/reports/submissions/:submissionId
exports.getCodingSubmissionDetail = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        user: { select: { id: true, name: true, email: true, usn: true, department: true, phone: true } },
        problem: { select: { id: true, title: true, statement: true, difficulty: true, marks: true } },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Coding submission not found.' });
    }

    if (!submission.user && submission.userId) {
      submission.user = await prisma.user.findUnique({
        where: { id: submission.userId },
        select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
      });
    }

    if (submission.user) {
      submission.user.name = formatStudentName(submission.user);
      submission.user.usn = formatStudentUsn(submission.user);
    }

    return res.json({ submission });
  } catch (error) {
    console.error('Error in getCodingSubmissionDetail:', error);
    return res.status(500).json({ error: 'Failed to fetch submission detail.' });
  }
};

// GET /api/admin/reports/monitor/:testId — Live Monitor: what every student in a test is doing now.
// Built from each attempt's latest check-in (sent by the exam page about every 30s): progress,
// camera flags and a small camera snapshot, plus the warnings recorded on the attempt.
const MONITOR_ONLINE_MS = 90 * 1000;

function describeMonitorEvent(event) {
  const type = event?.eventType || 'WARNING';
  const reason = event?.metadata?.reason || event?.reason || type.replace(/_/g, ' ').toLowerCase();
  return { type, reason: String(reason).slice(0, 160), at: event?.timestamp || event?.at || null };
}

exports.getLiveMonitor = async (req, res) => {
  try {
    const { testId } = req.params;
    const assignment = await prisma.testAssignment.findUnique({
      where: { id: testId },
      select: { id: true, title: true, status: true, startsAt: true, endsAt: true, durationMinutes: true, problemIds: true },
    });
    if (!assignment) return res.status(404).json({ error: 'Assessment not found.' });

    const runStart = assignment.startsAt ? new Date(assignment.startsAt).getTime() : 0;
    const attempts = await prisma.testAttempt.findMany({
      where: { assignmentId: testId },
      orderBy: [{ startedAt: 'desc' }],
      select: {
        id: true, userId: true, status: true, startedAt: true, finishedAt: true, submittedAt: true, finishReason: true,
        interruptionCount: true, interruptions: true, lastSeenAt: true, liveProgress: true, liveSnapshot: true,
        liveSnapshotAt: true, assessmentSubmittedAt: true, submitRequestedAt: true,
      },
    });
    const latestByUser = new Map();
    attempts.forEach((attempt) => {
      if (new Date(attempt.startedAt || 0).getTime() < runStart) return;
      const key = String(attempt.userId);
      if (!latestByUser.has(key)) latestByUser.set(key, attempt);
    });

    const userIds = [...latestByUser.keys()];
    const users = userIds.length
      ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, usn: true, department: true, phone: true },
      })
      : [];
    const userById = new Map(users.map((u) => [String(u.id), u]));

    const now = Date.now();
    const durationMs = (assignment.durationMinutes || 60) * 60 * 1000;
    const endsAtMs = assignment.endsAt ? new Date(assignment.endsAt).getTime() : NaN;
    const totalQuestions = Array.isArray(assignment.problemIds) ? assignment.problemIds.length : 0;

    const students = [...latestByUser.values()].map((attempt) => {
      const user = userById.get(String(attempt.userId)) || null;
      const lastSeenMs = attempt.lastSeenAt ? new Date(attempt.lastSeenAt).getTime() : NaN;
      const online = Number.isFinite(lastSeenMs) && now - lastSeenMs <= MONITOR_ONLINE_MS;
      const inProgress = attempt.status === 'IN_PROGRESS' && !attempt.assessmentSubmittedAt;

      let state;
      if (attempt.status === 'INTERRUPTED') state = 'Malpractice';
      else if (!inProgress) state = attempt.status === 'SUBMITTED' ? 'Submitted' : 'Auto-submitted';
      else state = online ? 'Writing' : 'Inactive';

      const startedMs = new Date(attempt.startedAt || 0).getTime();
      const deadline = Math.min(startedMs + durationMs, Number.isFinite(endsAtMs) ? endsAtMs : Infinity);
      const events = Array.isArray(attempt.interruptions) ? attempt.interruptions : [];
      const progress = attempt.liveProgress || null;
      // Camera flags only mean "right now" while the student is checking in.
      const live = state === 'Writing' && progress;

      return {
        attemptId: attempt.id,
        userId: attempt.userId,
        name: user?.name || user?.email || 'Unknown student',
        email: user?.email || '',
        usn: user?.usn || '',
        department: user?.department || '',
        phone: user?.phone || '',
        state,
        startedAt: attempt.startedAt,
        lastSeenAt: attempt.lastSeenAt || null,
        timeLeftSeconds: inProgress ? Math.max(0, Math.round((deadline - now) / 1000)) : 0,
        answered: progress?.answered ?? null,
        totalQuestions: progress?.total || totalQuestions,
        currentQuestion: progress?.current || null,
        currentTitle: progress?.currentTitle || '',
        cameraIssue: live ? progress.cameraIssue || '' : '',
        phoneDetected: Boolean(live && progress.phoneDetected),
        faceMissing: Boolean(live && progress.faceMissing),
        warnings: Number(attempt.interruptionCount || events.filter((e) => (e?.score || 0) > 0).length || 0),
        recentEvents: events.slice(-3).reverse().map(describeMonitorEvent),
        finishReason: attempt.finishReason || '',
        // Photos only for students still in the exam (keeps the refresh small).
        snapshot: inProgress ? attempt.liveSnapshot || null : null,
        snapshotAt: inProgress ? attempt.liveSnapshotAt || null : null,
      };
    });

    const stateOrder = { Writing: 0, Inactive: 1, Malpractice: 2, 'Auto-submitted': 3, Submitted: 4 };
    const flagged = (s) => Boolean(s.cameraIssue || s.phoneDetected || s.faceMissing);
    students.sort((a, b) => (Number(flagged(b)) - Number(flagged(a)))
      || (stateOrder[a.state] - stateOrder[b.state])
      || a.name.localeCompare(b.name));

    const count = (state) => students.filter((s) => s.state === state).length;
    return res.json({
      test: {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        durationMinutes: assignment.durationMinutes,
        endsAt: assignment.endsAt,
        totalQuestions,
      },
      summary: {
        started: students.length,
        writing: count('Writing'),
        inactive: count('Inactive'),
        flaggedNow: students.filter(flagged).length,
        malpractice: count('Malpractice'),
        submitted: count('Submitted') + count('Auto-submitted'),
      },
      generatedAt: new Date(now).toISOString(),
      students,
    });
  } catch (error) {
    console.error('Error in getLiveMonitor:', error);
    return res.status(500).json({ error: 'Failed to load the live monitor.' });
  }
};
