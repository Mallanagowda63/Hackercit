const prisma = require('../backend/src/prismaClient');

async function inspectRawProblems() {
  const problems = await prisma.problem.findMany({ take: 5 });
  problems.forEach((p, i) => {
    console.log(`Problem #${i + 1}: ${p.title}`);
    console.log(`  Keys:`, Object.keys(p));
    console.log(`  type:`, p.type);
    console.log(`  options:`, p.options);
    console.log(`  correctAnswer:`, p.correctAnswer);
    console.log(`  tags:`, p.tags);
    console.log('---');
  });
  await prisma.$disconnect();
}

inspectRawProblems().catch(console.error);
