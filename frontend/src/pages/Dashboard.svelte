<script>
  import { onMount } from "svelte";
  import { fetchReadings } from "../lib/api.js";
  import ClockWidget from "../components/ClockWidget.svelte";
  import TagMonitor from "../components/TagMonitor.svelte";

  const READING_POLL_MS = 5_000;

  let readings = $state([]);
  let error = $state("");

  async function refreshReadings() {
    try {
      readings = await fetchReadings();
      error = "";
    } catch (err) {
      error = err.message;
    }
  }

  onMount(() => {
    refreshReadings();
    const timer = setInterval(refreshReadings, READING_POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<main>
  {#if error}
    <p class="banner error">{error}</p>
  {/if}

  <div class="grid">
    <ClockWidget />
    {#each readings as reading (reading.tagId)}
      <TagMonitor {reading} />
    {/each}
  </div>

  {#if readings.length === 0}
    <p class="empty">No tracked tags are reporting right now.</p>
  {/if}
</main>

<style>
  main {
    padding: 0.5rem;
    width: 100%;
  }

  .banner {
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
  }

  .banner.error {
    background: rgba(248, 81, 73, 0.12);
    border: 1px solid #f85149;
    color: #ff7b72;
  }

  .empty {
    color: #8b949e;
    padding: 0.75rem;
    margin-top: 0.5rem;
    text-align: center;
    font-size: 0.9rem;
    border: 1px dashed #30363d;
    border-radius: 8px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0.5rem;
    align-items: start;
  }
</style>
