export function getWeatherIconKind(code) {
  if (code == null) {
    return "unknown";
  }

  if (code === 0) {
    return "clear";
  }

  if (code === 1) {
    return "mainly-clear";
  }

  if (code === 2) {
    return "partly-cloudy";
  }

  if (code === 3) {
    return "overcast";
  }

  if (code === 45 || code === 48) {
    return "fog";
  }

  if (code >= 51 && code <= 57) {
    return "drizzle";
  }

  if (code >= 61 && code <= 67) {
    return "rain";
  }

  if (code >= 71 && code <= 77) {
    return "snow";
  }

  if (code >= 80 && code <= 82) {
    return "showers";
  }

  if (code >= 85 && code <= 86) {
    return "snow-showers";
  }

  if (code >= 95) {
    return "thunderstorm";
  }

  return "unknown";
}
