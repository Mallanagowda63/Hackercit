const prisma = require('../prismaClient');

const BADGE_DEFINITIONS = Object.freeze({
  SILVER: Object.freeze({
    id: 'silver',
    tier: 'SILVER',
    label: 'Silver Solver',
    minimumSolved: 51,
  }),
  GOLD: Object.freeze({
    id: 'gold',
    tier: 'GOLD',
    label: 'Gold Solver',
    minimumSolved: 100,
  }),
});

function resolveBadgeForSolvedCount(solvedProblemCount) {
  const count = Number(solvedProblemCount || 0);

  if (count >= BADGE_DEFINITIONS.GOLD.minimumSolved) {
    return BADGE_DEFINITIONS.GOLD;
  }

  if (count >= BADGE_DEFINITIONS.SILVER.minimumSolved) {
    return BADGE_DEFINITIONS.SILVER;
  }

  return null;
}

function getBadgePresentation(user = {}) {
  const badge = BADGE_DEFINITIONS[String(user.badgeTier || '').toUpperCase()]
    || resolveBadgeForSolvedCount(user.solvedProblemCount);

  return {
    badgeTier: badge?.tier || null,
    badgeLabel: badge?.label || null,
    badgeIds: badge ? [badge.id] : [],
    solvedProblemCount: Number(user.solvedProblemCount || 0),
  };
}

async function getSolvedProblemCount(userId) {
  const acceptedSubmissions = await prisma.submission.findMany({
    where: {
      userId,
      status: 'ACCEPTED',
    },
    select: { problemId: true },
  });

  return new Set(
    acceptedSubmissions
      .map((submission) => String(submission.problemId || '').trim())
      .filter(Boolean),
  ).size;
}

function normalizeBadgeIds(badgeIds) {
  return Array.isArray(badgeIds)
    ? [...badgeIds].map((badgeId) => String(badgeId || '').trim()).filter(Boolean).sort()
    : [];
}

async function syncUserBadge(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const solvedProblemCount = await getSolvedProblemCount(userId);
  const badge = resolveBadgeForSolvedCount(solvedProblemCount);
  const badgeTier = badge?.tier || null;
  const badgeIds = badge ? [badge.id] : [];
  const currentBadgeIds = normalizeBadgeIds(user.badgeIds);
  const nextBadgeIds = normalizeBadgeIds(badgeIds);

  const hasChanged = Number(user.solvedProblemCount || 0) !== solvedProblemCount
    || (user.badgeTier || null) !== badgeTier
    || currentBadgeIds.join('|') !== nextBadgeIds.join('|');

  if (!hasChanged) {
    return {
      ...user,
      solvedProblemCount,
      badgeTier,
      badgeIds,
    };
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      solvedProblemCount,
      badgeTier,
      badgeIds,
      badgeUpdatedAt: new Date(),
    },
  });
}

// syncUserBadge for many users at once: one query for all accepted submissions instead of several
// queries per user, and a write only for users whose count or badge changed.
async function syncBadgesForUsers(users) {
  if (!users.length) return [];

  const accepted = await prisma.submission.findMany({
    where: { status: 'ACCEPTED' },
    select: { userId: true, problemId: true },
  });
  const solvedByUser = new Map();
  accepted.forEach((submission) => {
    const problemId = String(submission.problemId || '').trim();
    if (!problemId) return;
    const key = String(submission.userId);
    if (!solvedByUser.has(key)) solvedByUser.set(key, new Set());
    solvedByUser.get(key).add(problemId);
  });

  return Promise.all(users.map(async (user) => {
    const solvedProblemCount = solvedByUser.get(String(user.id))?.size || 0;
    const badge = resolveBadgeForSolvedCount(solvedProblemCount);
    const badgeTier = badge?.tier || null;
    const badgeIds = badge ? [badge.id] : [];

    const hasChanged = Number(user.solvedProblemCount || 0) !== solvedProblemCount
      || (user.badgeTier || null) !== badgeTier
      || normalizeBadgeIds(user.badgeIds).join('|') !== normalizeBadgeIds(badgeIds).join('|');

    if (!hasChanged) {
      return { ...user, solvedProblemCount, badgeTier, badgeIds };
    }

    return (await prisma.user.update({
      where: { id: user.id },
      data: {
        solvedProblemCount,
        badgeTier,
        badgeIds,
        badgeUpdatedAt: new Date(),
      },
    })) || { ...user, solvedProblemCount, badgeTier, badgeIds };
  }));
}

module.exports = {
  BADGE_DEFINITIONS,
  syncBadgesForUsers,
  getBadgePresentation,
  getSolvedProblemCount,
  resolveBadgeForSolvedCount,
  syncUserBadge,
};
