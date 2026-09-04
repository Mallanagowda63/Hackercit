const proctoringService = require('../lib/proctoringService');

// POST /api/proctoring/events
exports.recordEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { assignmentId, eventType, metadata, questionId } = req.body;

    if (!assignmentId || !eventType) {
      return res.status(400).json({ error: 'assignmentId and eventType are required' });
    }

    const result = await proctoringService.recordProctoringEvent({
      userId,
      assignmentId,
      eventType,
      metadata: metadata || {},
      questionId,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error recording proctoring event:', err);
    return res.status(500).json({ error: 'Failed to record proctoring event' });
  }
};

// GET /api/reports/proctoring
exports.getReports = async (req, res) => {
  try {
    const { testId, studentEmail, status, rejectedOnly, flaggedOnly } = req.query;

    const reportsData = await proctoringService.getProctoringReports({
      testId,
      studentEmail,
      status,
      rejectedOnly: rejectedOnly === 'true',
      flaggedOnly: flaggedOnly === 'true',
    });

    return res.status(200).json(reportsData);
  } catch (err) {
    console.error('Error fetching proctoring reports:', err);
    return res.status(500).json({ error: 'Failed to fetch proctoring reports' });
  }
};

// POST /api/reports/proctoring/attempts/:attemptId/review
exports.reviewAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { newStatus, note } = req.body;
    const adminUser = req.user;

    if (!newStatus) {
      return res.status(400).json({ error: 'newStatus is required' });
    }

    const result = await proctoringService.reviewProctoringAttempt(attemptId, adminUser, { newStatus, note });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Error reviewing attempt:', err);
    return res.status(500).json({ error: err.message || 'Failed to update review status' });
  }
};

// GET /api/reports/proctoring/export
exports.exportReportsCSV = async (req, res) => {
  try {
    const reportsData = await proctoringService.getProctoringReports(req.query);
    const reports = reportsData.reports || [];

    const headers = [
      'Student Name',
      'Student Email',
      'Department',
      'Test Title',
      'Started At',
      'Risk Score',
      'Proctoring Status',
      'Event Count',
      'Event Breakdown',
      'Admin Decision',
    ];

    const rows = reports.map((r) => [
      `"${r.studentName}"`,
      `"${r.studentEmail}"`,
      `"${r.studentDepartment}"`,
      `"${r.testTitle}"`,
      `"${r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}"`,
      r.totalRiskScore,
      `"${r.proctoringStatus}"`,
      r.interruptionCount,
      `"${Object.entries(r.eventCounts || {}).map(([k, v]) => `${k}:${v}`).join('; ')}"`,
      `"${r.adminDecision?.newStatus || 'None'} - ${r.adminDecision?.note || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="proctoring_malpractice_report.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exporting proctoring reports CSV:', err);
    return res.status(500).json({ error: 'Failed to export reports CSV' });
  }
};
