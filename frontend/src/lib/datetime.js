/**
 * Parse timestamps from the API / database.
 * ISO strings use their embedded timezone.
 * Legacy "YYYY-MM-DD HH:MM:SS" values are treated as UTC.
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

export function formatLocalTime(value) {
  const date = parseStoredDate(value);
  return date ? date.toLocaleTimeString() : "—";
}

export function formatChartAxisTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatClockTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatClockDate(date = new Date()) {
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
