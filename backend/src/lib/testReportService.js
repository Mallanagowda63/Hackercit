const prisma = require('../prismaClient');

function formatName(user) {
  const explicitName = String(user?.name || '').trim();
  if (explicitName) return explicitName;
  return String(user?.email || 'Student').split('@')[0];
}

function getWeight(problem) {
  const difficulty = String(problem?.difficulty || '').toUpperCase();
  if (difficulty === 'HARD') return 50;
  if (difficulty === 'MEDIUM') return 35;
  if (difficulty === 'EASY') return 20;
  return 15;
}

function durationMs(start, end) {
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, endMs - startMs);
}

function groupBy(items, key) {
  return items.reduce((map, item) => {
    const bucket = map.get(item[key]) || [];
    bucket.push(item);
    map.set(item[key], bucket);
    return map;
  }, new Map());
}

async function buildAssignmentReport(assignment) {
  const [students, attempts, submissions, problems] = await Promise.all([
    prisma.user.findMany({ where: { role: 'USER' } }),
    prisma.testAttempt.findMany({ where: { assignmentId: assignment.id } }),
    prisma.submission.findMany({ include: { problem: true }, orderBy: { createdAt: 'asc' } }),
    assignment.problemIds?.length
      ? prisma.problem.findMany({ where: { id: { in: assignment.problemIds } } })
      : [],
  ]);

  const problemsById = new Map(problems.map((problem) => [problem.id, problem]));
  const submissionsInWindow = submissions.filter((submission) => {
    if (!assignment.problemIds?.includes(submission.problemId)) return false;
    const createdAt = new Date(submission.createdAt).getTime();
    const startsAt = assignment.startsAt ? new Date(assignment.startsAt).getTime() : 0;
    const endsAt = assignment.endsAt ? new Date(assignment.endsAt).getTime() : Number.MAX_SAFE_INTEGER;
    return createdAt >= startsAt && createdAt <= endsAt;
  });
  const attemptsByUser = groupBy(attempts, 'userId');
  const submissionsByUser = groupBy(submissionsInWindow, 'userId');

  const rows = students.map((student) => {
    const studentAttempts = attemptsByUser.get(student.id) || [];
    const attempt = studentAttempts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null;
    const studentSubmissions = submissionsByUser.get(student.id) || [];
    const groupedByProblem = groupBy(studentSubmissions, 'problemId');
    let solved = 0;
    let score = 0;

    groupedByProblem.forEach((entries, problemId) => {
      if (entries.some((entry) => entry.status === 'ACCEPTED')) {
        solved += 1;
        score += getWeight(problemsById.get(problemId));
      }
    });

    const firstSubmissionAt = studentSubmissions[0]?.createdAt || null;
    const lastSubmissionAt = studentSubmissions[studentSubmissions.length - 1]?.createdAt || null;
    return {
      userId: student.id,
      name: formatName(student),
      email: student.email,
      usn: student.usn || '',
      department: student.department || '',
      attendance: attempt ? 'Attended' : 'Absent',
      attemptStatus: attempt?.status || 'NOT_STARTED',
      startedAt: attempt?.startedAt || null,
      finishedAt: attempt?.finishedAt || null,
      timeSpentMs: attempt ? durationMs(attempt.startedAt, attempt.finishedAt || assignment.endsAt) : 0,
      interruptionCount: Number(attempt?.interruptionCount || 0),
      interruptions: Array.isArray(attempt?.interruptions) ? attempt.interruptions : [],
      finishReason: attempt?.finishReason || '',
      submissionCount: studentSubmissions.length,
      solved,
      score,
      firstSubmissionAt,
      lastSubmissionAt,
    };
  });

  const attended = rows.filter((row) => row.attendance === 'Attended');
  const completed = rows.filter((row) => row.attemptStatus === 'COMPLETED');
  const interrupted = rows.filter((row) => row.attemptStatus === 'INTERRUPTED' || row.interruptionCount > 0);
  const bestStudent = [...attended].sort((a, b) => b.score - a.score || a.timeSpentMs - b.timeSpentMs)[0] || null;
  const avgScore = attended.length
    ? Math.round(attended.reduce((sum, row) => sum + row.score, 0) / attended.length)
    : 0;
  const avgTimeSpentMs = attended.length
    ? Math.round(attended.reduce((sum, row) => sum + row.timeSpentMs, 0) / attended.length)
    : 0;

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    status: assignment.status,
    startsAt: assignment.startsAt,
    endsAt: assignment.endsAt,
    totalStudents: students.length,
    attendedCount: attended.length,
    absentCount: Math.max(0, students.length - attended.length),
    completedCount: completed.length,
    interruptedCount: interrupted.length,
    averageScore: avgScore,
    averageTimeSpentMs: avgTimeSpentMs,
    bestStudent,
    students: rows.sort((a, b) => b.score - a.score || a.timeSpentMs - b.timeSpentMs || a.name.localeCompare(b.name)),
  };
}

module.exports = {
  buildAssignmentReport,
};
