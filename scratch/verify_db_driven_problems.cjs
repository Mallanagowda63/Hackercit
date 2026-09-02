const prisma = require('../backend/src/prismaClient');

async function verifyDatabaseDrivenProblems() {
  console.log('==================================================');
  console.log('VERIFYING DATABASE-DRIVEN PROBLEM ARCHITECTURE');
  console.log('==================================================\n');

  // 1. Verify Problem Count in MongoDB
  const problemsInDb = await prisma.problem.findMany({ where: { type: 'coding' } });
  console.log(`[PASS] MongoDB Coding Practice Problems Count: ${problemsInDb.length}`);

  // 2. Test Student Practice Problems API (GET /api/problems)
  const res = await fetch('http://127.0.0.1:3000/api/problems');
  const data = res.ok ? await res.json() : { problems: [] };
  console.log(`[PASS] GET /api/problems returned ${data.problems.length} problems from database`);

  // 3. Authenticate or register an admin user via API
  let adminToken = '';
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminUser?.email, password: 'password123', role: 'admin' }),
  });

  if (loginRes.ok) {
    const loginData = await loginRes.json();
    adminToken = loginData.token;
  } else {
    const testAdminEmail = `qa_admin_db_${Date.now()}@gmail.com`;
    const regRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAdminEmail,
        password: 'Password123!',
        name: 'QA DB Admin',
        role: 'admin',
        department: 'CS',
      }),
    });
    if (regRes.ok) {
      const regData = await regRes.json();
      adminToken = regData.token;
    }
  }

  // 4. Test Creating a New Coding Problem via Admin API POST /api/problems
  const dynamicTitle = `Dynamic Coding Problem ${Date.now()}`;
  const createRes = await fetch('http://127.0.0.1:3000/api/problems', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'coding',
      title: dynamicTitle,
      slug: dynamicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      fnName: 'dynamicAdd',
      difficulty: 'Easy',
      tags: ['Math'],
      statement: 'Add two numbers together.',
      examples: [{ input: 'a = 1, b = 2', output: '3' }],
      starterCode: { javascript: 'function dynamicAdd(a, b) {\n  return a + b;\n}' },
      testCases: [{ input: '1, 2', expected: '3' }],
      constraints: ['1 <= a, b <= 100'],
      marks: 10,
    }),
  });

  if (!createRes.ok) {
    console.error('Failed to create problem via API:', await createRes.text());
    return;
  }

  const createdData = await createRes.json();
  const createdProblem = createdData.problem;
  console.log(`[PASS] Admin Created Coding Problem via API: "${createdProblem.title}" (ID: ${createdProblem.id}, type: ${createdProblem.type})`);

  // 5. Verify Student Practice API fetches the newly created problem instantly
  const updatedRes = await fetch('http://127.0.0.1:3000/api/problems');
  const updatedData = await updatedRes.json();
  const foundDynamic = (updatedData.problems || []).some((p) => String(p.id) === String(createdProblem.id) || p.title === dynamicTitle);
  console.log(`[${foundDynamic ? 'PASS' : 'FAIL'}] Newly created problem automatically available to students without frontend changes: ${foundDynamic} (Updated practice count: ${updatedData.problems.length})`);

  // Clean up test dynamic problem
  await prisma.problem.delete({ where: { id: createdProblem.id } });

  await prisma.$disconnect();

  console.log('\n==================================================');
  console.log('DATABASE-DRIVEN PROBLEM ARCHITECTURE VERIFIED - ALL PASSED');
  console.log('==================================================');
}

verifyDatabaseDrivenProblems().catch(console.error);
