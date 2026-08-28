<script>
  import { formatLocalTime } from "../lib/datetime.js";

  let { reading } = $props();

  const temp = $derived(reading.temperature?.toFixed(1) ?? "—");
  const humidity = $derived(reading.humidity?.toFixed(1) ?? "—");
  const pressure = $derived(
    reading.pressure ? (reading.pressure / 100).toFixed(1) : "—"
  );
  const updatedAt = $derived(formatLocalTime(reading.receivedAt));
</script>

<article class="card">
  <header>
    <div class="title">
      <h2>{reading.name ?? reading.tagId}</h2>
      <p class="updated">{updatedAt}</p>
    </div>
    <span class="temp">{temp}°C</span>
  </header>
  <ul class="stats">
    <li><span class="label">Humidity</span> {humidity}%</li>
    <li><span class="label">Pressure</span> {pressure}</li>
    <li><span class="label">Battery mV</span> {reading.battery ? `${reading.battery}` : "—"}</li>
  </ul>
</article>

<style>
  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.6rem 0.75rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  h2 {
    margin: 0;
    font-size: 1.95rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .title {
    min-width: 0;
  }

  .updated {
    margin: 0.1rem 0 0;
    font-size: 0.7rem;
    color: #8b949e;
    line-height: 1.2;
  }

  .temp {
    font-size: 3rem;
    font-weight: 700;
    color: #58a6ff;
    line-height: 1;
    flex-shrink: 0;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 0.8rem;
    color: #c9d1d9;
  }

  .label {
    color: #8b949e;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    margin-right: 0.15rem;
  }
</style>
