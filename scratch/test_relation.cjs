const prisma = require('../backend/src/prismaClient');

async function testRelation() {
  const sub = await prisma.assessmentSubmission.findFirst({
    where: { id: '6a95c2345738c274d9910aba' },
    include: { user: true },
  });
  console.log('Submission with user include:', sub);
  await prisma.$disconnect();
}

testRelation().catch(console.error);
