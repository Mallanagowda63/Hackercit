const prisma = require('../backend/src/prismaClient');

async function runEndToEndVerification() {
  console.log('==================================================');
  console.log('DEVORBIT FULL END-TO-END PRODUCTION READINESS TEST');
  console.log('==================================================\n');

  const results = [];

  function record(testName, status, evidence) {
    results.push({ testName, status, evidence });
    console.log(`[${status}] ${testName}: ${evidence}`);
  }

  // 1. Backend Health Test
  try {
    const healthRes = await fetch('http://127.0.0.1:4000/api/health');
    if (healthRes.ok) {
      const data = await healthRes.json();
      record('Backend Health', 'PASS', `HTTP 200 - ok: ${data.ok}, service: ${data.service}`);
    } else {
      record('Backend Health', 'FAIL', `HTTP ${healthRes.status}`);
    }
  } catch (err) {
    record('Backend Health', 'FAIL', `Connection error: ${err.message}`);
  }

  // 2. DevOrbit Proxy Health Test
  try {
    const healthRes = await fetch('http://127.0.0.1:3000/api/health');
    if (healthRes.ok) {
      const data = await healthRes.json();
      record('Proxy Server Health', 'PASS', `HTTP 200 - ok: ${data.ok}, service: ${data.service}`);
    } else {
      record('Proxy Server Health', 'FAIL', `HTTP ${healthRes.status}`);
    }
  } catch (err) {
    record('Proxy Server Health', 'FAIL', `Connection error: ${err.message}`);
  }

  // 3. Read-Only Database Safety Check
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    const assignments = await prisma.testAssignment.findMany({ select: { id: true } });
    const attempts = await prisma.testAttempt.findMany({ select: { id: true } });
    const submissions = await prisma.submission.findMany({ select: { id: true } });
    const assessmentSubs = await prisma.assessmentSubmission.findMany({ select: { id: true } });

    record('Database Read-Only Check', 'PASS', `Users: ${users.length}, Assignments: ${assignments.length}, Attempts: ${attempts.length}, Submissions: ${submissions.length}, AssessmentSubs: ${assessmentSubs.length}`);
  } catch (err) {
    record('Database Read-Only Check', 'FAIL', err.message);
  }

  // Register / Login via API to get real server JWT token
  let token = '';
  let registeredUserId = null;
  const testEmail = `qa_test_${Date.now()}@gmail.com`;
  try {
    const regRes = await fetch('http://127.0.0.1:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        name: 'QA Test Student',
        role: 'student',
        usn: `USN_${Date.now()}`,
        department: 'CS',
      }),
    });
    if (regRes.ok) {
      const data = await regRes.json();
      token = data.token;
      registeredUserId = data.user?.id;
      record('Student Registration & Auth API', 'PASS', `Successfully registered student account (${testEmail}) and received JWT token`);
    } else {
      const text = await regRes.text();
      record('Student Registration & Auth API', 'FAIL', `HTTP ${regRes.status} - ${text}`);
    }
  } catch (err) {
    record('Student Registration & Auth API', 'FAIL', err.message);
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 4. Active Assignment Test with Authentication
  let activeAssignment = null;
  try {
    const res = await fetch('http://127.0.0.1:3000/api/tests/active', { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      activeAssignment = data.assignment || data.assignments?.[0];
      record('Contest Load API', 'PASS', `Active Assignment: "${activeAssignment?.title || 'None'}" (ID: ${activeAssignment?.id || 'N/A'}, status: ${activeAssignment?.status || 'N/A'})`);
    } else {
      const text = await res.text();
      record('Contest Load API', 'FAIL', `HTTP ${res.status} - ${text}`);
    }
  } catch (err) {
    record('Contest Load API', 'FAIL', err.message);
  }

  // 5. Leaderboard API Check with Authentication
  try {
    const res = await fetch('http://127.0.0.1:3000/api/submissions/leaderboard', { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      const submittedCount = data.submittedCount || data.contestLeaderboard?.length || 0;
      const totalCount = data.totalRegisteredCount || data.leaderboard?.length || 0;

      const allSubmitted = (data.contestLeaderboard || []).every((e) => e.hasContestSubmission || e.attemptStatus === 'SUBMITTED' || e.attemptStatus === 'AUTO_SUBMITTED');

      record('Leaderboard API', allSubmitted ? 'PASS' : 'FAIL', `Submitted Candidates: ${submittedCount}/${totalCount}. All ranked entries have submitted attempts: ${allSubmitted}`);
    } else {
      const text = await res.text();
      record('Leaderboard API', 'FAIL', `HTTP ${res.status} - ${text}`);
    }
  } catch (err) {
    record('Leaderboard API', 'FAIL', err.message);
  }

  // 6. Security Check: Password Hashing Verification
  try {
    const sampleUser = await prisma.user.findFirst({
      select: { password: true },
    });
    const isHashed = sampleUser?.password?.startsWith('$2b$') || sampleUser?.password?.startsWith('$2a$');
    record('Security - Password Hashing', isHashed ? 'PASS' : 'FAIL', `Sample password stored using bcrypt hash: ${isHashed}`);
  } catch (err) {
    record('Security - Password Hashing', 'FAIL', err.message);
  }

  // Clean up temporary QA student account created during test
  if (registeredUserId) {
    await prisma.user.delete({ where: { id: registeredUserId } }).catch(() => {});
  }

  await prisma.$disconnect();

  console.log('\n==================================================');
  console.log('VERIFICATION SUMMARY TABLE');
  console.log('==================================================');
  results.forEach((r) => {
    console.log(`| ${r.testName.padEnd(32)} | ${r.status.padEnd(5)} | ${r.evidence} |`);
  });
}

runEndToEndVerification().catch(console.error);
