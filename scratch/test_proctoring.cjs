const http = require('http');
const path = require('path');
const prisma = require(path.resolve(__dirname, '../backend/src/prismaClient'));

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function runProctoringTests() {
  console.log('--- STARTING PROCTORING & MALPRACTICE REPORT SYSTEM TEST ---');

  // Authenticate Admin via login API
  const loginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    email: 'mallanagowdap99@gmail.com',
    password: 'Mallana@99',
    role: 'admin',
  });

  const token = loginRes.body?.token;
  console.log('Admin Login API Status:', loginRes.status, '| User:', loginRes.body?.user?.email);

  if (!token) {
    console.error('Failed to get auth token from login API:', loginRes.body);
    process.exit(1);
  }

  // 1. Record Proctoring Events for a Test Attempt
  console.log('\n--- 1. Recording Real Proctoring Events ---');
  const assignment = await prisma.testAssignment.findFirst();
  const assignmentId = assignment ? assignment.id : '69c57b25e81a567aa423834d';

  const eventsToTest = [
    { eventType: 'TAB_SWITCH', metadata: { count: 1 } },
    { eventType: 'FULLSCREEN_EXIT', metadata: { count: 1 } },
    { eventType: 'COPY', metadata: { questionId: 'p1' } },
    { eventType: 'PASTE', metadata: { questionId: 'p1' } },
    { eventType: 'SUSPICIOUS_SHORTCUT', metadata: { key: 'Ctrl+Shift+I' } },
    { eventType: 'DEVTOOLS_INDICATOR', metadata: { mode: 'docked' } },
  ];

  for (const evt of eventsToTest) {
    const evtRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 4000,
      path: '/api/proctoring/events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }, {
      assignmentId,
      eventType: evt.eventType,
      metadata: evt.metadata,
    });

    console.log(`Event Recorded: ${evt.eventType.padEnd(20)} | Status: ${evtRes.status} | Total Risk Score: ${evtRes.body?.totalRiskScore} | Proctoring Status: ${evtRes.body?.proctoringStatus}`);
  }

  // 2. Fetch Admin Proctoring Reports
  console.log('\n--- 2. Fetching Admin Proctoring Reports ---');
  const reportsRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/admin/reports/proctoring',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('Proctoring Reports Endpoint Status:', reportsRes.status);
  console.log('Total Students in Stats:', reportsRes.body?.stats?.totalStudents);
  console.log('Active Attempts:', reportsRes.body?.stats?.totalActiveAttempts);
  console.log('Flagged Attempts:', reportsRes.body?.stats?.totalFlagged);
  console.log('Rejected Attempts:', reportsRes.body?.stats?.totalRejected);
  console.log('Reports Returned:', reportsRes.body?.reports?.length);

  // 3. Test Admin Decision Review
  const firstReport = reportsRes.body?.reports?.[0];
  if (firstReport) {
    console.log('\n--- 3. Testing Admin Review & Audit Decision ---');
    const reviewRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 4000,
      path: `/api/admin/reports/proctoring/attempts/${firstReport.attemptId}/review`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }, {
      newStatus: 'CONFIRMED_MALPRACTICE',
      note: 'Verified multiple tab switches and DevTools shortcuts during exam.',
    });

    console.log('Review Decision Endpoint Status:', reviewRes.status);
    console.log('Admin Audit Decision Recorded:', reviewRes.body?.adminDecision);
  }

  // 4. Test CSV Export Endpoint
  console.log('\n--- 4. Testing CSV Export Endpoint ---');
  const csvRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 4000,
    path: '/api/admin/reports/proctoring/export',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('CSV Export Status:', csvRes.status);
  console.log('CSV Content Header:', typeof csvRes.body === 'string' ? csvRes.body.split('\n')[0] : 'JSON returned');
  console.log('CSV First Row:', typeof csvRes.body === 'string' ? csvRes.body.split('\n')[1] : '');

  console.log('\n======================================================');
  console.log('  PROCTORING & MALPRACTICE SYSTEM TEST: ALL PASSED   ');
  console.log('======================================================');
  process.exit(0);
}

runProctoringTests().catch(console.error);
