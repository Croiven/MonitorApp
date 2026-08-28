export const SAVE_INTERVAL_MINUTES = 5;

export function getIntervalBucket(date = new Date(), intervalMinutes = SAVE_INTERVAL_MINUTES) {
  const bucket = new Date(date);
  bucket.setMinutes(
    Math.floor(bucket.getMinutes() / intervalMinutes) * intervalMinutes,
    0,
    0
  );
  return bucket;
}

export function msUntilNextInterval(date = new Date(), intervalMinutes = SAVE_INTERVAL_MINUTES) {
  const now = new Date(date);
  const next = new Date(now);
  const nextMinute =
    (Math.floor(now.getMinutes() / intervalMinutes) + 1) * intervalMinutes;

  if (nextMinute >= 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(nextMinute, 0, 0);
  }

  return next.getTime() - now.getTime();
}

export function toUtcIso(date = new Date()) {
  return new Date(date).toISOString();
}

export function toRecordedAtIso(date = new Date()) {
  return getIntervalBucket(date).toISOString();
}

/**
 * Parse timestamps from the database.
 * - ISO strings (with timezone) are parsed as-is
 * - Legacy "YYYY-MM-DD HH:MM:SS" values are treated as UTC (SQLite datetime('now'))
 */
export function parseStoredDate(value) {
  if (!value) {
    return null;
  }

  if (value.includes("T")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
