const prisma = require('../prismaClient');
const { normalizeProblemPayload, serializeProblem } = require('../lib/problemHelpers');

function isDuplicateProblemError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 11000
    || error?.code === 'P2002'
    || message.includes('duplicate key')
    || message.includes('unique constraint');
}

function getDuplicateProblemMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  const field = error?.keyValue && typeof error.keyValue === 'object'
    ? Object.keys(error.keyValue)[0]
    : '';

  if (field === 'slug' || message.includes('slug')) {
    return 'A question with this title already exists. Change the title and upload again.';
  }

  if (field === 'legacyId' || message.includes('legacyid') || message.includes('number')) {
    return 'A question with this number already exists.';
  }

  return 'This question already exists.';
}

function isDatabaseConnectionError(error) {
  const message = String(error?.message || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();
  return message.includes('database connection')
    || message.includes('invalid scheme')
    || message.includes('invalid connection string')
    || message.includes('uri malformed')
    || message.includes('server selection')
    || message.includes('failed to connect')
    || message.includes('econnrefused')
    || message.includes('enotfound')
    || name.includes('mongo');
}

function sendProblemError(res, err) {
  if (err.message && err.message.includes('required')) {
    return res.status(400).json({ error: err.message });
  }

  if (isDuplicateProblemError(err)) {
    return res.status(409).json({ error: getDuplicateProblemMessage(err) });
  }

  if (isDatabaseConnectionError(err)) {
    return res.status(503).json({ error: 'database connection failed. Check that MongoDB is running and configured with MONGODB_URI or MONGO_URL.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'server error' });
}

async function getNextProblemLegacyId() {
  const latestProblem = await prisma.problem.findFirst({
    where: { legacyId: { not: null } },
    orderBy: { legacyId: 'desc' },
  });

  return Number(latestProblem?.legacyId || 0) + 1;
}

async function createProblemWithAutoNumber(data, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const payload = { ...data };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (payload.legacyId === undefined || payload.legacyId === null) {
      payload.legacyId = await getNextProblemLegacyId();
    }

    try {
      return await prisma.problem.create({ data: payload });
    } catch (err) {
      const duplicateNumber = isDuplicateProblemError(err)
        && (
          err?.keyValue?.legacyId !== undefined
          || String(err?.message || '').toLowerCase().includes('legacyid')
          || String(err?.message || '').toLowerCase().includes('number')
        );

      if (!duplicateNumber || attempt === maxAttempts - 1) {
        throw err;
      }

      delete payload.legacyId;
    }
  }

  throw new Error('unable to assign a unique problem number');
}

exports.list = async (req, res) => {
  try {
    const includeContent = ['1', 'true', 'full'].includes(String(req.query.includeContent || req.query.full || '').toLowerCase());
    const problems = await prisma.problem.findMany({
      orderBy: [
        { legacyId: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return res.json({
      problems: problems.map((problem) => serializeProblem(problem, { includeContent })),
    });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.get = async (req, res) => {
  try {
    const { slug } = req.params;
    const problem = await prisma.problem.findUnique({ where: { slug } });
    if (!problem) return res.status(404).json({ error: 'not found' });
    return res.json({ problem: serializeProblem(problem, { includeContent: true }) });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.create = async (req, res) => {
  try {
    const data = normalizeProblemPayload(req.body);
    const problem = await createProblemWithAutoNumber(data);
    return res.status(201).json({ problem: serializeProblem(problem, { includeContent: true }) });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;
    try {
      existing = await prisma.problem.findUnique({ where: { id } });
    } catch (e) {
      // Ignore invalid ObjectId error
    }
    if (!existing) {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        existing = await prisma.problem.findFirst({ where: { legacyId: numId } });
      }
    }
    if (!existing) {
      existing = await prisma.problem.findUnique({ where: { slug: id } }).catch(() => null);
    }
    if (!existing) return res.status(404).json({ error: 'not found' });

    const merged = {
      ...existing,
      ...req.body,
      statement: req.body.statement ?? req.body.description ?? existing.statement,
    };
    const data = normalizeProblemPayload(merged);
    const updated = await prisma.problem.update({ where: { id: existing.id }, data });
    return res.json({ problem: serializeProblem(updated, { includeContent: true }) });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;
    try {
      existing = await prisma.problem.findUnique({ where: { id } });
    } catch (e) {
      // Ignore invalid ObjectId error
    }
    if (!existing) {
      const numId = Number(id);
      if (!Number.isNaN(numId)) {
        existing = await prisma.problem.findFirst({ where: { legacyId: numId } });
      }
    }
    if (!existing) {
      existing = await prisma.problem.findUnique({ where: { slug: id } }).catch(() => null);
    }
    if (!existing) return res.status(404).json({ error: 'not found' });

    await prisma.problem.delete({ where: { id: existing.id } });
    return res.json({ ok: true });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.importMany = async (req, res) => {
  try {
    const problems = Array.isArray(req.body?.problems) ? req.body.problems : [];
    if (!problems.length) {
      return res.status(400).json({ error: 'problems array required' });
    }

    const imported = [];
    for (const rawProblem of problems) {
      const data = normalizeProblemPayload(rawProblem);
      let problem;

      if (data.legacyId !== undefined) {
        const existingByLegacyId = await prisma.problem.findFirst({
          where: { legacyId: data.legacyId },
        });

        if (existingByLegacyId) {
          problem = await prisma.problem.update({
            where: { id: existingByLegacyId.id },
            data,
          });
        }
      }

      if (!problem) {
        try {
          problem = await prisma.problem.upsert({
            where: { slug: data.slug },
            update: data,
            create: data.legacyId === undefined
              ? { ...data, legacyId: await getNextProblemLegacyId() }
              : data,
          });
        } catch (err) {
          if (!isDuplicateProblemError(err)) {
            throw err;
          }

          const existing = await prisma.problem.findFirst({
            where: {
              OR: [
                { slug: data.slug },
                ...(data.legacyId !== undefined ? [{ legacyId: data.legacyId }] : []),
              ],
            },
          });

          if (!existing) {
            throw err;
          }

          problem = await prisma.problem.update({
            where: { id: existing.id },
            data,
          });

          if (!problem && !data.legacyId) {
            problem = await createProblemWithAutoNumber(data);
          }
        }
      }

      imported.push(problem);
    }

    return res.json({
      ok: true,
      count: imported.length,
      problems: imported.map((problem) => serializeProblem(problem, { includeContent: false })),
    });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

function parseMcqText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = text.split(/(?=(?:^|\n)(?:Q\d+[\.\:]|\d+[\.\)]|Question\s*\d+[\.\:]))/i);
  const extracted = [];

  blocks.forEach((block, index) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;

    let statement = lines[0].replace(/^(?:Q\d+[\.\:]|\d+[\.\)]|Question\s*\d+[\.\:]?)\s*/i, '').trim();
    let currentMode = 'statement';
    let statementLines = [statement];
    let optionMap = {};
    let rawCorrectAnswer = '';
    let marks = 2;
    let category = 'Python';
    let difficulty = 'Easy';
    let explanation = '';

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];

      // Match options like A. Foo, B) Bar, or single-line A. X B. Y C. Z D. W
      const inlineOptMatches = [...line.matchAll(/(?:^|\s+)([A-D])[\.\:\)\-]\s*([^A-D\.\:\)\-]+?)(?=(?:\s+[A-D][\.\:\)\-]|$))/gi)];
      const singleOptMatch = line.match(/^([A-D])[\.\:\)\-]\s*(.*)/i);
      const ansMatch = line.match(/^(?:Correct\s*Answer|Answer|Ans)[\:\=]\s*([A-D]|.+)/i);
      const marksMatch = line.match(/^(?:Marks|Points)[\:\=]\s*(\d+)/i);
      const catMatch = line.match(/^(?:Category|Topic)[\:\=]\s*(.+)/i);
      const diffMatch = line.match(/^Difficulty[\:\=]\s*(Easy|Medium|Hard)/i);
      const expMatch = line.match(/^(?:Explanation)[\:\=]\s*(.+)/i);

      if (inlineOptMatches.length >= 2) {
        currentMode = 'options';
        inlineOptMatches.forEach((m) => {
          const key = m[1].toUpperCase();
          optionMap[key] = m[2].trim();
        });
      } else if (singleOptMatch) {
        currentMode = 'options';
        const key = singleOptMatch[1].toUpperCase();
        optionMap[key] = singleOptMatch[2].trim();
      } else if (ansMatch) {
        rawCorrectAnswer = ansMatch[1].trim();
      } else if (marksMatch) {
        marks = parseInt(marksMatch[1], 10) || 2;
      } else if (catMatch) {
        category = catMatch[1].trim();
      } else if (diffMatch) {
        difficulty = diffMatch[1].trim();
      } else if (expMatch) {
        explanation = expMatch[1].trim();
      } else if (currentMode === 'statement') {
        statementLines.push(line);
      }
    }

    const fullStatement = statementLines.join(' ').trim();
    const optionKeys = ['A', 'B', 'C', 'D'];
    const options = optionKeys.map((k) => optionMap[k] || `Option ${k}`);

    let correctAnswerIndex = 0;
    let correctAnswerText = options[0];

    if (rawCorrectAnswer) {
      const upper = rawCorrectAnswer.toUpperCase().trim();
      if (['A', 'B', 'C', 'D'].includes(upper)) {
        correctAnswerIndex = optionKeys.indexOf(upper);
        correctAnswerText = options[correctAnswerIndex] || options[0];
      } else {
        // Try matching text directly
        const cleanRaw = rawCorrectAnswer.replace(/^[A-D][\.\:\)\-]\s*/i, '').trim().toLowerCase();
        const matchedIdx = options.findIndex((opt) => opt.toLowerCase() === cleanRaw || opt.toLowerCase().includes(cleanRaw));
        if (matchedIdx !== -1) {
          correctAnswerIndex = matchedIdx;
          correctAnswerText = options[matchedIdx];
        } else {
          correctAnswerText = rawCorrectAnswer;
        }
      }
    }

    const isMalformed = !fullStatement || Object.keys(optionMap).length < 2 || !rawCorrectAnswer;

    extracted.push({
      tempId: `pdf_q_${index + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: fullStatement.length > 80 ? `${fullStatement.slice(0, 80)}...` : fullStatement,
      statement: fullStatement || `Extracted Question ${index + 1}`,
      options,
      correctAnswerIndex,
      correctAnswer: correctAnswerText,
      marks: Number(marks) || 2,
      category: category || 'Python',
      difficulty: difficulty || 'Easy',
      explanation: explanation || '',
      isMalformed,
    });
  });

  return extracted;
}

exports.uploadMcqPdf = async (req, res) => {
  try {
    const { textContent = '', rawText = '' } = req.body || {};
    const textToParse = textContent || rawText || '';

    if (!textToParse.trim()) {
      return res.status(400).json({ error: 'No text content provided for extraction.' });
    }

    const parsedQuestions = parseMcqText(textToParse);
    return res.json({
      ok: true,
      count: parsedQuestions.length,
      questions: parsedQuestions,
    });
  } catch (err) {
    console.error('Error parsing MCQ PDF:', err);
    return res.status(500).json({ error: 'Failed to extract questions from PDF/text.' });
  }
};

exports.importBulkMcqs = async (req, res) => {
  try {
    const { questions = [] } = req.body || {};
    if (!Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ error: 'No questions provided for import.' });
    }

    const createdProblems = [];

    for (const q of questions) {
      const title = String(q.title || q.statement || 'Theory Question').trim();
      const statement = String(q.statement || title).trim();
      const category = String(q.category || 'Python').trim();
      const difficulty = String(q.difficulty || 'Easy').trim();
      const marks = Number(q.marks) || 2;
      const options = Array.isArray(q.options) && q.options.length ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
      const correctAnswer = String(q.correctAnswer || options[0] || '').trim();
      const explanation = String(q.explanation || '').trim();

      const rawProblem = {
        type: 'theory',
        title,
        statement,
        category,
        difficulty,
        marks,
        options,
        correctAnswer,
        explanation,
        tags: [category],
      };

      const data = normalizeProblemPayload(rawProblem);
      let problem;

      try {
        problem = await createProblemWithAutoNumber(data);
      } catch (err) {
        if (isDuplicateProblemError(err)) {
          data.title = `${title} (Imported ${Date.now() % 10000})`;
          data.slug = `${data.slug}-${Date.now() % 10000}`;
          problem = await createProblemWithAutoNumber(data);
        } else {
          throw err;
        }
      }

      if (problem) {
        createdProblems.push(problem);
      }
    }

    return res.json({
      ok: true,
      count: createdProblems.length,
      problems: createdProblems.map((p) => serializeProblem(p, { includeContent: true })),
    });
  } catch (err) {
    console.error('Error importing bulk MCQs:', err);
    return sendProblemError(res, err);
  }
};

