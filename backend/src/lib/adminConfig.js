// The super admin account comes only from ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
// There are deliberately no fallback values: without them, nobody is an admin.

function getAdminEmail() {
  return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

function getAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}

function isDesignatedAdmin(user) {
  const adminEmail = getAdminEmail();
  return Boolean(adminEmail) && String(user?.email || '').trim().toLowerCase() === adminEmail;
}

// Admins: the ADMIN_EMAIL account (super admin, every college) and college admins (role ADMIN
// with a collegeId, created by the super admin). Any other ADMIN account is treated as a student.
function effectiveRole(user) {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'ADMIN' && !isDesignatedAdmin(user) && !user?.collegeId) return 'USER';
  return user?.role;
}

module.exports = { getAdminEmail, getAdminPassword, isDesignatedAdmin, effectiveRole };
