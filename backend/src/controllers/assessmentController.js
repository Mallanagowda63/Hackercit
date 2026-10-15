const { ObjectId } = require('mongodb');
const prisma = require('../prismaClient');
const { inCurrentRun } = require('./testController');
const { executeSubmission } = require('../lib/executionService');

async function attachRankToResult(result, assignmentId) {
  if (!result || !assignmentId) return result;

  // Count in MongoDB instead of loading every result (each holds full answers/code) on every submit.
  const collection = await prisma.assessmentSubmission.collection();
  const assignmentIds = ObjectId.isValid(assignmentId)
    ? [String(assignmentId), new ObjectId(String(assignmentId))]
    : [assignmentId];
  const forAssignment = { assignmentId: { $in: assignmentIds } };
  const score = Number(result.totalScore || 0);
  const createdAt = new Date(result.createdAt);

  const [ahead, totalParticipants] = await Promise.all([
    collection.countDocuments({
      ...forAssignment,
      $or: [
        { totalScore: { $gt: score } },
        { totalScore: score, createdAt: { $lt: createdAt } },
      ],
    }),
    collection.countDocuments(forAssignment),
  ]);
  const rank = ahead + 1;

  return {
    ...result,
    rank,
    userRank: rank,
    totalParticipants,
  };
}

exports.submitAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { theoryAnswers = {}, codingAnswers = {}, isAutoSubmit = false } = req.body || {};

    let assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment && id === 'active') {
      assignment = await prisma.testAssignment.findFirst({
        where: { status: 'LIVE' },
        orderBy: { startsAt: 'desc' },
      });
    }
    if (!assignment) {
      return res.status(404).json({ error: 'assignment not found' });
    }

    const outcome = await finalizeAssessment(assignment, userId, { theoryAnswers, codingAnswers, isAutoSubmit });
    if (outcome.error) {
      return res.status(400).json({ error: outcome.error });
    }
    if (outcome.alreadySubmitted) {
      return res.status(200).json({
        ok: true,
        alreadySubmitted: true,
        message: 'Exam already submitted.',
        result: outcome.result,
      });
    }

    return res.status(201).json({
      ok: true,
      result: outcome.result,
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({ error: 'Failed to evaluate assessment submission.' });
  }
};

async function attemptsCollection() {
  return prisma.testAttempt.collection();
}

function attemptObjectId(attempt) {
  return ObjectId.isValid(String(attempt.id)) ? new ObjectId(String(attempt.id)) : attempt.id;
}

// Marks the attempt so the auto-submit job knows this exam is already graded.
async function markAttemptSubmitted(assignmentId, userId) {
  const collection = await attemptsCollection();
  const ids = ObjectId.isValid(String(assignmentId)) ? [String(assignmentId), new ObjectId(String(assignmentId))] : [assignmentId];
  await collection.updateMany(
    { assignmentId: { $in: ids }, userId: { $in: ObjectId.isValid(String(userId)) ? [String(userId), new ObjectId(String(userId))] : [userId] }, assessmentSubmittedAt: { $exists: false } },
    { $set: { assessmentSubmittedAt: new Date() } },
  );
}

// Grades and stores a student's exam. Shared by the Submit button and the auto-submit job.
async function finalizeAssessment(assignment, userId, { theoryAnswers = {}, codingAnswers = {}, isAutoSubmit = false } = {}) {
    // Duplicate submission protection: if student already submitted this exam, return existing result
    const existingSubmission = await prisma.assessmentSubmission.findFirst({
      where: { assignmentId: assignment.id, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubmission && inCurrentRun(existingSubmission, assignment, 'createdAt')) {
      await markAttemptSubmitted(assignment.id, userId);
      return { alreadySubmitted: true, result: await attachRankToResult(existingSubmission, assignment.id) };
    }

    const problemIds = assignment.problemIds || [];
    if (!problemIds.length) {
      return { error: 'assignment contains no questions' };
    }

    const problems = await prisma.problem.findMany({
      where: { id: { in: problemIds } },
    });

    const problemsById = new Map(problems.map((p) => [p.id, p]));
    const orderedProblems = problemIds.map((pId) => problemsById.get(pId)).filter(Boolean);

    // Fetch candidate's persisted coding submissions from database
    const codingSubmissions = await prisma.submission.findMany({
      where: {
        userId,
        problemId: { in: problemIds },
      },
      orderBy: { createdAt: 'desc' },
    });

    const latestSubmissionByProblem = new Map();
    codingSubmissions.forEach((sub) => {
      if (!latestSubmissionByProblem.has(sub.problemId)) {
        latestSubmissionByProblem.set(sub.problemId, sub);
      }
    });

    let theoryScore = 0;
    let codingScore = 0;
    let maxTheoryScore = 0;
    let maxCodingScore = 0;
    let theoryCount = 0;
    let codingCount = 0;
    let answeredCount = 0;

    const details = await Promise.all(orderedProblems.map(async (problem) => {
      const type = problem.type || (Array.isArray(problem.options) && problem.options.length ? 'theory' : 'coding');
      const maxMarks = problem.marks || (type === 'theory' ? 2 : 10);

      if (type === 'theory') {
        theoryCount += 1;
        maxTheoryScore += maxMarks;

        const givenAnswer = (
          theoryAnswers[problem.id] ??
          theoryAnswers[problem.legacyId] ??
          theoryAnswers[String(problem.id)] ??
          ''
        );

        const isAnswered = Boolean(String(givenAnswer || '').trim());
        if (isAnswered) answeredCount += 1;

        const isCorrect = isAnswered && (
          String(givenAnswer).trim().toLowerCase() === String(problem.correctAnswer || '').trim().toLowerCase()
        );

        const earnedMarks = isCorrect ? maxMarks : 0;
        theoryScore += earnedMarks;

        return {
          questionId: problem.id,
          type: 'theory',
          title: problem.title,
          statement: problem.statement,
          marks: maxMarks,
          earnedMarks,
          status: isCorrect ? 'Correct' : 'Incorrect',
          selectedOption: givenAnswer || null,
          correctAnswer: problem.correctAnswer || null,
          explanation: problem.explanation || null,
          options: problem.options || [],
        };
      }

      codingCount += 1;
      maxCodingScore += maxMarks;

      const clientCodingPayload = (
        codingAnswers[problem.id] ||
        codingAnswers[problem.legacyId] ||
        codingAnswers[String(problem.id)] ||
        {}
      );
      let dbSub = latestSubmissionByProblem.get(problem.id);

      const code = dbSub?.code || clientCodingPayload.code || clientCodingPayload.submittedCode || '';
      const language = dbSub?.language || clientCodingPayload.language || 'javascript';
      let results = Array.isArray(dbSub?.results) ? dbSub.results : (Array.isArray(clientCodingPayload.tests) ? clientCodingPayload.tests : []);

      // If DB submission is missing or lacks results, evaluate code if code is present
      if ((!dbSub || !results.length) && code.trim()) {
        try {
          const execution = await executeSubmission({
            language,
            sourceCode: code,
            fnName: problem.fnName,
            testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
          });
          if (Array.isArray(execution.tests) && execution.tests.length) {
            results = execution.tests;
          }
          const isPassed = Boolean(execution.passed);
          const computedStatus = isPassed ? 'ACCEPTED' : (execution.status || clientCodingPayload.status || 'WRONG_ANSWER');

          if (!dbSub) {
            dbSub = await prisma.submission.create({
              data: {
                userId,
                problemId: problem.id,
                language,
                code,
                status: computedStatus,
                results,
              },
            });
          }
        } catch (e) {
          console.error('Error auto-evaluating submission during finishTest:', e);
        }
      }

      const isAnswered = Boolean(String(code || '').trim());
      if (isAnswered) answeredCount += 1;

      let status = 'No Submission';
      let earnedMarks = 0;
      let passCount = 0;
      let totalTests = Array.isArray(problem.testCases) && problem.testCases.length ? problem.testCases.length : 3;

      if (results.length > 0) {
        passCount = results.filter((t) => t.status === 'pass').length;
        totalTests = results.length;
        const ratio = totalTests > 0 ? passCount / totalTests : 0;
        earnedMarks = Math.round(ratio * maxMarks * 100) / 100;
        status = passCount === totalTests ? 'ACCEPTED' : passCount > 0 ? 'PARTIAL' : 'WRONG_ANSWER';
      } else if (dbSub && dbSub.status === 'ACCEPTED') {
        passCount = totalTests;
        earnedMarks = maxMarks;
        status = 'ACCEPTED';
      } else if (clientCodingPayload.testCasesPassed !== undefined && clientCodingPayload.totalTestCases !== undefined) {
        passCount = Number(clientCodingPayload.testCasesPassed || 0);
        totalTests = Number(clientCodingPayload.totalTestCases || totalTests);
        const ratio = totalTests > 0 ? passCount / totalTests : 0;
        earnedMarks = Math.round(ratio * maxMarks * 100) / 100;
        status = passCount === totalTests ? 'ACCEPTED' : passCount > 0 ? 'PARTIAL' : (clientCodingPayload.status || 'WRONG_ANSWER');
      } else if (clientCodingPayload.marks !== undefined && Number(clientCodingPayload.marks) > 0) {
        earnedMarks = Number(clientCodingPayload.marks);
        status = earnedMarks >= maxMarks ? 'ACCEPTED' : 'PARTIAL';
      } else if (isAnswered) {
        status = dbSub?.status || clientCodingPayload.status || 'WRONG_ANSWER';
        earnedMarks = 0;
        passCount = 0;
      }

      codingScore += earnedMarks;

      return {
        questionId: problem.id,
        submissionId: dbSub?.id || null,
        type: 'coding',
        title: problem.title,
        statement: problem.statement,
        marks: maxMarks,
        earnedMarks,
        status,
        submittedCode: code,
        language,
        testCasesPassed: passCount,
        totalTestCases: totalTests,
      };
    }));

    const totalScore = Math.round((theoryScore + codingScore) * 100) / 100;
    const maxScore = maxTheoryScore + maxCodingScore;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

    const assessmentSubmission = await prisma.assessmentSubmission.create({
      data: {
        assignmentId: assignment.id,
        userId,
        theoryAnswers,
        codingSubmissions: Object.fromEntries(
          orderedProblems
            .filter((p) => (p.type || 'coding') === 'coding')
            .map((p) => {
              const sub = latestSubmissionByProblem.get(p.id);
              const payload = codingAnswers[p.id] || codingAnswers[p.legacyId] || {};
              return [p.id, {
                code: sub?.code || payload.code || payload.submittedCode || '',
                language: sub?.language || payload.language || 'javascript',
              }];
            })
        ),
        theoryScore,
        codingScore,
        totalScore,
        maxScore,
        percentage,
        details: {
          totalQuestions: orderedProblems.length,
          answeredQuestions: answeredCount,
          theoryCount,
          codingCount,
          maxTheoryScore,
          maxCodingScore,
          questions: details,
        },
      },
    });

    // Update TestAttempt status in database to SUBMITTED or AUTO_SUBMITTED
    const attemptStatus = isAutoSubmit ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    const existingAttempt = await prisma.testAttempt.findFirst({
      where: { assignmentId: assignment.id, userId },
      orderBy: { startedAt: 'desc' },
    });

    if (existingAttempt) {
      await prisma.testAttempt.update({
        where: { id: existingAttempt.id },
        data: {
          // Keep the status set when the attempt ended (time up / malpractice) for the reports.
          status: ['INTERRUPTED', 'COMPLETED'].includes(existingAttempt.status) ? existingAttempt.status : attemptStatus,
          submittedAt: new Date(),
          finishedAt: existingAttempt.finishedAt || new Date(),
          score: totalScore,
          maxScore,
          percentage,
          assessmentSubmittedAt: new Date(),
        },
      });
    } else {
      await prisma.testAttempt.create({
        data: {
          userId,
          assignmentId: assignment.id,
          status: attemptStatus,
          startedAt: new Date(),
          endsAt: new Date(),
          submittedAt: new Date(),
          finishedAt: new Date(),
          score: totalScore,
          maxScore,
          percentage,
          assessmentSubmittedAt: new Date(),
        },
      });
    }

    return { result: await attachRankToResult(assessmentSubmission, assignment.id) };
}

// Saves the student's current answers on their attempt while they work (autosave), so nothing is
// lost if the browser closes or the final submit never reaches the server. `final` records that
// the student pressed Final Submit.
// Live Monitor check-in from the exam page: progress and camera flags (small, known fields only).
function sanitizeLiveProgress(progress) {
  if (!progress || typeof progress !== 'object') return null;
  const count = (value) => Math.max(0, Math.min(1000, Math.floor(Number(value) || 0)));
  return {
    answered: count(progress.answered),
    total: count(progress.total),
    current: count(progress.current),
    currentTitle: String(progress.currentTitle || '').slice(0, 120),
    cameraIssue: String(progress.cameraIssue || '').slice(0, 160),
    phoneDetected: Boolean(progress.phoneDetected),
    faceMissing: Boolean(progress.faceMissing),
  };
}

// Latest small camera snapshot (JPEG data URL, ~5 KB); anything else is ignored.
const MAX_SNAPSHOT_LENGTH = 60000;
function sanitizeSnapshot(snapshot) {
  const value = String(snapshot || '');
  return value.startsWith('data:image/jpeg;base64,') && value.length <= MAX_SNAPSHOT_LENGTH ? value : null;
}

exports.saveDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { final = false } = body;
    const hasAnswers = 'theoryAnswers' in body || 'codingAnswers' in body;
    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) return res.status(404).json({ error: 'assignment not found' });

    const attempt = await prisma.testAttempt.findFirst({
      where: { assignmentId: assignment.id, userId: req.user.id },
      orderBy: [{ startedAt: 'desc' }],
      select: { id: true, userId: true, assignmentId: true, startedAt: true, assessmentSubmittedAt: true, submitRequestedAt: true },
    });
    if (!attempt || !inCurrentRun(attempt, assignment)) {
      return res.status(404).json({ error: 'attempt not found' });
    }
    if (attempt.assessmentSubmittedAt) {
      return res.json({ ok: true, alreadySubmitted: true });
    }

    const now = new Date();
    // Every call is also a Live Monitor check-in. Answers are only sent when they changed.
    const update = { lastSeenAt: now };
    if (hasAnswers) {
      update.draftAnswers = { theoryAnswers: body.theoryAnswers || {}, codingAnswers: body.codingAnswers || {} };
      update.draftSavedAt = now;
    }
    const liveProgress = sanitizeLiveProgress(body.progress);
    if (liveProgress) update.liveProgress = liveProgress;
    const snapshot = sanitizeSnapshot(body.snapshot);
    if (snapshot) {
      update.liveSnapshot = snapshot;
      update.liveSnapshotAt = now;
    }
    if (final && !attempt.submitRequestedAt) update.submitRequestedAt = now;

    // $set only these fields so a concurrent attempt update (warnings, finish) is not overwritten.
    const collection = await attemptsCollection();
    await collection.updateOne({ _id: attemptObjectId(attempt) }, { $set: update });
    return res.json({ ok: true, savedAt: now });
  } catch (error) {
    console.error('Error saving exam draft:', error);
    return res.status(500).json({ error: 'Failed to save answers.' });
  }
};

// After this long without a successful submit, the server submits the saved answers itself.
const AUTO_SUBMIT_AFTER_MS = Number(process.env.EXAM_AUTO_SUBMIT_AFTER_MS || 5 * 60 * 1000);

function attemptDeadline(attempt, assignment) {
  const deadlines = [];
  const startedAt = new Date(attempt.startedAt).getTime();
  if (Number.isFinite(startedAt)) deadlines.push(startedAt + (assignment.durationMinutes || 60) * 60 * 1000);
  const endsAt = assignment.endsAt ? new Date(assignment.endsAt).getTime() : NaN;
  if (Number.isFinite(endsAt)) deadlines.push(endsAt);
  return deadlines.length ? Math.min(...deadlines) : NaN;
}

// Submits exams that were never submitted, from the autosaved answers: Final Submit pressed but
// never reached the server, time ran out / test ended, or the student closed the browser.
// Only attempts with autosaved answers are considered (older attempts are left untouched).
async function autoSubmitPendingAttempts() {
  const collection = await attemptsCollection();
  const pending = await collection.find({
    draftSavedAt: { $exists: true },
    assessmentSubmittedAt: { $exists: false },
  }, { projection: { liveSnapshot: 0 } }).toArray();
  if (!pending.length) return 0;

  const now = Date.now();
  const assignmentCache = new Map();
  let submitted = 0;

  for (const raw of pending) {
    const attempt = { ...raw, id: String(raw._id) };
    const assignmentId = String(attempt.assignmentId);
    if (!assignmentCache.has(assignmentId)) {
      assignmentCache.set(assignmentId, await prisma.testAssignment.findUnique({ where: { id: assignmentId } }));
    }
    const assignment = assignmentCache.get(assignmentId);
    if (!assignment || !inCurrentRun(attempt, assignment)) continue;

    const triggers = [
      attempt.submitRequestedAt ? new Date(attempt.submitRequestedAt).getTime() : NaN,
      attempt.status !== 'IN_PROGRESS' && attempt.finishedAt ? new Date(attempt.finishedAt).getTime() : NaN,
      attemptDeadline(attempt, assignment),
    ].filter(Number.isFinite);
    if (!triggers.length || now - Math.min(...triggers) < AUTO_SUBMIT_AFTER_MS) continue;

    try {
      const draft = attempt.draftAnswers || {};
      await finalizeAssessment(assignment, String(attempt.userId), {
        theoryAnswers: draft.theoryAnswers || {},
        codingAnswers: draft.codingAnswers || {},
        isAutoSubmit: true,
      });
      await markAttemptSubmitted(assignment.id, String(attempt.userId));
      submitted += 1;
    } catch (error) {
      console.error('Auto-submit failed for attempt', attempt.id, error);
    }
  }

  return submitted;
}

exports.autoSubmitPendingAttempts = autoSubmitPendingAttempts;

exports.getAssessmentResult = async (req, res) => {
  try {
    let { id } = req.params;
    const userId = req.user.id;

    if (id === 'active') {
      const activeAssignment = await prisma.testAssignment.findFirst({
        where: { status: 'LIVE' },
        orderBy: { startsAt: 'desc' },
      });
      if (activeAssignment) {
        id = activeAssignment.id;
      }
    }

    const result = await prisma.assessmentSubmission.findFirst({
      where: {
        ...(id && id !== 'active' ? { assignmentId: id } : {}),
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) {
      return res.status(404).json({ error: 'result not found' });
    }

    const rankedResult = await attachRankToResult(result, result.assignmentId);
    return res.json({ result: rankedResult });
  } catch (error) {
    console.error('Error fetching assessment result:', error);
    return res.status(500).json({ error: 'server error' });
  }
};
