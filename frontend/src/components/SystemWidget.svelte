<script>
  import { onMount } from "svelte";
  import { fetchSystemStatus } from "../lib/api.js";

  const POLL_MS = 10_000;

  let system = $state(null);

  function formatBytes(bytes) {
    if (bytes == null) {
      return "—";
    }

    const gb = bytes / (1024 ** 3);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }

    return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  }

  function tempBarPct(celsius) {
    if (celsius == null) {
      return 0;
    }

    return Math.min(Math.max((celsius / 85) * 100, 0), 100);
  }

  function tempLevel(celsius) {
    if (celsius == null) {
      return "unknown";
    }

    if (celsius >= 80) {
      return "critical";
    }

    if (celsius >= 65) {
      return "warm";
    }

    return "cool";
  }

  async function refresh() {
    try {
      system = await fetchSystemStatus();
    } catch (err) {
      system = { error: err.message };
    }
  }

  onMount(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<article class="system-card">
  <div class="header">
    <span class="brand">System</span>
    {#if system?.hostname}
      <span class="host">{system.hostname}</span>
    {/if}
  </div>

  {#if system?.error}
    <p class="status error">{system.error}</p>
  {:else if !system}
    <p class="status">Loading…</p>
  {:else}
    <p class="meta">
      {system.platformLabel}
      {#if system.uptimeLabel}
        · up {system.uptimeLabel}
      {/if}
    </p>

    <dl class="stats">
      <div class="stat">
        <dt>RAM</dt>
        <dd>
          <div class="metric">
            <div class="bar-wrap" aria-hidden="true">
              <div class="bar" style:width="{Math.min(system.memory?.usedPct ?? 0, 100)}%"></div>
            </div>
            <div class="metric-labels">
              <span class="value">{system.memory?.usedPct ?? "—"}%</span>
              <span class="sub">{formatBytes(system.memory?.used)} / {formatBytes(system.memory?.total)}</span>
            </div>
          </div>
        </dd>
      </div>

      {#if system.disk}
        <div class="stat">
          <dt>Disk {system.disk.path}</dt>
          <dd>
            <div class="metric">
              <div class="bar-wrap" aria-hidden="true">
                <div class="bar disk" style:width="{Math.min(system.disk.usedPct, 100)}%"></div>
              </div>
              <div class="metric-labels">
                <span class="value">{system.disk.usedPct}%</span>
                <span class="sub">{formatBytes(system.disk.used)} / {formatBytes(system.disk.total)}</span>
              </div>
            </div>
          </dd>
        </div>
      {/if}

      <div class="stat">
        <dt>CPU</dt>
        <dd class="inline-metric">
          <span class="value">{system.cpu?.cores ?? "—"} cores</span>
          {#if system.cpu?.load1 != null}
            <span class="sub">load {system.cpu.load1}</span>
          {:else}
            <span class="sub">load n/a</span>
          {/if}
        </dd>
      </div>

      <div class="stat">
        <dt>Temp</dt>
        <dd>
          {#if system.temperature?.celsius != null}
            <div class="metric">
              <div class="bar-wrap" aria-hidden="true">
                <div
                  class="bar temp"
                  class:warm={tempLevel(system.temperature.celsius) === "warm"}
                  class:critical={tempLevel(system.temperature.celsius) === "critical"}
                  style:width="{tempBarPct(system.temperature.celsius)}%"
                ></div>
              </div>
              <div class="metric-labels">
                <span class="value">{system.temperature.celsius}°C</span>
                <span class="sub">{system.temperature.label ?? "CPU"}</span>
                {#if system.temperature.throttled}
                  <span class="warn">Throttled</span>
                {/if}
              </div>
            </div>
          {:else}
            <div class="inline-metric">
              <span class="value">n/a</span>
              <span class="sub">not available on this system</span>
            </div>
          {/if}
        </dd>
      </div>
    </dl>
  {/if}
</article>

<style>
  .system-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    min-height: 7.5rem;
    line-height: 1.2;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .brand {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #58a6ff;
  }

  .host {
    font-size: 0.75rem;
    color: #8b949e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: #8b949e;
  }

  .status {
    margin: 0;
    font-size: 0.9rem;
    color: #8b949e;
  }

  .status.error {
    color: #ff7b72;
  }

  .stats {
    display: grid;
    gap: 0.45rem;
    margin: 0;
  }

  .stat {
    display: grid;
    grid-template-columns: 3.25rem 1fr;
    gap: 0.5rem;
    align-items: center;
  }

  dt {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #8b949e;
  }

  dd {
    margin: 0;
    min-width: 0;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .metric-labels {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.5rem;
  }

  .inline-metric {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.5rem;
  }

  .bar-wrap {
    width: 100%;
    height: 6px;
    background: #30363d;
    border-radius: 999px;
    overflow: hidden;
  }

  .bar {
    display: block;
    height: 100%;
    min-width: 2px;
    background: #3fb950;
    border-radius: 999px;
    transition: width 0.25s ease;
  }

  .bar.disk {
    background: #d29922;
  }

  .bar.temp {
    background: #3fb950;
  }

  .bar.temp.warm {
    background: #d29922;
  }

  .bar.temp.critical {
    background: #f85149;
  }

  .warn {
    font-size: 0.68rem;
    font-weight: 600;
    color: #f85149;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .value {
    font-size: 0.82rem;
    font-weight: 600;
  }

  .sub {
    font-size: 0.68rem;
    color: #8b949e;
  }
</style>
