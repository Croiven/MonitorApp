<script>
  import { onMount } from "svelte";
  import { fetchTags } from "../lib/api.js";
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
      <p>Manage discovered RuuviTags</p>
    </div>
  </header>

  {#if error}
    <p class="banner error">{error}</p>
  {/if}

  <TagPanel {tags} onTagsChanged={refreshTags} />
</main>

<style>
  main {
    padding: 1.5rem;
    max-width: 720px;
    margin: 0 auto;
  }

  .topbar h1 {
    margin: 0;
    font-size: 2rem;
  }

  .topbar p {
    margin: 0.25rem 0 0;
    color: #8b949e;
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
