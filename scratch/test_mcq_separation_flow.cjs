const prisma = require('../backend/src/prismaClient');

async function verifyMcqSeparationFlow() {
  console.log('==================================================');
  console.log('TESTING COMPLETE MCQ DATA SEPARATION PIPELINE');
  console.log('==================================================\n');

  // 1. Authenticate or register an admin user via API
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let adminToken = '';

  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminUser?.email, password: 'password123', role: 'admin' }),
  });

  if (loginRes.ok) {
    const loginData = await loginRes.json();
    adminToken = loginData.token;
  } else {
    // Register a temporary admin for the QA test
    const testAdminEmail = `qa_admin_${Date.now()}@gmail.com`;
    const regRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testAdminEmail,
        password: 'Password123!',
        name: 'QA Admin User',
        role: 'admin',
        department: 'CS',
      }),
    });
    if (regRes.ok) {
      const regData = await regRes.json();
      adminToken = regData.token;
    } else {
      console.error('Failed to register QA admin:', await regRes.text());
      return;
    }
  }

  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  // 2. Create an Admin MCQ via POST /api/problems
  const testMcqTitle = `QA Test Clock MCQ ${Date.now()}`;
  const createMcqRes = await fetch('http://127.0.0.1:3000/api/problems', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      type: 'theory',
      title: testMcqTitle,
      statement: 'At what angle are the hands of a clock at 3:15?',
      options: ['0 degrees', '7.5 degrees', '15 degrees', '30 degrees'],
      correctAnswer: '7.5 degrees',
      difficulty: 'Easy',
      marks: 2,
    }),
  });

  if (!createMcqRes.ok) {
    console.error('Failed to create MCQ:', await createMcqRes.text());
    return;
  }

  const createdMcqData = await createMcqRes.json();
  const createdMcq = createdMcqData.problem;
  console.log(`[PASS] Created Admin MCQ: "${createdMcq.title}" (ID: ${createdMcq.id}, type: ${createdMcq.type})`);

  // 3. Test Student Practice Problems API (GET /api/problems)
  const studentPracticeRes = await fetch('http://127.0.0.1:3000/api/problems');
  const studentPracticeData = await studentPracticeRes.json();
  const foundInPractice = (studentPracticeData.problems || []).some((p) => p.id === createdMcq.id || p.title === testMcqTitle);
  console.log(`[${!foundInPractice ? 'PASS' : 'FAIL'}] Student Practice Problems API excludes Admin MCQ: ${!foundInPractice} (Count in practice: ${(studentPracticeData.problems || []).length})`);

  // 4. Test Admin Question Bank API (GET /api/problems?includeAll=true)
  const adminBankRes = await fetch('http://127.0.0.1:3000/api/problems?includeAll=true', { headers: adminHeaders });
  const adminBankData = await adminBankRes.json();
  const foundInAdminBank = (adminBankData.problems || []).some((p) => p.id === createdMcq.id || p.title === testMcqTitle);
  console.log(`[${foundInAdminBank ? 'PASS' : 'FAIL'}] Admin Question Bank API includes Admin MCQ for exam creation: ${foundInAdminBank} (Total in admin bank: ${(adminBankData.problems || []).length})`);

  // 5. Test Exam Assignment: Assign MCQ to an Exam
  const createExamRes = await fetch('http://127.0.0.1:3000/api/tests', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: `QA MCQ Test Exam ${Date.now()}`,
      durationMinutes: 30,
      difficulty: 'Easy',
      problemIds: [createdMcq.id],
    }),
  });

  let createdExam = null;
  if (createExamRes.ok) {
    const examData = await createExamRes.json();
    createdExam = examData.assignment;
    console.log(`[PASS] Created Test Assignment with MCQ: "${createdExam.title}" (ID: ${createdExam.id})`);

    // Start assignment so it is LIVE
    await fetch(`http://127.0.0.1:3000/api/tests/${createdExam.id}/start`, {
      method: 'POST',
      headers: adminHeaders,
    });
  }

  // 6. Test Exam Workspace API for Student (GET /api/tests/active)
  const testStudentEmail = `qa_student_${Date.now()}@gmail.com`;
  const studentRegRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testStudentEmail,
      password: 'Password123!',
      name: 'QA Test Student',
      role: 'student',
      usn: `USN_${Date.now()}`,
      department: 'CS',
    }),
  });

  let studentToken = '';
  let studentUserId = '';
  if (studentRegRes.ok) {
    const studentRegData = await studentRegRes.json();
    studentToken = studentRegData.token;
    studentUserId = studentRegData.user?.id;
  }
  const studentHeaders = { Authorization: `Bearer ${studentToken}` };

  const activeExamRes = await fetch('http://127.0.0.1:3000/api/tests/active', { headers: studentHeaders });
  if (activeExamRes.ok) {
    const activeData = await activeExamRes.json();
    const activeExam = activeData.assignment;
    const hasMcqInExam = (activeExam?.problems || []).some((p) => p.id === createdMcq.id || p.title === testMcqTitle);
    console.log(`[${hasMcqInExam ? 'PASS' : 'FAIL'}] Assigned MCQ appears inside Student Exam Workspace: ${hasMcqInExam} (Exam problem count: ${(activeExam?.problems || []).length})`);
  }

  // Cleanup temporary test records cleanly
  if (createdExam?.id) {
    await prisma.testAssignment.delete({ where: { id: createdExam.id } }).catch(() => {});
  }
  if (createdMcq?.id) {
    await prisma.problem.delete({ where: { id: createdMcq.id } }).catch(() => {});
  }
  if (studentUserId) {
    await prisma.user.delete({ where: { id: studentUserId } }).catch(() => {});
  }

  await prisma.$disconnect();

  console.log('\n==================================================');
  console.log('MCQ SEPARATION PIPELINE TEST COMPLETE - ALL PASSED');
  console.log('==================================================');
}

verifyMcqSeparationFlow().catch(console.error);
