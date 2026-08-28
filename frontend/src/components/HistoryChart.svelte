<script>
  import { onDestroy, onMount } from "svelte";
  import uPlot from "uplot";
  import "uplot/dist/uPlot.min.css";
  import { fetchHistory } from "../lib/api.js";
  import { downsampleHistory, HISTORY_HOURS, HISTORY_INTERVAL_MINUTES } from "../lib/history.js";
  import { formatChartAxisTime, parseStoredDate } from "../lib/datetime.js";

  let { tagId, compact = false } = $props();

  const chartHeight = $derived(compact ? 140 : 220);
  const REFRESH_MS = HISTORY_INTERVAL_MINUTES * 60_000;
  const TEMP_MIN = -30;
  const TEMP_MAX = 40;
  const HUMIDITY_MIN = 0;
  const HUMIDITY_MAX = 100;

  let container = $state(null);
  let chart = $state(null);
  let error = $state("");

  function getTimeRange() {
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      nowSec,
      minSec: nowSec - HISTORY_HOURS * 60 * 60,
    };
  }

  function buildChartOptions(width, minSec, nowSec) {
    return {
      width,
      height: chartHeight,
      series: [
        {},
        { label: "Temp °C", stroke: "#58a6ff", width: 2, spanGaps: false },
        { label: "Humidity %", stroke: "#3fb950", width: 2, scale: "humidity", spanGaps: false },
      ],
      scales: {
        x: {
          time: true,
          auto: false,
          range: () => [minSec, nowSec],
        },
        y: {
          auto: false,
          range: () => [TEMP_MIN, TEMP_MAX],
        },
        humidity: {
          auto: false,
          range: () => [HUMIDITY_MIN, HUMIDITY_MAX],
        },
      },
      axes: [
        {
          stroke: "#8b949e",
          grid: { stroke: "#30363d" },
          size: compact ? 22 : 34,
          values: (_, splits) => splits.map(formatChartAxisTime),
        },
        { stroke: "#8b949e", grid: { stroke: "#30363d" }, size: compact ? 28 : 34 },
        {
          stroke: "#8b949e",
          grid: { stroke: "#30363d" },
          scale: "humidity",
          side: 1,
          size: compact ? 28 : 34,
        },
      ],
    };
  }

  async function loadHistory() {
    if (!tagId || !container) {
      return;
    }

    error = "";

    try {
      const rows = await fetchHistory(tagId, { hours: HISTORY_HOURS });
      const ordered = downsampleHistory(rows);
      const { nowSec, minSec } = getTimeRange();

      const points = ordered.flatMap((row) => {
        const date = parseStoredDate(row.recordedAt);
        if (!date) {
          return [];
        }

        return [{
          t: Math.floor(date.getTime() / 1000),
          temperature: row.temperature,
          humidity: row.humidity,
        }];
      });

      const timestamps = points.map((point) => point.t);
      const temperatures = points.map((point) => point.temperature);
      const humidity = points.map((point) => point.humidity);
      const data = [timestamps, temperatures, humidity];
      const opts = buildChartOptions(container.clientWidth, minSec, nowSec);

      if (chart) {
        chart.setScale("x", { min: minSec, max: nowSec });
        chart.setData(data);
      } else {
        chart = new uPlot(opts, data, container);
      }
    } catch (err) {
      error = err.message;
    }
  }

  $effect(() => {
    tagId;
    loadHistory();
  });

  onMount(() => {
    const resize = () => {
      if (chart && container) {
        const { minSec, nowSec } = getTimeRange();
        chart.setSize({ width: container.clientWidth, height: chartHeight });
        chart.setScale("x", { min: minSec, max: nowSec });
      }
    };

    const refreshTimer = setInterval(loadHistory, REFRESH_MS);
    const rangeTimer = setInterval(() => {
      if (chart) {
        const { minSec, nowSec } = getTimeRange();
        chart.setScale("x", { min: minSec, max: nowSec });
      }
    }, 60_000);

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      clearInterval(refreshTimer);
      clearInterval(rangeTimer);
    };
  });

  onDestroy(() => {
    chart?.destroy();
  });
</script>

<div class="chart-wrap" class:compact>
  <p class="range">{HISTORY_HOURS}h</p>
  {#if error}
    <p class="error">{error}</p>
  {/if}
  <div bind:this={container} class="chart"></div>
</div>

<style>
  .chart-wrap {
    padding: 0.75rem 0.75rem 0.85rem;
  }

  .chart-wrap.compact {
    padding: 0.35rem 0.6rem 0.5rem;
  }

  .range {
    margin: 0 0 0.2rem;
    font-size: 0.65rem;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .error {
    color: #ff7b72;
    margin: 0 0 0.25rem;
    font-size: 0.75rem;
  }

  .chart {
    width: 100%;
    min-height: 120px;
  }

  .chart :global(.uplot) {
    font-family: inherit;
  }
</style>
