<script>
  import { onMount } from "svelte";
  import { fetchHueSetup, fetchSpotifySetup } from "../lib/api.js";

  let spotify = $state(null);
  let hue = $state(null);
  let error = $state("");

  async function refresh() {
    try {
      [spotify, hue] = await Promise.all([fetchSpotifySetup(), fetchHueSetup()]);
      error = "";
    } catch (err) {
      error = err.message;
    }
  }

  function openPath(path) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  function spotifyStatus() {
    if (!spotify) {
      return "loading";
    }
    if (spotify.configured) {
      return "connected";
    }
    if (spotify.hasClientCredentials || spotify.hasRefreshToken) {
      return "partial";
    }
    return "disconnected";
  }

  function hueStatus() {
    if (!hue) {
      return "loading";
    }
    if (hue.configured) {
      return "connected";
    }
    if (hue.hasBridgeIp || hue.hasUsername) {
      return "partial";
    }
    return "disconnected";
  }

  onMount(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  });
</script>

<section class="panel">
  <header class="panel-head">
    <div>
      <h2>Connections</h2>
      <p>Link Spotify and Philips Hue to the dashboard</p>
    </div>
    <button type="button" class="secondary" onclick={refresh}>Refresh</button>
  </header>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="services">
    <article class="service">
      <div class="service-head">
        <div>
          <h3>Spotify</h3>
          <p class="status-line">
            <span class="badge {spotifyStatus()}">
              {#if spotifyStatus() === "connected"}
                Connected
              {:else if spotifyStatus() === "partial"}
                Setup incomplete
              {:else if spotifyStatus() === "loading"}
                Loading…
              {:else}
                Not configured
              {/if}
            </span>
          </p>
        </div>
      </div>

      <ol class="steps">
        <li>Add <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> to <code>backend/.env</code>.</li>
        <li>
          Register this redirect URI in the Spotify Developer Dashboard:
          {#if spotify?.redirectUri}
            <code class="block">{spotify.redirectUri}</code>
          {/if}
        </li>
        {#if spotify?.suggestedRedirectUris?.length}
          <li class="subtle">
            Dev redirect URIs:
            {#each spotify.suggestedRedirectUris as uri, index (uri)}
              {#if index > 0}<span class="sep">·</span>{/if}
              <code>{uri}</code>
            {/each}
          </li>
        {/if}
        <li>Connect your account and copy the refresh token into <code>backend/.env</code>.</li>
        <li>Restart the backend.</li>
      </ol>

      <div class="actions">
        <button
          type="button"
          disabled={!spotify?.hasClientCredentials}
          onclick={() => openPath(spotify?.authPath ?? "/api/spotify/auth")}
        >
          Connect Spotify
        </button>
        {#if !spotify?.hasClientCredentials}
          <span class="hint">Add client id and secret to .env first</span>
        {/if}
      </div>
    </article>

    <article class="service">
      <div class="service-head">
        <div>
          <h3>Philips Hue</h3>
          <p class="status-line">
            <span class="badge {hueStatus()}">
              {#if hueStatus() === "connected"}
                Connected
              {:else if hueStatus() === "partial"}
                Setup incomplete
              {:else if hueStatus() === "loading"}
                Loading…
              {:else}
                Not configured
              {/if}
            </span>
            {#if hue?.bridgeIp}
              <span class="meta">{hue.bridgeIp}</span>
            {/if}
          </p>
        </div>
      </div>

      <ol class="steps">
        <li>Add <code>HUE_BRIDGE_IP</code> to <code>backend/.env</code>.</li>
        <li>Press the physical link button on the Hue bridge.</li>
        <li>Within 30 seconds, link the bridge and copy the username into <code>backend/.env</code>.</li>
        <li>Restart the backend.</li>
      </ol>

      <div class="actions">
        <button
          type="button"
          disabled={!hue?.hasBridgeIp}
          onclick={() => openPath(hue?.linkPath ?? "/api/hue/link")}
        >
          Link bridge
        </button>
        {#if !hue?.hasBridgeIp}
          <span class="hint">Add bridge IP to .env first</span>
        {/if}
      </div>
    </article>
  </div>
</section>

<style>
  .panel {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .panel-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .panel-head h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .panel-head p {
    margin: 0.25rem 0 0;
    color: #8b949e;
    font-size: 0.9rem;
  }

  .error {
    color: #ff7b72;
    margin: 1rem 0 0;
  }

  .services {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .service {
    border: 1px solid #30363d;
    border-radius: 10px;
    overflow: hidden;
    background: #0d1117;
  }

  .service-head {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid #30363d;
  }

  .service-head h3 {
    margin: 0;
    font-size: 1rem;
  }

  .status-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0.35rem 0 0;
  }

  .badge {
    display: inline-block;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge.connected {
    background: rgba(35, 134, 54, 0.2);
    color: #3fb950;
  }

  .badge.partial {
    background: rgba(210, 153, 34, 0.18);
    color: #d29922;
  }

  .badge.disconnected,
  .badge.loading {
    background: rgba(139, 148, 158, 0.16);
    color: #8b949e;
  }

  .meta {
    font-size: 0.78rem;
    color: #8b949e;
    font-family: monospace;
  }

  .steps {
    margin: 0;
    padding: 0.85rem 1rem 0.85rem 1.85rem;
    color: #c9d1d9;
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .steps li + li {
    margin-top: 0.45rem;
  }

  .steps li.subtle {
    color: #8b949e;
    font-size: 0.82rem;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.82em;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    padding: 0.05rem 0.3rem;
  }

  code.block {
    display: block;
    margin-top: 0.35rem;
    padding: 0.45rem 0.55rem;
    word-break: break-all;
  }

  .sep {
    margin: 0 0.25rem;
    color: #6e7681;
  }

  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.65rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid #30363d;
    background: #0d1117;
  }

  button {
    padding: 0.55rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #238636;
    background: #238636;
    color: white;
    cursor: pointer;
  }

  button.secondary {
    border-color: #30363d;
    background: #21262d;
    color: #e6edf3;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.82rem;
    color: #8b949e;
  }
</style>
