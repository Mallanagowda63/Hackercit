const prisma = require('../backend/src/prismaClient');

async function findMcqProblems() {
  const problems = await prisma.problem.findMany();
  console.log(`Total Problems in Database: ${problems.length}\n`);

  problems.forEach((p, i) => {
    const isMcqTitle = p.title.match(/clock|age|blood|ratio|percentage|speed|distance|mcq|option|question/i) || p.type === 'theory' || (Array.isArray(p.options) && p.options.length > 0);
    if (isMcqTitle) {
      console.log(`[MCQ CANDIDATE] #${i + 1} ID: ${p.id} | Type: ${p.type} | Title: ${p.title}`);
    } else {
      console.log(`[CODING] #${i + 1} ID: ${p.id} | Type: ${p.type} | Title: ${p.title}`);
    }
  });

  await prisma.$disconnect();
}

findMcqProblems().catch(console.error);
