const slugify = require('slugify');

const DIFFICULTY_TO_DB = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

const DIFFICULTY_TO_CLIENT = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

function normalizeDifficulty(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();
  return DIFFICULTY_TO_DB[normalized] || null;
}

function toClientDifficulty(value) {
  return DIFFICULTY_TO_CLIENT[value] || value || 'Medium';
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeExamples(value) {
  if (!Array.isArray(value)) return [];
  return value.map((example) => ({
    input: String(example?.input || ''),
    output: String(example?.output || ''),
    explanation: String(example?.explanation || ''),
  }));
}

function normalizeStarterCode(value) {
  const fallback = { javascript: '', python: '', java: '' };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return {
    javascript: String(value.javascript || ''),
    python: String(value.python || ''),
    java: String(value.java || ''),
  };
}

function normalizeTestCases(value) {
  if (!Array.isArray(value)) return [];
  return value.map((testCase) => ({
    input: String(testCase?.input || ''),
    expected: String(testCase?.expected || ''),
  }));
}

function normalizeProblemNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeProblemPayload(input) {
  const title = String(input?.title || '').trim();
  const statement = String(input?.statement || input?.description || '').trim();
  const difficulty = normalizeDifficulty(input?.difficulty);
  const slugSource = String(input?.slug || title).trim();
  const number = normalizeProblemNumber(input?.number ?? input?.legacyId);

  if (!title) {
    throw new Error('title required');
  }

  if (!statement) {
    throw new Error('statement required');
  }

  if (!difficulty) {
    throw new Error('valid difficulty required');
  }

  const slug = slugify(slugSource, { lower: true, strict: true });
  if (!slug) {
    throw new Error('unable to build slug');
  }

  const examples = normalizeExamples(input?.examples);
  const testCases = normalizeTestCases(input?.testCases);
  const samples = input?.samples ?? examples;

  const payload = {
    title,
    slug,
    fnName: input?.fnName ? String(input.fnName).trim() : null,
    difficulty,
    tags: normalizeStringArray(input?.tags),
    acceptance: input?.acceptance ? String(input.acceptance).trim() : null,
    statement,
    examples,
    starterCode: normalizeStarterCode(input?.starterCode),
    testCases,
    constraints: normalizeStringArray(input?.constraints),
    samples,
  };

  if (number !== null) {
    payload.legacyId = number;
  }

  return payload;
}

function serializeProblem(problem, options = {}) {
  const includeContent = Boolean(options.includeContent);
  const serialized = {
    id: problem.id,
    number: problem.legacyId ?? null,
    title: problem.title,
    slug: problem.slug,
    fnName: problem.fnName || null,
    difficulty: toClientDifficulty(problem.difficulty),
    dbDifficulty: problem.difficulty,
    tags: problem.tags || [],
    acceptance: problem.acceptance || null,
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };

  if (!includeContent) {
    return serialized;
  }

  return {
    ...serialized,
    description: problem.statement,
    statement: problem.statement,
    examples: Array.isArray(problem.examples) ? problem.examples : [],
    starterCode: problem.starterCode && typeof problem.starterCode === 'object'
      ? problem.starterCode
      : { javascript: '', python: '', java: '' },
    testCases: Array.isArray(problem.testCases) ? problem.testCases : [],
    constraints: Array.isArray(problem.constraints) ? problem.constraints : [],
    samples: Array.isArray(problem.samples) ? problem.samples : [],
  };
}

module.exports = {
  normalizeDifficulty,
  normalizeProblemPayload,
  serializeProblem,
  toClientDifficulty,
};
