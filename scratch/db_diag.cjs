const prisma = require('../backend/src/prismaClient');

async function diag() {
  const activeAssignment = await prisma.testAssignment.findFirst({
    where: { status: 'LIVE' },
    orderBy: { createdAt: 'desc' }
  }) || await prisma.testAssignment.findFirst({
    orderBy: { createdAt: 'desc' }
  });

  const student = await prisma.user.findFirst({
    where: { role: 'USER' },
    orderBy: { createdAt: 'desc' }
  });

  let attempt = null;
  let submission = null;

  if (activeAssignment && student) {
    attempt = await prisma.testAttempt.findFirst({
      where: { assignmentId: activeAssignment.id, userId: student.id },
      orderBy: { startedAt: 'desc' }
    });
    submission = await prisma.assessmentSubmission.findFirst({
      where: { assignmentId: activeAssignment.id, userId: student.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  console.log('========================================');
  console.log('FINAL CONTEST START DIAGNOSTIC');
  console.log('========================================');
  console.log('Active Assignment:');
  console.log('  ID:', activeAssignment?.id || 'N/A');
  console.log('  Title:', activeAssignment?.title || 'N/A');
  console.log('  Status:', activeAssignment?.status || 'N/A');
  console.log('  StartsAt:', activeAssignment?.startsAt || 'N/A');
  console.log('  EndsAt:', activeAssignment?.endsAt || 'N/A');
  console.log('  Problem Count:', activeAssignment?.problemIds?.length || 0);
  console.log('\nCurrent Student:');
  console.log('  ID:', student?.id || 'N/A');
  console.log('  Name:', student?.name || student?.email || 'N/A');
  console.log('\nExisting Attempt:');
  console.log('  ID:', attempt?.id || 'N/A');
  console.log('  Status:', attempt?.status || 'N/A');
  console.log('  Assignment ID:', attempt?.assignmentId || 'N/A');
  console.log('  User ID:', attempt?.userId || 'N/A');
  console.log('  StartedAt:', attempt?.startedAt || 'N/A');
  console.log('  EndsAt:', attempt?.endsAt || 'N/A');
  console.log('\nAssessmentSubmission:');
  console.log('  Exists:', Boolean(submission));
  console.log('  ID:', submission?.id || 'N/A');
  console.log('  Score:', submission?.totalScore ?? 'N/A');
  console.log('  MaxScore:', submission?.maxScore ?? 'N/A');
  console.log('  Percentage:', submission?.percentage ?? 'N/A');
  console.log('========================================');
  await prisma.$disconnect();
}

diag().catch(console.error);
