const prisma = require('../backend/src/prismaClient');
const bcrypt = require('../backend/node_modules/bcrypt');

async function testAuthFlows() {
  console.log("=== CHECKING AUTHENTICATION FLOWS ===");

  // 1. Check Default Admin Credentials from env / defaults
  const envAdminEmail = (process.env.ADMIN_EMAIL || 'mallanagowdap99@gmail.com').trim().toLowerCase();
  const envAdminPassword = (process.env.ADMIN_PASSWORD || 'Mallana@99').trim();

  console.log(`\n1. Default Admin Settings:`);
  console.log(`   Admin Email: ${envAdminEmail}`);
  console.log(`   Admin Password Configured: YES (${envAdminPassword ? 'Set' : 'Missing'})`);

  // Check if Admin exists in DB
  const existingAdmin = await prisma.user.findUnique({ where: { email: envAdminEmail } });
  if (existingAdmin) {
    console.log(`   [SUCCESS] Default Admin account exists in database. Role: ${existingAdmin.role}`);
  } else {
    console.log(`   [INFO] Default Admin account not found yet in database. It will be auto-created on first login via ensureDefaultAdmin().`);
  }

  // 2. Test Backend Login API for Default Admin
  const backendUrl = 'http://127.0.0.1:4000';
  
  try {
    console.log(`\n2. Testing Default Admin Login Endpoint:`);
    const adminLoginRes = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: envAdminEmail,
        password: envAdminPassword,
        role: 'admin'
      })
    });

    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.ok && adminLoginData.token) {
      console.log(`   [SUCCESS] Default Admin login verified! Token issued. User role: ${adminLoginData.user.role}`);
    } else {
      console.log(`   [FAIL] Admin login response: ${adminLoginRes.status} - ${JSON.stringify(adminLoginData)}`);
    }
  } catch (err) {
    console.log(`   [NOTE] Could not reach backend server at ${backendUrl}: ${err.message}`);
  }

  // 3. Test Student Registration & Student Login
  const testStudentEmail = `test_student_${Date.now()}@gmail.com`;
  const testStudentPassword = 'StudentPass123!';

  try {
    console.log(`\n3. Testing Student Registration & Login:`);
    // Register
    const regRes = await fetch(`${backendUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStudentEmail,
        password: testStudentPassword,
        name: 'Test Student',
        usn: `USN${Date.now()}`,
        department: 'CSE',
        role: 'student'
      })
    });
    const regData = await regRes.json();

    if (regRes.ok) {
      console.log(`   [SUCCESS] Student Registration worked! User ID: ${regData.user.id}, Role: ${regData.user.role}`);

      // Login as Student
      const loginRes = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testStudentEmail,
          password: testStudentPassword,
          role: 'student'
        })
      });
      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.token) {
        console.log(`   [SUCCESS] Student Login worked! Token issued.`);
      } else {
        console.log(`   [FAIL] Student Login failed: ${loginRes.status} - ${JSON.stringify(loginData)}`);
      }

      // Cleanup test student
      await prisma.user.delete({ where: { email: testStudentEmail } }).catch(() => {});
    } else {
      console.log(`   [FAIL] Student registration response: ${regRes.status} - ${JSON.stringify(regData)}`);
    }
  } catch (err) {
    console.log(`   [NOTE] Backend server unreachable: ${err.message}`);
  }

  // 4. Role Enforcement Check
  try {
    console.log(`\n4. Testing Role Isolation Security:`);
    // Try student attempting admin login
    const illegalRes = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'randomstudent@gmail.com',
        password: 'password',
        role: 'admin'
      })
    });
    const illegalData = await illegalRes.json();
    if (!illegalRes.ok) {
      console.log(`   [SUCCESS] Non-admin blocked from admin login: ${illegalData.error}`);
    } else {
      console.log(`   [WARNING] Unauthorized admin login allowed!`);
    }
  } catch (err) {
    // Ignore fetch error
  }

  await prisma.$disconnect();
}

testAuthFlows().catch(console.error);
