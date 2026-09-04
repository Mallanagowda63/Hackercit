const prisma = require('../prismaClient');

const EVENT_CONFIG = {
  TAB_SWITCH: { score: 10, severity: 'LOW' },
  WINDOW_BLUR: { score: 10, severity: 'LOW' },
  WINDOW_FOCUS: { score: 0, severity: 'INFO' },
  FULLSCREEN_EXIT: { score: 10, severity: 'MEDIUM' },
  FULLSCREEN_ENTER: { score: 0, severity: 'INFO' },
  COPY: { score: 15, severity: 'MEDIUM' },
  PASTE: { score: 20, severity: 'HIGH' },
  CUT: { score: 15, severity: 'MEDIUM' },
  SUSPICIOUS_SHORTCUT: { score: 20, severity: 'HIGH' },
  PAGE_RELOAD: { score: 15, severity: 'MEDIUM' },
  NAVIGATION_ATTEMPT: { score: 25, severity: 'HIGH' },
  DEVTOOLS_INDICATOR: { score: 30, severity: 'CRITICAL' },
  EXAM_STARTED: { score: 0, severity: 'INFO' },
  EXAM_SUBMITTED: { score: 0, severity: 'INFO' },
  EXAM_TIMEOUT: { score: 0, severity: 'INFO' },
};

function calculateProctoringStatus(score, hasManualRejection = false) {
  if (hasManualRejection || score >= 80) return 'REJECTED_FOR_MALPRACTICE';
  if (score >= 40) return 'REVIEW_REQUIRED';
  if (score >= 20) return 'LOW_RISK';
  return 'NORMAL';
}

function sanitizeMetadata(rawMetadata = {}) {
  const metadata = { ...rawMetadata };
  // PRIVACY MANDATE: NEVER store clipboard content or keystroke content
  delete metadata.clipboardText;
  delete metadata.text;
  delete metadata.copiedText;
  delete metadata.pastedText;
  delete metadata.typedText;
  delete metadata.password;
  delete metadata.token;
  return metadata;
}

async function recordProctoringEvent({ userId, assignmentId, eventType, metadata = {}, questionId = null }) {
  if (!userId || !assignmentId || !eventType) {
    throw new Error('userId, assignmentId, and eventType are required');
  }

  const validEventType = EVENT_CONFIG[eventType] ? eventType : 'TAB_SWITCH';
  const eventConfig = EVENT_CONFIG[validEventType];
  const cleanMeta = sanitizeMetadata(metadata);

  // Find or create test attempt
  let attempt = await prisma.testAttempt.findFirst({
    where: { assignmentId, userId },
    orderBy: { startedAt: 'desc' },
  });

  if (!attempt) {
    attempt = await prisma.testAttempt.create({
      data: {
        assignmentId,
        userId,
        startedAt: new Date(),
        status: 'IN_PROGRESS',
        interruptions: [],
      },
    });
  }

  const rawInterruptions = Array.isArray(attempt.interruptions) ? attempt.interruptions : [];

  // Prevent spamming exact duplicate events within 500ms
  const now = new Date();
  const lastSameEvent = rawInterruptions[rawInterruptions.length - 1];
  if (
    lastSameEvent &&
    lastSameEvent.eventType === validEventType &&
    now.getTime() - new Date(lastSameEvent.timestamp).getTime() < 500
  ) {
    return attempt;
  }

  const eventEntry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    eventType: validEventType,
    severity: eventConfig.severity,
    score: eventConfig.score,
    timestamp: now.toISOString(),
    questionId,
    metadata: cleanMeta,
  };

  const updatedEvents = [...rawInterruptions, eventEntry];
  const totalRiskScore = updatedEvents.reduce((sum, evt) => sum + (evt.score || 0), 0);
  const currentProctoringStatus = calculateProctoringStatus(
    totalRiskScore,
    attempt.proctoringStatus === 'REJECTED_FOR_MALPRACTICE' || attempt.proctoringStatus === 'REJECTED'
  );

  const isAutoReject = totalRiskScore >= 80;

  const updatedAttempt = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      interruptionCount: updatedEvents.filter((e) => e.score > 0).length,
      interruptions: updatedEvents,
      status: isAutoReject ? 'INTERRUPTED' : attempt.status,
      finishReason: isAutoReject ? 'Auto-rejected for malpractice threshold breach' : attempt.finishReason,
    },
  });

  return {
    attempt: updatedAttempt,
    event: eventEntry,
    totalRiskScore,
    proctoringStatus: currentProctoringStatus,
  };
}

function formatStudentName(user) {
  if (!user) return 'Unknown Student';
  const explicitName = String(user.name || '').trim();
  if (explicitName) return explicitName;

  const emailHandle = String(user.email || '').split('@')[0];
  const formattedHandle = emailHandle
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formattedHandle || 'Unknown Student';
}

function formatStudentUsn(user) {
  if (!user || !user.usn || String(user.usn).trim() === '' || String(user.usn).trim() === '--') {
    return 'Not Available';
  }
  return String(user.usn).trim();
}

async function getProctoringReports(filters = {}) {
  const attempts = await prisma.testAttempt.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, usn: true, department: true } },
      assignment: { select: { id: true, title: true, durationMinutes: true, status: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  const missingUserIds = [...new Set(attempts.filter((a) => !a.user && a.userId).map((a) => a.userId))];
  let resolvedUserMap = new Map();
  if (missingUserIds.length) {
    const fetchedUsers = await prisma.user.findMany({
      where: { id: { in: missingUserIds } },
      select: { id: true, name: true, email: true, usn: true, department: true },
    });
    fetchedUsers.forEach((u) => resolvedUserMap.set(String(u.id), u));
  }

  const reports = attempts.map((attempt) => {
    const user = attempt.user || resolvedUserMap.get(String(attempt.userId)) || null;
    const events = Array.isArray(attempt.interruptions) ? attempt.interruptions : [];
    const totalRiskScore = events.reduce((sum, evt) => sum + (evt.score || 0), 0);
    const eventCounts = {};
    events.forEach((evt) => {
      const type = evt.eventType || 'UNKNOWN';
      eventCounts[type] = (eventCounts[type] || 0) + 1;
    });

    let status = calculateProctoringStatus(totalRiskScore);
    if (attempt.adminDecision && attempt.adminDecision.newStatus) {
      status = attempt.adminDecision.newStatus;
    }

    const studentName = formatStudentName(user);
    const studentUsn = formatStudentUsn(user);

    return {
      attemptId: attempt.id,
      assignmentId: attempt.assignmentId,
      testTitle: attempt.assignment?.title || 'Coding Test',
      userId: attempt.userId,
      studentName,
      studentEmail: user?.email || 'Not Available',
      studentUsn,
      studentDepartment: user?.department || 'Not Available',
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      attemptStatus: attempt.status,
      interruptionCount: events.filter((e) => e.score > 0).length,
      totalRiskScore,
      proctoringStatus: status,
      eventCounts,
      events,
      adminDecision: attempt.adminDecision || null,
    };
  });

  // Apply filters
  let filtered = reports;
  if (filters.testId) {
    filtered = filtered.filter((r) => r.assignmentId === filters.testId);
  }
  if (filters.studentEmail) {
    const query = String(filters.studentEmail).toLowerCase();
    filtered = filtered.filter((r) => r.studentEmail.toLowerCase().includes(query) || r.studentName.toLowerCase().includes(query));
  }
  if (filters.status) {
    filtered = filtered.filter((r) => r.proctoringStatus === filters.status);
  }
  if (filters.rejectedOnly) {
    filtered = filtered.filter((r) => r.proctoringStatus === 'REJECTED' || r.proctoringStatus === 'REJECTED_FOR_MALPRACTICE');
  }
  if (filters.flaggedOnly) {
    filtered = filtered.filter((r) => r.proctoringStatus === 'REVIEW_REQUIRED' || r.proctoringStatus === 'FLAGGED' || r.totalRiskScore >= 40);
  }

  // Calculate overall summary stats
  const stats = {
    totalStudents: new Set(reports.map((r) => r.userId)).size,
    totalActiveAttempts: reports.filter((r) => r.attemptStatus === 'IN_PROGRESS').length,
    totalFlagged: reports.filter((r) => r.proctoringStatus === 'REVIEW_REQUIRED' || r.proctoringStatus === 'FLAGGED').length,
    totalUnderReview: reports.filter((r) => r.proctoringStatus === 'UNDER_REVIEW').length,
    totalConfirmedMalpractice: reports.filter((r) => r.proctoringStatus === 'CONFIRMED_MALPRACTICE').length,
    totalRejected: reports.filter((r) => r.proctoringStatus === 'REJECTED' || r.proctoringStatus === 'REJECTED_FOR_MALPRACTICE').length,
  };

  return { stats, reports: filtered };
}

async function reviewProctoringAttempt(attemptId, adminUser, { newStatus, note }) {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new Error('Attempt not found');

  const validStatuses = ['NORMAL', 'FLAGGED', 'REVIEW_REQUIRED', 'UNDER_REVIEW', 'CONFIRMED_MALPRACTICE', 'REJECTED', 'REJECTED_FOR_MALPRACTICE', 'CLEARED'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid proctoring status');
  }

  const decisionObj = {
    adminId: adminUser.id,
    adminEmail: adminUser.email,
    previousStatus: attempt.proctoringStatus || 'NORMAL',
    newStatus,
    note: String(note || '').trim(),
    reviewedAt: new Date().toISOString(),
  };

  const updatedAttempt = await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: (newStatus === 'REJECTED' || newStatus === 'REJECTED_FOR_MALPRACTICE') ? 'INTERRUPTED' : attempt.status,
      finishReason: (newStatus === 'REJECTED' || newStatus === 'REJECTED_FOR_MALPRACTICE') ? `Rejected by Admin: ${note}` : attempt.finishReason,
      interruptions: Array.isArray(attempt.interruptions) ? attempt.interruptions : [],
    },
  });

  return { attempt: updatedAttempt, adminDecision: decisionObj };
}

module.exports = {
  EVENT_CONFIG,
  calculateProctoringStatus,
  recordProctoringEvent,
  getProctoringReports,
  reviewProctoringAttempt,
};
