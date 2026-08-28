import { fetchWeather, isWeatherConfigured } from "./client.js";
import { setWeather, setWeatherError } from "./store.js";

const POLL_MS = Number(process.env.WEATHER_POLL_MS) || 1_800_000;

async function pollWeather() {
  if (!isWeatherConfigured()) {
    setWeather({
      configured: false,
      location: null,
      current: null,
      forecast: [],
      error: null,
    });
    return;
  }

  try {
    const weather = await fetchWeather();
    setWeather({
      ...weather,
      error: null,
    });
  } catch (err) {
    setWeatherError(err.message);
  }
}

export function startWeather() {
  if (!isWeatherConfigured()) {
    console.log("[weather] Not configured — set WEATHER_LAT and WEATHER_LON in .env");
    setWeather({
      configured: false,
      location: null,
      current: null,
      forecast: [],
      error: null,
    });
    return;
  }

  console.log("[weather] Polling forecast every %ds", POLL_MS / 1000);
  pollWeather();
  setInterval(pollWeather, POLL_MS);
}
