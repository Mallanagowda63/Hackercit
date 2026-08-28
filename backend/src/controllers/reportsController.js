const prisma = require('../prismaClient');
const { toClientDifficulty } = require('../lib/problemHelpers');

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

    const submissions = await prisma.assessmentSubmission.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, usn: true, department: true },
        },
      },
      orderBy: { createdAt: 'desc' },
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
          select: { id: true, name: true, email: true, usn: true, department: true },
        },
      },
      orderBy: [
        { totalScore: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    const uniqueUserSubmissions = [];
    const seenUsers = new Set();
    submissions.forEach((sub) => {
      if (!seenUsers.has(sub.userId)) {
        seenUsers.add(sub.userId);
        uniqueUserSubmissions.push(sub);
      }
    });

    // Rank calculation (Score desc, then submission time asc)
    const rankedSubmissions = uniqueUserSubmissions.map((sub, idx) => {
      const studentName = formatStudentName(sub.user);
      const timeUsed = calculateTimeUsedMinutes(sub.createdAt, assignment.startsAt || assignment.createdAt, assignment.durationMinutes);

      return {
        rank: idx + 1,
        submissionId: sub.id,
        userId: sub.userId,
        studentName,
        studentEmail: sub.user?.email || '',
        studentUsn: sub.user?.usn || '--',
        studentDepartment: sub.user?.department || '--',
        totalScore: sub.totalScore,
        maxScore: sub.maxScore,
        percentage: sub.percentage,
        theoryScore: sub.theoryScore,
        codingScore: sub.codingScore,
        status: sub.percentage !== undefined ? 'Completed' : 'In Progress',
        submittedAt: sub.createdAt,
        timeUsedMinutes: timeUsed,
      };
    });

    const top3 = rankedSubmissions.slice(0, 3).map((student) => ({
      ...student,
      medal: student.rank === 1 ? '🥇' : student.rank === 2 ? '🥈' : '🥉',
    }));

    const totalStudents = rankedSubmissions.length;
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

    if (totalStudents > 0) {
      const sumScore = rankedSubmissions.reduce((sum, s) => sum + s.totalScore, 0);
      const sumPercentage = rankedSubmissions.reduce((sum, s) => sum + s.percentage, 0);
      const sumTheory = rankedSubmissions.reduce((sum, s) => sum + s.theoryScore, 0);
      const sumCoding = rankedSubmissions.reduce((sum, s) => sum + s.codingScore, 0);

      avgScore = Math.round((sumScore / totalStudents) * 10) / 10;
      avgPercentage = Math.round((sumPercentage / totalStudents) * 10) / 10;
      avgTheoryScore = Math.round((sumTheory / totalStudents) * 10) / 10;
      avgCodingScore = Math.round((sumCoding / totalStudents) * 10) / 10;

      highestScore = Math.max(...rankedSubmissions.map((s) => s.totalScore));
      lowestScore = Math.min(...rankedSubmissions.map((s) => s.totalScore));
      maxTheoryScore = Math.max(...rankedSubmissions.map((s) => sub => sub.details?.maxTheoryScore || 0));
      maxCodingScore = Math.max(...rankedSubmissions.map((s) => sub => sub.details?.maxCodingScore || 0));
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
      },
      top3,
      students: rankedSubmissions,
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
      select: { id: true, name: true, email: true, usn: true, department: true },
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
    const timeUsedMinutes = calculateTimeUsedMinutes(submission.createdAt, assignment.startsAt || assignment.createdAt, assignment.durationMinutes);

    return res.json({
      student: {
        id: user.id,
        name: studentName,
        email: user.email,
        usn: user.usn || '--',
        department: user.department || '--',
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
        user: { select: { id: true, name: true, email: true } },
        problem: { select: { id: true, title: true, statement: true, difficulty: true, marks: true } },
      },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Coding submission not found.' });
    }

    return res.json({ submission });
  } catch (error) {
    console.error('Error in getCodingSubmissionDetail:', error);
    return res.status(500).json({ error: 'Failed to fetch submission detail.' });
  }
};
