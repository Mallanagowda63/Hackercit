const prisma = require('../prismaClient');
const { effectiveRole } = require('../lib/adminConfig');
const { OFFSET_MINUTES } = require('../lib/streakService');

// Monthly coding challenge: the admin picks problems for a calendar month (India time by default),
// students solve them during that month, and the top 3 win the prizes (a hoodie and gifts).
// Only accepted submissions made inside the month count. Score is by difficulty; ties go to the
// student who reached that score first, then to fewer wrong attempts.
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DEFAULT_PRIZES = Object.freeze([
  'DevOrbit Hoodie + Premium Gift Hamper',
  'DevOrbit Hoodie + Gift Kit',
  'DevOrbit Hoodie + Goodies',
]);
const DIFFICULTY_POINTS = { EASY: 20, MEDIUM: 35, HARD: 50 };
const WINNER_COUNT = 3;
const STANDINGS_CACHE_MS = Number(process.env.CHALLENGE_STANDINGS_CACHE_MS || 30000);
const MAX_TEXT = { title: 120, description: 2000, prize: 160 };

const standingsCache = new Map();

function clearStandingsCache() {
  standingsCache.clear();
}

function monthWindow(month) {
  const [, year, monthNumber] = month.match(MONTH_PATTERN);
  const offsetMs = OFFSET_MINUTES * 60 * 1000;
  return {
    startsAt: new Date(Date.UTC(Number(year), Number(monthNumber) - 1, 1) - offsetMs),
    endsAt: new Date(Date.UTC(Number(year), Number(monthNumber), 1) - offsetMs),
    label: `${MONTH_NAMES[Number(monthNumber) - 1]} ${year}`,
  };
}

function challengeStatus(challenge, now = Date.now()) {
  if (now < new Date(challenge.startsAt).getTime()) return 'UPCOMING';
  if (now >= new Date(challenge.endsAt).getTime()) return 'ENDED';
  return 'LIVE';
}

function problemPoints(problem) {
  return DIFFICULTY_POINTS[String(problem?.difficulty || '').toUpperCase()] || 20;
}

function displayName(user) {
  const name = String(user?.name || '').trim();
  if (name) return name;
  return String(user?.email || '').split('@')[0] || 'Student';
}

async function loadChallengeProblems(problemIds) {
  if (!problemIds?.length) return [];
  const problems = await prisma.problem.findMany({
    where: { id: { in: problemIds } },
    select: { id: true, title: true, slug: true, difficulty: true, legacyId: true, type: true, options: true },
  });
  const byId = new Map(problems.map((problem) => [String(problem.id), problem]));
  // Keep the admin's order.
  return problemIds
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((problem) => ({ ...problem, points: problemPoints(problem) }));
}

async function computeStandings(challenge, problems) {
  const cacheKey = `${challenge.id}:${new Date(challenge.updatedAt || 0).getTime()}`;
  const cached = standingsCache.get(cacheKey);
  if (cached && Date.now() - cached.builtAt < STANDINGS_CACHE_MS) return cached.standings;

  const startsAt = new Date(challenge.startsAt).getTime();
  const endsAt = new Date(challenge.endsAt).getTime();
  const problemsById = new Map(problems.map((problem) => [String(problem.id), problem]));

  const submissions = problems.length
    ? await prisma.submission.findMany({
      where: { problemId: { in: problems.map((problem) => problem.id) } },
      select: { id: true, userId: true, problemId: true, status: true, createdAt: true },
    })
    : [];

  const inWindow = submissions
    .filter((submission) => {
      const time = new Date(submission.createdAt).getTime();
      return time >= startsAt && time < endsAt;
    })
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  const byUser = new Map();
  inWindow.forEach((submission) => {
    const userId = String(submission.userId);
    const problemId = String(submission.problemId);
    if (!problemsById.has(problemId)) return;

    const entry = byUser.get(userId) || { userId, problems: new Map() };
    const state = entry.problems.get(problemId) || { wrong: 0, acceptedAt: null };
    if (state.acceptedAt === null) {
      if (submission.status === 'ACCEPTED') {
        state.acceptedAt = new Date(submission.createdAt).getTime();
      } else {
        state.wrong += 1;
      }
    }
    entry.problems.set(problemId, state);
    byUser.set(userId, entry);
  });

  const users = byUser.size
    ? await prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: { id: true, name: true, email: true, usn: true, department: true, role: true },
    })
    : [];
  const usersById = new Map(users.map((user) => [String(user.id), user]));

  const rows = [];
  byUser.forEach((entry, userId) => {
    const user = usersById.get(userId);
    if (!user || String(effectiveRole(user) || '').toUpperCase() === 'ADMIN') return;

    let score = 0;
    let solved = 0;
    let wrongAttempts = 0;
    let finishedAt = 0;
    const solvedProblemIds = [];
    entry.problems.forEach((state, problemId) => {
      if (state.acceptedAt === null) return;
      solved += 1;
      score += problemsById.get(problemId).points;
      wrongAttempts += state.wrong;
      finishedAt = Math.max(finishedAt, state.acceptedAt);
      solvedProblemIds.push(problemId);
    });

    rows.push({
      userId,
      name: displayName(user),
      usn: user.usn || '',
      department: user.department || '',
      score,
      solved,
      wrongAttempts,
      finishedAt: finishedAt ? new Date(finishedAt).toISOString() : null,
      solvedProblemIds,
    });
  });

  rows.sort((left, right) => (
    right.score - left.score
    || right.solved - left.solved
    || (left.finishedAt ? Date.parse(left.finishedAt) : Infinity) - (right.finishedAt ? Date.parse(right.finishedAt) : Infinity)
    || left.wrongAttempts - right.wrongAttempts
    || left.name.localeCompare(right.name)
  ));

  // Students with no accepted solution are listed as participants but never ranked as winners.
  let rank = 0;
  const standings = rows.map((row) => {
    if (row.score > 0) rank += 1;
    return { ...row, rank: row.score > 0 ? rank : null };
  });

  standingsCache.set(cacheKey, { standings, builtAt: Date.now() });
  return standings;
}

function presentChallenge(challenge) {
  return {
    id: challenge.id,
    title: challenge.title,
    month: challenge.month,
    monthLabel: monthWindow(challenge.month).label,
    description: challenge.description || '',
    prizes: Array.isArray(challenge.prizes) && challenge.prizes.length ? challenge.prizes : [...DEFAULT_PRIZES],
    problemIds: (challenge.problemIds || []).map(String),
    startsAt: challenge.startsAt,
    endsAt: challenge.endsAt,
    status: challengeStatus(challenge),
    createdAt: challenge.createdAt,
    updatedAt: challenge.updatedAt,
  };
}

async function buildChallengeDetail(challenge, { userId = null, limit = null } = {}) {
  const problems = await loadChallengeProblems((challenge.problemIds || []).map(String));
  const standings = await computeStandings(challenge, problems);
  const presented = presentChallenge(challenge);
  const winners = presented.status === 'ENDED'
    ? standings.filter((row) => row.rank && row.rank <= WINNER_COUNT)
    : [];
  const me = userId ? standings.find((row) => row.userId === String(userId)) || null : null;

  return {
    ...presented,
    problems: problems.map(({ id, title, slug, difficulty, legacyId, points }) => ({ id, title, slug, difficulty, legacyId, points })),
    maxScore: problems.reduce((total, problem) => total + problem.points, 0),
    participantCount: standings.length,
    standings: typeof limit === 'number' ? standings.slice(0, limit) : standings,
    winners,
    me,
  };
}

function readChallengeInput(body) {
  const title = String(body?.title || '').trim().slice(0, MAX_TEXT.title);
  const month = String(body?.month || '').trim();
  const description = String(body?.description || '').trim().slice(0, MAX_TEXT.description);
  const problemIds = [...new Set((Array.isArray(body?.problemIds) ? body.problemIds : []).map((id) => String(id || '').trim()).filter(Boolean))];
  const prizes = (Array.isArray(body?.prizes) ? body.prizes : [])
    .slice(0, WINNER_COUNT)
    .map((prize, index) => String(prize || '').trim().slice(0, MAX_TEXT.prize) || DEFAULT_PRIZES[index]);
  while (prizes.length < WINNER_COUNT) prizes.push(DEFAULT_PRIZES[prizes.length]);

  if (!MONTH_PATTERN.test(month)) return { error: 'Choose the challenge month.' };
  if (!problemIds.length) return { error: 'Pick at least one problem for the challenge.' };
  if (!problemIds.every((id) => /^[0-9a-f]{24}$/i.test(id))) return { error: 'One of the selected problems is not valid.' };

  const window = monthWindow(month);
  return {
    data: {
      title: title || `${window.label} Coding Challenge`,
      month,
      description,
      problemIds,
      prizes,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    },
  };
}

async function validateProblems(problemIds) {
  const problems = await loadChallengeProblems(problemIds);
  if (problems.length !== problemIds.length) return 'Some selected problems no longer exist. Refresh and try again.';
  if (problems.some((problem) => problem.type === 'theory' || (Array.isArray(problem.options) && problem.options.length))) return 'Only coding problems can be used in the monthly challenge.';
  return null;
}

// GET /api/challenges: every challenge, newest month first, with winners of finished ones.
exports.list = async (req, res) => {
  try {
    const challenges = await prisma.monthlyChallenge.findMany({ orderBy: { month: 'desc' } });
    const result = await Promise.all(challenges.map(async (challenge) => {
      const detail = await buildChallengeDetail(challenge, { limit: WINNER_COUNT });
      const { standings, me, ...rest } = detail;
      return { ...rest, topThree: standings.filter((row) => row.rank) };
    }));
    return res.json({ challenges: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load monthly challenges.' });
  }
};

// GET /api/challenges/current: this month's challenge (or the next one, or the last one), with the
// top 10, the signed-in student's own position, and the previous challenge's winners.
exports.current = async (req, res) => {
  try {
    const challenges = await prisma.monthlyChallenge.findMany({ orderBy: { month: 'desc' } });
    const now = Date.now();
    const live = challenges.find((challenge) => challengeStatus(challenge, now) === 'LIVE');
    const upcoming = [...challenges].reverse().find((challenge) => challengeStatus(challenge, now) === 'UPCOMING');
    const ended = challenges.filter((challenge) => challengeStatus(challenge, now) === 'ENDED');
    const current = live || upcoming || ended[0] || null;

    const previous = ended.find((challenge) => !current || challenge.id !== current.id) || null;
    const [currentDetail, previousDetail] = await Promise.all([
      current ? buildChallengeDetail(current, { userId: req.user.id, limit: 10 }) : null,
      previous ? buildChallengeDetail(previous, { limit: WINNER_COUNT }) : null,
    ]);

    return res.json({
      challenge: currentDetail,
      previous: previousDetail
        ? { id: previousDetail.id, title: previousDetail.title, monthLabel: previousDetail.monthLabel, prizes: previousDetail.prizes, winners: previousDetail.winners }
        : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load the monthly challenge.' });
  }
};

// GET /api/challenges/:id: full standings (admin).
exports.get = async (req, res) => {
  try {
    const challenge = await prisma.monthlyChallenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });
    return res.json({ challenge: await buildChallengeDetail(challenge, { userId: req.user.id }) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to load the challenge.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { data, error } = readChallengeInput(req.body);
    if (error) return res.status(400).json({ error });

    const existing = await prisma.monthlyChallenge.findFirst({ where: { month: data.month } });
    if (existing) return res.status(409).json({ error: `There is already a challenge for ${monthWindow(data.month).label}.` });

    const problemError = await validateProblems(data.problemIds);
    if (problemError) return res.status(400).json({ error: problemError });

    const challenge = await prisma.monthlyChallenge.create({ data: { ...data, createdById: req.user.id } });
    clearStandingsCache();
    return res.status(201).json({ challenge: presentChallenge(challenge) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to create the challenge.' });
  }
};

exports.update = async (req, res) => {
  try {
    const challenge = await prisma.monthlyChallenge.findUnique({ where: { id: req.params.id } });
    if (!challenge) return res.status(404).json({ error: 'challenge not found' });

    const { data, error } = readChallengeInput(req.body);
    if (error) return res.status(400).json({ error });

    const clash = await prisma.monthlyChallenge.findFirst({ where: { month: data.month } });
    if (clash && clash.id !== challenge.id) {
      return res.status(409).json({ error: `There is already a challenge for ${monthWindow(data.month).label}.` });
    }

    const problemError = await validateProblems(data.problemIds);
    if (problemError) return res.status(400).json({ error: problemError });

    const updated = await prisma.monthlyChallenge.update({ where: { id: challenge.id }, data });
    clearStandingsCache();
    return res.json({ challenge: presentChallenge(updated) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to update the challenge.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const removed = await prisma.monthlyChallenge.delete({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ error: 'challenge not found' });
    clearStandingsCache();
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to delete the challenge.' });
  }
};

exports.clearStandingsCache = clearStandingsCache;
exports.monthWindow = monthWindow;
exports.computeStandings = computeStandings;
