import { describeWeatherCode } from "./codes.js";

const API_BASE = "https://api.open-meteo.com/v1/forecast";

export function getWeatherConfig() {
  const lat = Number.parseFloat(process.env.WEATHER_LAT ?? "");
  const lon = Number.parseFloat(process.env.WEATHER_LON ?? "");
  const location = process.env.WEATHER_LOCATION?.trim() || null;

  return { lat, lon, location };
}

export function isWeatherConfigured() {
  const { lat, lon } = getWeatherConfig();
  return Number.isFinite(lat) && Number.isFinite(lon);
}

function formatDayLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString([], { weekday: "short" });
}

function mapCurrent(current) {
  if (!current) {
    return null;
  }

  const weatherCode = current.weather_code ?? null;

  return {
    temperature: current.temperature_2m ?? null,
    humidity: current.relative_humidity_2m ?? null,
    windSpeed: current.wind_speed_10m ?? null,
    weatherCode,
    description: weatherCode == null ? null : describeWeatherCode(weatherCode),
    observedAt: current.time ?? null,
  };
}

function formatHourLabel(isoTime) {
  return new Date(isoTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mapHourlySlot(time, temperature, weatherCode, precipitation) {
  return {
    time,
    hourLabel: formatHourLabel(time),
    temperature,
    weatherCode,
    description: describeWeatherCode(weatherCode),
    precipitation,
  };
}

function buildHourlyByDate(data) {
  const hourly = data.hourly ?? {};
  const times = hourly.time ?? [];
  const nowMs = Date.now();
  const todayDate = times[0]?.slice(0, 10) ?? null;
  const byDate = new Map();

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const date = time.slice(0, 10);
    const slotMs = new Date(time).getTime();

    if (date === todayDate && slotMs < nowMs - 30 * 60 * 1000) {
      continue;
    }

    const weatherCode = hourly.weather_code?.[i];
    const slot = mapHourlySlot(
      time,
      hourly.temperature_2m?.[i] ?? null,
      weatherCode ?? null,
      hourly.precipitation_probability?.[i] ?? null,
    );

    if (!byDate.has(date)) {
      byDate.set(date, []);
    }

    byDate.get(date).push(slot);
  }

  return byDate;
}

function mapForecastDay(date, weatherCode, tempMin, tempMax, hours = []) {
  return {
    date,
    dayLabel: formatDayLabel(date),
    tempMin,
    tempMax,
    weatherCode,
    description: describeWeatherCode(weatherCode),
    hours,
  };
}

export async function fetchWeather() {
  if (!isWeatherConfigured()) {
    return {
      configured: false,
      location: null,
      current: null,
      forecast: [],
    };
  }

  const { lat, lon, location } = getWeatherConfig();
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "3",
  });

  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error (${response.status})`);
  }

  const data = await response.json();
  const daily = data.daily ?? {};
  const times = daily.time ?? [];
  const hoursByDate = buildHourlyByDate(data);
  const todayDate = times[0] ?? null;

  const today = todayDate
    ? {
        ...mapForecastDay(
          todayDate,
          daily.weather_code?.[0],
          daily.temperature_2m_min?.[0],
          daily.temperature_2m_max?.[0],
          hoursByDate.get(todayDate) ?? [],
        ),
        dayLabel: "Today",
      }
    : null;

  const forecast = times.slice(1, 3).map((date, index) => {
    const dayIndex = index + 1;
    return mapForecastDay(
      date,
      daily.weather_code?.[dayIndex],
      daily.temperature_2m_min?.[dayIndex],
      daily.temperature_2m_max?.[dayIndex],
      hoursByDate.get(date) ?? [],
    );
  });

  return {
    configured: true,
    location: location ?? data.timezone ?? null,
    current: mapCurrent(data.current),
    today,
    forecast,
  };
}
