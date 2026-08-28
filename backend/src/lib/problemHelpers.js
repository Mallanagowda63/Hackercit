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

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((opt) => String(opt || '').trim())
    .filter(Boolean);
}

function normalizeProblemPayload(input) {
  const type = String(input?.type || 'coding').trim().toLowerCase() === 'theory' ? 'theory' : 'coding';
  const title = String(input?.title || '').trim();
  const statement = String(input?.statement || input?.description || '').trim();
  const difficulty = normalizeDifficulty(input?.difficulty) || 'MEDIUM';
  const slugSource = String(input?.slug || title).trim();
  const number = normalizeProblemNumber(input?.number ?? input?.legacyId);
  const defaultMarks = type === 'theory' ? 2 : 10;
  const marks = Math.max(1, Number(input?.marks || defaultMarks));

  if (!title) {
    throw new Error('title required');
  }

  if (!statement) {
    throw new Error('statement required');
  }

  const slug = slugify(slugSource, { lower: true, strict: true });
  if (!slug) {
    throw new Error('unable to build slug');
  }

  if (type === 'theory') {
    const options = normalizeOptions(input?.options);
    if (options.length < 2 || options.length > 6) {
      throw new Error('theory question must contain between 2 and 6 non-empty options');
    }

    const correctAnswer = String(input?.correctAnswer || '').trim();
    if (!correctAnswer) {
      throw new Error('correct answer required for theory question');
    }

    const payload = {
      type: 'theory',
      title,
      slug,
      fnName: null,
      difficulty,
      tags: normalizeStringArray(input?.tags),
      acceptance: input?.acceptance ? String(input.acceptance).trim() : 'Theory MCQ',
      statement,
      options,
      correctAnswer,
      explanation: input?.explanation ? String(input.explanation).trim() : null,
      marks,
      examples: [],
      starterCode: { javascript: '', python: '', java: '' },
      testCases: [],
      constraints: [],
      samples: [],
    };

    if (number !== null) {
      payload.legacyId = number;
    }

    return payload;
  }

  const examples = normalizeExamples(input?.examples);
  const testCases = normalizeTestCases(input?.testCases);
  const samples = input?.samples ?? examples;

  const payload = {
    type: 'coding',
    title,
    slug,
    fnName: input?.fnName ? String(input.fnName).trim() : 'solve',
    difficulty,
    tags: normalizeStringArray(input?.tags),
    acceptance: input?.acceptance ? String(input.acceptance).trim() : null,
    statement,
    examples,
    starterCode: normalizeStarterCode(input?.starterCode),
    testCases,
    constraints: normalizeStringArray(input?.constraints),
    samples,
    options: null,
    correctAnswer: null,
    explanation: input?.explanation ? String(input.explanation).trim() : null,
    marks,
  };

  if (number !== null) {
    payload.legacyId = number;
  }

  return payload;
}

function serializeProblem(problem, options = {}) {
  const includeContent = Boolean(options.includeContent);
  const isCandidate = Boolean(options.isCandidate);
  const type = problem.type || (Array.isArray(problem.options) && problem.options.length ? 'theory' : 'coding');

  const serialized = {
    id: problem.id,
    type,
    number: problem.legacyId ?? null,
    title: problem.title,
    slug: problem.slug,
    fnName: problem.fnName || null,
    difficulty: toClientDifficulty(problem.difficulty),
    dbDifficulty: problem.difficulty,
    tags: problem.tags || [],
    acceptance: problem.acceptance || null,
    marks: problem.marks || (type === 'theory' ? 2 : 10),
    createdAt: problem.createdAt,
    updatedAt: problem.updatedAt,
  };

  if (!includeContent) {
    return serialized;
  }

  const result = {
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
    options: Array.isArray(problem.options) ? problem.options : [],
  };

  // Security: Candidate endpoints MUST NOT receive correctAnswer or explanation prior to submission
  if (!isCandidate) {
    result.correctAnswer = problem.correctAnswer || null;
    result.explanation = problem.explanation || null;
  }

  return result;
}

module.exports = {
  normalizeDifficulty,
  normalizeProblemPayload,
  serializeProblem,
  toClientDifficulty,
};
