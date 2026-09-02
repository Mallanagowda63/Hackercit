const prisma = require('../backend/src/prismaClient');
const { REFERENCE_SOLUTIONS, PROBLEMS } = require('./extracted_data.cjs');

async function migrateHardcodedProblems() {
  console.log('==================================================');
  console.log('MIGRATING HARDCODED PROBLEMS TO MONGODB DATABASE');
  console.log('==================================================\n');

  console.log(`Loaded ${PROBLEMS.length} hardcoded problems and ${Object.keys(REFERENCE_SOLUTIONS).length} reference solutions.\n`);

  let insertedCount = 0;
  let skippedCount = 0;

  for (const legacyProb of PROBLEMS) {
    const title = legacyProb.title.trim();
    const slug = legacyProb.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const legacyId = Number(legacyProb.id);

    // Check if problem already exists by slug, legacyId, or title
    let existing = await prisma.problem.findFirst({
      where: {
        OR: [
          { legacyId },
          { slug },
          { title },
        ],
      },
    });

    const payload = {
      type: 'coding',
      legacyId,
      title,
      slug,
      fnName: legacyProb.fnName || 'solve',
      difficulty: String(legacyProb.difficulty || 'Medium').toUpperCase(),
      tags: Array.isArray(legacyProb.tags) ? legacyProb.tags : [],
      acceptance: legacyProb.acceptance || null,
      statement: legacyProb.description || legacyProb.statement || '',
      examples: Array.isArray(legacyProb.examples) ? legacyProb.examples : [],
      starterCode: legacyProb.starterCode || { javascript: '', python: '', java: '' },
      testCases: Array.isArray(legacyProb.testCases) ? legacyProb.testCases : [],
      constraints: Array.isArray(legacyProb.constraints) ? legacyProb.constraints : [],
      samples: Array.isArray(legacyProb.examples) ? legacyProb.examples : [],
      options: null,
      correctAnswer: null,
      explanation: null,
      marks: 10,
    };

    if (!existing) {
      try {
        await prisma.problem.create({ data: payload });
        insertedCount += 1;
        console.log(`[INSERTED] #${legacyId} "${title}" (slug: ${slug})`);
      } catch (err) {
        console.warn(`[SKIP/EXISTS] #${legacyId} "${title}" - already present or duplicate key`);
        skippedCount += 1;
      }
    } else {
      await prisma.problem.update({
        where: { id: existing.id },
        data: {
          fnName: existing.fnName || payload.fnName,
          starterCode: existing.starterCode || payload.starterCode,
          testCases: existing.testCases || payload.testCases,
          examples: existing.examples || payload.examples,
          constraints: existing.constraints || payload.constraints,
        },
      });
      skippedCount += 1;
      console.log(`[PRESERVED/UPDATED] #${legacyId} "${title}" (ID: ${existing.id})`);
    }
  }

  const finalProblemCount = await prisma.problem.findMany({ select: { id: true } });

  console.log('\n==================================================');
  console.log('MIGRATION SUMMARY');
  console.log('==================================================');
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Preserved/Updated: ${skippedCount}`);
  console.log(`Total Problems in Database: ${finalProblemCount.length}`);
  console.log('==================================================\n');

  await prisma.$disconnect();
}

migrateHardcodedProblems().catch(console.error);
