const prisma = require('../prismaClient');
const { normalizeProblemPayload, serializeProblem } = require('../lib/problemHelpers');

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
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const { slug } = req.params;
    const problem = await prisma.problem.findUnique({ where: { slug } });
    if (!problem) return res.status(404).json({ error: 'not found' });
    return res.json({ problem: serializeProblem(problem, { includeContent: true }) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = normalizeProblemPayload(req.body);
    const problem = await prisma.problem.create({ data });
    return res.status(201).json({ problem: serializeProblem(problem, { includeContent: true }) });
  } catch (err) {
    if (err.message && err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: 'server error' });
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
    if (err.message && err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.problem.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
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
      const problem = await prisma.problem.upsert({
        where: { slug: data.slug },
        update: data,
        create: data,
      });
      imported.push(problem);
    }

    return res.json({
      ok: true,
      count: imported.length,
      problems: imported.map((problem) => serializeProblem(problem, { includeContent: false })),
    });
  } catch (err) {
    if (err.message && err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
