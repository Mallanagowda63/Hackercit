const prisma = require('../prismaClient');
const { executeSubmission } = require('../lib/executionService');

async function attachRankToResult(result, assignmentId) {
  if (!result || !assignmentId) return result;

  const allSubmissions = await prisma.assessmentSubmission.findMany({
    where: { assignmentId },
    orderBy: [
      { totalScore: 'desc' },
      { createdAt: 'asc' },
    ],
  });

  const index = allSubmissions.findIndex((sub) => sub.id === result.id || sub.userId === result.userId);
  const rank = index !== -1 ? index + 1 : 1;

  return {
    ...result,
    rank,
    userRank: rank,
    totalParticipants: allSubmissions.length,
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

    // Duplicate submission protection: if student already submitted this exam, return existing result
    const existingSubmission = await prisma.assessmentSubmission.findFirst({
      where: { assignmentId: assignment.id, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingSubmission) {
      const rankedExisting = await attachRankToResult(existingSubmission, assignment.id);
      return res.status(200).json({
        ok: true,
        alreadySubmitted: true,
        message: 'Exam already submitted.',
        result: rankedExisting,
      });
    }

    const problemIds = assignment.problemIds || [];
    if (!problemIds.length) {
      return res.status(400).json({ error: 'assignment contains no questions' });
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
          status: attemptStatus,
          submittedAt: new Date(),
          finishedAt: new Date(),
          score: totalScore,
          maxScore,
          percentage,
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
        },
      });
    }

    const rankedResult = await attachRankToResult(assessmentSubmission, assignment.id);

    return res.status(201).json({
      ok: true,
      result: rankedResult,
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({ error: 'Failed to evaluate assessment submission.' });
  }
};

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
