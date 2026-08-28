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

const TIME_OPTIONS = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

const SHORT_TIME_OPTIONS = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function getDisplayLocale() {
  if (typeof Intl !== "undefined") {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

    if (timeZone === "Europe/Helsinki") {
      return "fi-FI";
    }
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return undefined;
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function formatLocalTime(value) {
  const date = parseStoredDate(value);
  if (!date) {
    return "—";
  }

  const locale = getDisplayLocale();

  if (isSameLocalDay(date, new Date())) {
    return new Intl.DateTimeFormat(locale, TIME_OPTIONS).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...TIME_OPTIONS,
  }).format(date);
}

export function formatChartAxisTime(unixSeconds) {
  return new Intl.DateTimeFormat(getDisplayLocale(), SHORT_TIME_OPTIONS).format(
    new Date(unixSeconds * 1000),
  );
}

export function formatChartHoverTime(unixSeconds) {
  return new Intl.DateTimeFormat(getDisplayLocale(), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    ...SHORT_TIME_OPTIONS,
  }).format(new Date(unixSeconds * 1000));
}

export function formatClockTime(date = new Date()) {
  return new Intl.DateTimeFormat(getDisplayLocale(), TIME_OPTIONS).format(date);
}

export function formatClockDate(date = new Date()) {
  return new Intl.DateTimeFormat(getDisplayLocale(), {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
