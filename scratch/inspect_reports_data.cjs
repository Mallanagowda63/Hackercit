const prisma = require('../backend/src/prismaClient');

async function checkReportsData() {
  console.log('=== USERS IN DB ===');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, usn: true, role: true }
  });
  console.table(users);

  console.log('\n=== ASSIGNMENTS IN DB ===');
  const assignments = await prisma.testAssignment.findMany({
    select: { id: true, title: true, status: true }
  });
  console.table(assignments);

  console.log('\n=== ASSESSMENT SUBMISSIONS ===');
  const subs = await prisma.assessmentSubmission.findMany({
    include: { user: { select: { id: true, name: true, email: true, usn: true } } }
  });
  console.log(`Found ${subs.length} assessment submissions`);
  subs.forEach(s => {
    console.log(`Sub ID: ${s.id} | Assignment: ${s.assignmentId} | User: ${s.user?.name || 'NULL'} (${s.user?.email}) | USN: ${s.user?.usn || 'NULL'} | Score: ${s.totalScore}/${s.maxScore} (${s.percentage}%)`);
  });

  await prisma.$disconnect();
}

checkReportsData().catch(console.error);
