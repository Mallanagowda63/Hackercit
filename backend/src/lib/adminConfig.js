// The one admin account comes only from ADMIN_EMAIL / ADMIN_PASSWORD in backend/.env.
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

// Accounts left with the ADMIN role from before are treated as students.
function effectiveRole(user) {
  const role = String(user?.role || '').toUpperCase();
  if (role === 'ADMIN' && !isDesignatedAdmin(user)) return 'USER';
  return user?.role;
}

module.exports = { getAdminEmail, getAdminPassword, isDesignatedAdmin, effectiveRole };
