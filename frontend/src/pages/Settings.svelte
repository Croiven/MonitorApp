<script>
  import { onMount } from "svelte";
  import { fetchTags } from "../lib/api.js";
  import { navigateTo } from "../lib/router.js";
  import ConnectionsPanel from "../components/ConnectionsPanel.svelte";
  import TagPanel from "../components/TagPanel.svelte";

  const TAG_POLL_MS = 30_000;

  let tags = $state([]);
  let error = $state("");

  async function refreshTags() {
    try {
      tags = await fetchTags();
      error = "";
    } catch (err) {
      error = err.message;
    }
  }

  onMount(() => {
    refreshTags();
    const timer = setInterval(refreshTags, TAG_POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<main>
  <header class="topbar">
    <div>
      <h1>Settings</h1>
      <p>Manage connected services and RuuviTags</p>
    </div>
    <button type="button" class="nav-link" onclick={() => navigateTo("/")}>Dashboard</button>
  </header>

  {#if error}
    <p class="banner error">{error}</p>
  {/if}

  <ConnectionsPanel />
  <TagPanel {tags} onTagsChanged={refreshTags} />
</main>

<style>
  main {
    padding: 1.5rem;
    max-width: 720px;
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .topbar h1 {
    margin: 0;
    font-size: 2rem;
  }

  .topbar p {
    margin: 0.25rem 0 0;
    color: #8b949e;
  }

  .nav-link {
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #30363d;
    background: #21262d;
    color: #e6edf3;
    cursor: pointer;
    flex-shrink: 0;
  }

  .banner {
    padding: 0.85rem 1rem;
    border-radius: 10px;
    margin: 0 0 1rem;
  }

  .banner.error {
    background: rgba(248, 81, 73, 0.12);
    border: 1px solid #f85149;
    color: #ff7b72;
  }
</style>
