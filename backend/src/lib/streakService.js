// Daily practice streaks (HackerRank style): a day counts when the student sent at least one
// coding submission (run or submit) on it. Days follow India time by default, so a streak does not
// break at 05:30 IST (midnight UTC); set STREAK_TZ_OFFSET_MINUTES to change it.
const DAY_MS = 24 * 60 * 60 * 1000;
const parsedOffset = Number(process.env.STREAK_TZ_OFFSET_MINUTES);
const OFFSET_MINUTES = Number.isFinite(parsedOffset) ? parsedOffset : 330;
const CALENDAR_DAYS = 371;

function dayKey(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time + OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

function dayNumber(key) {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
}

function computeStreak(dates, now = new Date()) {
  const counts = new Map();
  (dates || []).forEach((value) => {
    const key = dayKey(value);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });

  const days = [...counts.keys()].map(dayNumber).sort((left, right) => left - right);
  const active = new Set(days);

  let longestStreak = 0;
  let run = 0;
  days.forEach((day, index) => {
    run = index > 0 && day === days[index - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });

  // The streak stays alive through today: practising yesterday but not yet today still counts.
  const todayKey = dayKey(now);
  const today = dayNumber(todayKey);
  const anchor = active.has(today) ? today : active.has(today - 1) ? today - 1 : null;
  let currentStreak = 0;
  if (anchor !== null) {
    while (active.has(anchor - currentStreak)) currentStreak += 1;
  }

  return {
    currentStreak,
    longestStreak,
    activeDays: counts.size,
    practicedToday: active.has(today),
    lastActiveDay: days.length ? new Date(days[days.length - 1] * DAY_MS).toISOString().slice(0, 10) : null,
    today: todayKey,
    counts,
  };
}

// Per-day counts for the last year, for the activity calendar.
function calendarFromCounts(counts, todayKey) {
  const firstDay = dayNumber(todayKey) - CALENDAR_DAYS + 1;
  const calendar = {};
  counts.forEach((count, key) => {
    if (dayNumber(key) >= firstDay) calendar[key] = count;
  });
  return calendar;
}

module.exports = { computeStreak, calendarFromCounts, dayKey, OFFSET_MINUTES };
