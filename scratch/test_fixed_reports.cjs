const prisma = require('../backend/src/prismaClient');

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
  if (!user || !user.usn || String(user.usn).trim() === '' || user.usn === '--') {
    return 'Not Available';
  }
  return String(user.usn).trim();
}

async function testResolution() {
  const submissions = await prisma.assessmentSubmission.findMany({
    where: { assignmentId: '6a95c2345738c274d9910ab8' },
    include: {
      user: {
        select: { id: true, name: true, email: true, usn: true, department: true },
      },
    },
  });

  const userIds = [...new Set(submissions.map((s) => s.userId).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, usn: true, department: true },
  });
  const userMap = new Map(users.map((u) => [String(u.id), u]));

  const resolved = submissions.map((sub) => {
    const user = sub.user || userMap.get(String(sub.userId)) || null;
    return {
      submissionId: sub.id,
      userId: sub.userId,
      student: {
        id: user?.id || sub.userId,
        name: formatStudentName(user),
        usn: formatStudentUsn(user),
        email: user?.email || 'Not Available',
        department: user?.department || 'Not Available',
      },
      studentName: formatStudentName(user),
      studentUsn: formatStudentUsn(user),
      score: `${sub.totalScore}/${sub.maxScore}`,
    };
  });

  console.log('RESOLVED SUBMISSIONS WITH REAL STUDENT DATA:\n', JSON.stringify(resolved, null, 2));
  await prisma.$disconnect();
}

testResolution().catch(console.error);
