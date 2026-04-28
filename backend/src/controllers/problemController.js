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
    const existing = await prisma.problem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'not found' });

    const merged = {
      ...existing,
      ...req.body,
      statement: req.body.statement ?? req.body.description ?? existing.statement,
    };
    const data = normalizeProblemPayload(merged);
    const updated = await prisma.problem.update({ where: { id }, data });
    return res.json({ problem: serializeProblem(updated, { includeContent: true }) });
  } catch (err) {
    return sendProblemError(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.problem.delete({ where: { id } });
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
