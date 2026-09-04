const prisma = require('../backend/src/prismaClient');

async function inspectRawSub() {
  const sub = await prisma.assessmentSubmission.findUnique({
    where: { id: '6a95c2345738c274d9910aba' },
  });
  console.log('Raw Submission:', sub);

  if (sub && sub.userId) {
    const user = await prisma.user.findUnique({ where: { id: sub.userId } });
    console.log('User found for userId:', sub.userId, '=>', user);
  }

  await prisma.$disconnect();
}

inspectRawSub().catch(console.error);
