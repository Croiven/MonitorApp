import { parseStoredDate } from "./datetime.js";

export const HISTORY_INTERVAL_MINUTES = 5;
export const HISTORY_HOURS = 24;

function getIntervalBucket(date, intervalMinutes = HISTORY_INTERVAL_MINUTES) {
  const bucket = new Date(date);
  bucket.setMinutes(
    Math.floor(bucket.getMinutes() / intervalMinutes) * intervalMinutes,
    0,
    0
  );
  return bucket.getTime();
}

export function downsampleHistory(rows, intervalMinutes = HISTORY_INTERVAL_MINUTES) {
  const buckets = new Map();

  for (const row of rows) {
    const time = parseStoredDate(row.recordedAt);
    if (!time) {
      continue;
    }

    const bucket = getIntervalBucket(time, intervalMinutes);
    const existing = buckets.get(bucket);
    const existingTime = existing ? parseStoredDate(existing.recordedAt) : null;

    if (!existingTime || time.getTime() > existingTime.getTime()) {
      buckets.set(bucket, row);
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, row]) => ({
      ...row,
      recordedAt: new Date(bucket).toISOString(),
    }));
}
