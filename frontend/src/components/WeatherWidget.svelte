<script>
  import { onMount } from "svelte";
  import { fetchWeather } from "../lib/api.js";
  import WeatherIcon from "./WeatherIcon.svelte";

  const POLL_MS = 1_800_000;

  let weather = $state(null);

  const temp = $derived(
    weather?.current?.temperature == null
      ? "—"
      : `${Math.round(weather.current.temperature)}°`
  );

  const forecastDays = $derived.by(() => {
    if (!weather) {
      return [];
    }

    const days = [];

    if (weather.today?.hours?.length) {
      days.push(weather.today);
    }

    return days.concat(weather.forecast ?? []);
  });

  function formatHour(time) {
    return time.slice(11, 16);
  }

  async function refresh() {
    try {
      weather = await fetchWeather();
    } catch (err) {
      weather = {
        configured: true,
        current: null,
        today: null,
        forecast: [],
        error: err.message,
      };
    }
  }

  onMount(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<article class="weather-card">
  <div class="header">
    <span class="brand">Weather</span>
    {#if weather?.location}
      <span class="location">{weather.location}</span>
    {/if}
  </div>

  {#if weather?.error}
    <p class="status error">{weather.error}</p>
  {:else if !weather?.configured}
    <p class="status">Not configured</p>
    <p class="hint">Set WEATHER_LAT and WEATHER_LON in backend/.env</p>
  {:else if !weather?.current}
    <p class="status">Loading…</p>
  {:else}
    <div class="current">
      <WeatherIcon code={weather.current.weatherCode} size={48} />
      <p class="temp">{temp}</p>
      <div class="summary">
        <p class="description">{weather.current.description}</p>
        <p class="details">
          {#if weather.current.humidity != null}
            <span>RH {Math.round(weather.current.humidity)}%</span>
          {/if}
          {#if weather.current.windSpeed != null}
            <span>Wind {Math.round(weather.current.windSpeed)} km/h</span>
          {/if}
        </p>
      </div>
    </div>

    {#if forecastDays.length > 0}
      <div class="forecast">
        {#each forecastDays as day (day.date)}
          <section class="day-block">
            <div class="day-head">
              <span class="day">{day.dayLabel}</span>
              <span class="range">{Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°</span>
            </div>

            {#if day.hours.length > 0}
              <ul class="hours" style="--hour-count: {day.hours.length}">
                {#each day.hours as hour (hour.time)}
                  <li>
                    <span class="hour">{formatHour(hour.time)}</span>
                    <WeatherIcon code={hour.weatherCode} size={22} />
                    <span class="hour-temp">{hour.temperature == null ? "—" : `${Math.round(hour.temperature)}°`}</span>
                    {#if hour.precipitation != null && hour.precipitation > 0}
                      <span class="precip">{Math.round(hour.precipitation)}%</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <p class="desc">{day.description}</p>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  {/if}
</article>

<style>
  .weather-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.7rem 0.85rem;
    min-height: 7.5rem;
    line-height: 1.2;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .brand {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #58a6ff;
  }

  .location {
    font-size: 0.75rem;
    color: #8b949e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    margin: 0;
    font-size: 0.95rem;
    color: #8b949e;
  }

  .status.error {
    color: #ff7b72;
    font-size: 0.85rem;
  }

  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: #6e7681;
  }

  .current {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .temp {
    margin: 0;
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
    color: #e6edf3;
  }

  .summary {
    min-width: 0;
  }

  .description {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.75rem;
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: #8b949e;
  }

  .forecast {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin: 0.6rem 0 0;
    padding: 0.6rem 0 0;
    border-top: 1px solid #30363d;
  }

  .day-block {
    min-width: 0;
  }

  .day-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }

  .day {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #8b949e;
  }

  .range {
    font-size: 0.8rem;
    font-weight: 600;
    color: #c9d1d9;
  }

  .desc {
    margin: 0;
    font-size: 0.75rem;
    color: #8b949e;
  }

  .hours {
    display: grid;
    grid-template-columns: repeat(var(--hour-count, 24), minmax(0, 1fr));
    gap: 0.1rem;
    margin: 0;
    padding: 0;
    list-style: none;
    width: 100%;
  }

  .hours li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.12rem;
    min-width: 0;
    padding: 0 0.05rem;
  }

  .hour {
    font-size: 0.62rem;
    color: #8b949e;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    white-space: nowrap;
  }

  .hour-temp {
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .precip {
    font-size: 0.55rem;
    color: #58a6ff;
    line-height: 1.1;
  }
</style>
