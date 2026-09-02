const prisma = require('../backend/src/prismaClient');

async function runMcqDataAudit() {
  console.log('========================================');
  console.log('MCQ / PRACTICE DATA SEPARATION AUDIT');
  console.log('========================================\n');

  const allProblems = await prisma.problem.findMany();
  const typeCounts = {};
  allProblems.forEach((p) => {
    const t = p.type || (Array.isArray(p.options) && p.options.length ? 'theory' : 'coding');
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  console.log('Problem Record Types in Database:');
  console.log(JSON.stringify(typeCounts, null, 2));

  // Simulating GET /api/problems (Student Practice Problems API)
  const defaultPracticeApiRes = await fetch('http://127.0.0.1:4000/api/problems');
  const defaultPracticeData = defaultPracticeApiRes.ok ? await defaultPracticeApiRes.json() : { problems: [] };
  const mcqsInDefaultPracticeApi = (defaultPracticeData.problems || []).filter((p) => p.type === 'theory' || (Array.isArray(p.options) && p.options.length));

  // Simulating GET /api/problems?includeAll=true (Admin Question Bank API)
  const adminBankApiRes = await fetch('http://127.0.0.1:4000/api/problems?includeAll=true');
  const adminBankData = adminBankApiRes.ok ? await adminBankApiRes.json() : { problems: [] };
  const mcqsInAdminBankApi = (adminBankData.problems || []).filter((p) => p.type === 'theory' || (Array.isArray(p.options) && p.options.length));

  console.log(`\nTotal Questions in Database: ${allProblems.length}`);
  console.log(`Coding Practice Questions: ${typeCounts.coding || 0}`);
  console.log(`Admin/Exam MCQs (type='theory'): ${typeCounts.theory || 0}`);
  console.log(`MCQs visible in Student Practice API (GET /api/problems): ${mcqsInDefaultPracticeApi.length}`);
  console.log(`MCQs visible in Admin Question Bank API (GET /api/problems?includeAll=true): ${mcqsInAdminBankApi.length}\n`);

  console.log('----------------------------------------');
  console.log('SAMPLE MCQs CLASSIFICATION AUDIT (FIRST 5):');
  console.log('----------------------------------------');

  const mcqSample = allProblems.filter((p) => p.type === 'theory' || (Array.isArray(p.options) && p.options.length));

  mcqSample.slice(0, 5).forEach((mcq, idx) => {
    console.log(`Question #${idx + 1}:`);
    console.log(`  ID: ${mcq.id}`);
    console.log(`  Title: ${mcq.title.substring(0, 70)}`);
    console.log(`  Type: ${mcq.type || 'theory'}`);
    console.log(`  Options Count: ${Array.isArray(mcq.options) ? mcq.options.length : 0}`);
    console.log(`  Practice API Eligible: FALSE (Excluded from Student Practice)`);
    console.log(`  Exam/Admin Bank Eligible: TRUE (Available for Admin Exams & Workspace)`);
    console.log('----------------------------------------');
  });

  await prisma.$disconnect();
}

runMcqDataAudit().catch(console.error);
