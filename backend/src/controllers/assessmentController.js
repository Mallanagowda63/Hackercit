const prisma = require('../prismaClient');

exports.submitAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { theoryAnswers = {}, codingAnswers = {} } = req.body || {};

    const assignment = await prisma.testAssignment.findUnique({ where: { id } });
    if (!assignment) {
      return res.status(404).json({ error: 'assignment not found' });
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

    // Fetch candidate's coding submissions for coding questions in this test
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

    const details = orderedProblems.map((problem) => {
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

      const clientCodingPayload = codingAnswers[problem.id] || codingAnswers[problem.legacyId] || {};
      const dbSub = latestSubmissionByProblem.get(problem.id);

      const code = dbSub?.code || clientCodingPayload.code || '';
      const language = dbSub?.language || clientCodingPayload.language || 'javascript';

      const isAnswered = Boolean(String(code || '').trim());
      if (isAnswered) answeredCount += 1;

      let status = 'No Submission';
      let earnedMarks = 0;
      let passCount = 0;
      let totalTests = Array.isArray(problem.testCases) && problem.testCases.length ? problem.testCases.length : 10;

      if (dbSub) {
        if (dbSub.status === 'ACCEPTED') {
          earnedMarks = maxMarks;
          status = 'ACCEPTED';
          passCount = Array.isArray(dbSub.results) && dbSub.results.length ? dbSub.results.filter((t) => t.status === 'pass').length : totalTests;
          totalTests = Array.isArray(dbSub.results) && dbSub.results.length ? dbSub.results.length : totalTests;
        } else if (dbSub.results && Array.isArray(dbSub.results) && dbSub.results.length) {
          passCount = dbSub.results.filter((t) => t.status === 'pass').length;
          totalTests = dbSub.results.length;
          const ratio = passCount / totalTests;
          earnedMarks = Math.round(ratio * maxMarks * 100) / 100;
          if (passCount === totalTests) {
            status = 'ACCEPTED';
          } else if (passCount > 0) {
            status = 'PARTIAL';
          } else {
            status = dbSub.status || 'WRONG_ANSWER';
          }
        } else {
          status = dbSub.status || 'WRONG_ANSWER';
        }
      } else if (clientCodingPayload.status === 'passed' || clientCodingPayload.status === 'ACCEPTED') {
        earnedMarks = maxMarks;
        status = 'ACCEPTED';
        passCount = totalTests;
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
    });

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
            .map((p) => [p.id, {
              code: latestSubmissionByProblem.get(p.id)?.code || codingAnswers[p.id]?.code || '',
              language: latestSubmissionByProblem.get(p.id)?.language || codingAnswers[p.id]?.language || 'javascript',
            }])
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

    return res.status(201).json({
      ok: true,
      result: assessmentSubmission,
    });
  } catch (error) {
    console.error('Error submitting assessment:', error);
    return res.status(500).json({ error: 'Failed to evaluate assessment submission.' });
  }
};

exports.getAssessmentResult = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await prisma.assessmentSubmission.findFirst({
      where: {
        assignmentId: id,
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) {
      return res.status(404).json({ error: 'result not found' });
    }

    return res.json({ result });
  } catch (error) {
    console.error('Error fetching assessment result:', error);
    return res.status(500).json({ error: 'server error' });
  }
};
