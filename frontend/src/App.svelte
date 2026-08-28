<script>
  import { onMount } from "svelte";
  import { getPathname, subscribeToPath } from "./lib/router.js";
  import Dashboard from "./pages/Dashboard.svelte";
  import Settings from "./pages/Settings.svelte";

  let path = $state(getPathname());

  onMount(() => subscribeToPath((nextPath) => {
    path = nextPath;
  }));
</script>

{#if path === "/settings"}
  <Settings />
{:else}
  <Dashboard />
{/if}
