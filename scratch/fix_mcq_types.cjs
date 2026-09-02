const prisma = require('../backend/src/prismaClient');

async function classifyDatabaseProblems() {
  console.log('========================================');
  console.log('CLASSIFYING EXISTING DATABASE PROBLEMS');
  console.log('========================================\n');

  const allProblems = await prisma.problem.findMany();
  let mcqCount = 0;
  let codingCount = 0;

  for (const problem of allProblems) {
    const isMcq = Array.isArray(problem.options) && problem.options.length > 0;
    const targetType = isMcq ? 'theory' : 'coding';

    if (problem.type !== targetType) {
      await prisma.problem.update({
        where: { id: problem.id },
        data: { type: targetType },
      });
      if (isMcq) mcqCount++;
      else codingCount++;
    }
  }

  console.log(`Updated ${mcqCount} MCQ questions to type='theory'.`);
  console.log(`Updated ${codingCount} coding questions to type='coding'.`);

  const updatedMcqs = await prisma.problem.findMany({ where: { type: 'theory' } });
  const updatedCoding = await prisma.problem.findMany({ where: { type: 'coding' } });

  console.log(`\nPost-Classification Totals:`);
  console.log(`  Coding Practice Problems (type='coding'): ${updatedCoding.length}`);
  console.log(`  Admin/Exam MCQs (type='theory'): ${updatedMcqs.length}`);

  await prisma.$disconnect();
}

classifyDatabaseProblems().catch(console.error);
