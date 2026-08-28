<script>
  import { getWeatherIconKind } from "../lib/weather.js";

  let { code = null, size = 48 } = $props();

  const kind = $derived(getWeatherIconKind(code));
</script>

<svg
  class="weather-icon"
  class:compact={size < 40}
  width={size}
  height={size}
  viewBox="0 0 48 48"
  aria-hidden="true"
>
  {#if kind === "clear"}
    <circle cx="24" cy="24" r="10" fill="#f0c674" />
    <g stroke="#f0c674" stroke-width="2.5" stroke-linecap="round">
      <line x1="24" y1="4" x2="24" y2="10" />
      <line x1="24" y1="38" x2="24" y2="44" />
      <line x1="4" y1="24" x2="10" y2="24" />
      <line x1="38" y1="24" x2="44" y2="24" />
      <line x1="9.8" y1="9.8" x2="14" y2="14" />
      <line x1="34" y1="34" x2="38.2" y2="38.2" />
      <line x1="9.8" y1="38.2" x2="14" y2="34" />
      <line x1="34" y1="14" x2="38.2" y2="9.8" />
    </g>
  {:else if kind === "mainly-clear"}
    <circle cx="16" cy="16" r="7" fill="#f0c674" />
    <g stroke="#f0c674" stroke-width="2" stroke-linecap="round">
      <line x1="16" y1="4" x2="16" y2="7" />
      <line x1="16" y1="25" x2="16" y2="28" />
      <line x1="4" y1="16" x2="7" y2="16" />
      <line x1="25" y1="16" x2="28" y2="16" />
    </g>
    <path
      d="M18 34c0-5.5 4.5-10 10-10 4.2 0 7.8 2.6 9.3 6.2 0.5-0.4 1.1-0.7 1.7-0.7 2.2 0 4 1.8 4 4 0 0.3 0 0.6-0.1 0.8H18z"
      fill="#8b949e"
    />
  {:else if kind === "partly-cloudy"}
    <circle cx="17" cy="17" r="6" fill="#f0c674" opacity="0.95" />
    <path
      d="M16 34c0-5.5 4.5-10 10-10 4.5 0 8.3 3 9.6 7.1 0.4-0.2 0.9-0.3 1.4-0.3 2.5 0 4.5 2 4.5 4.5S39.5 42 37 42H16z"
      fill="#8b949e"
    />
  {:else if kind === "overcast"}
    <path
      d="M10 30c0-5 4-9 9-9 1.2 0 2.3 0.2 3.4 0.7C24.1 16.8 28.2 14 33 14c6.1 0 11 4.9 11 11 0 0.6-0.1 1.1-0.2 1.7 1.2 1.2 2 2.9 2 4.8 0 3.6-2.9 6.5-6.5 6.5H14c-2.8 0-5-2.2-5-5 0-2.4 1.7-4.4 4-4.9z"
      fill="#8b949e"
    />
    <path
      d="M6 24c0-4.4 3.6-8 8-8 1.1 0 2.1 0.2 3 0.6C18.5 13.1 22.1 11 26.5 11c5.2 0 9.5 3.7 10.4 8.6 0.8-0.3 1.6-0.4 2.5-0.4 4.4 0 8 3.6 8 8 0 0.5-0.1 1-0.2 1.5 1 1 1.7 2.4 1.7 4 0 2.9-2.4 5.3-5.3 5.3H8.8c-2.2 0-4-1.8-4-4 0-1.9 1.3-3.5 3.1-4z"
      fill="#6e7681"
      opacity="0.85"
    />
  {:else if kind === "fog"}
    <path d="M8 18h32" stroke="#8b949e" stroke-width="3" stroke-linecap="round" />
    <path d="M6 24h36" stroke="#6e7681" stroke-width="3" stroke-linecap="round" />
    <path d="M10 30h28" stroke="#8b949e" stroke-width="3" stroke-linecap="round" />
    <path d="M8 36h32" stroke="#6e7681" stroke-width="3" stroke-linecap="round" opacity="0.7" />
  {:else if kind === "drizzle" || kind === "rain" || kind === "showers"}
    <path
      d="M10 22c0-5.5 4.5-10 10-10 3.7 0 6.9 2 8.7 5 1-0.6 2.2-1 3.3-1 4.4 0 8 3.6 8 8 0 0.4 0 0.8-0.1 1.2H12c-1.1 0-2-0.9-2-2 0-0.9 0.6-1.7 1.5-1.9z"
      fill="#8b949e"
    />
    <g stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round">
      <line x1="16" y1="30" x2="14" y2="38" />
      <line x1="24" y1="30" x2="22" y2="38" />
      <line x1="32" y1="30" x2="30" y2="38" />
      {#if kind !== "drizzle"}
        <line x1="20" y1="32" x2="18" y2="40" opacity="0.7" />
        <line x1="28" y1="32" x2="26" y2="40" opacity="0.7" />
      {/if}
    </g>
  {:else if kind === "snow" || kind === "snow-showers"}
    <path
      d="M10 22c0-5.5 4.5-10 10-10 3.7 0 6.9 2 8.7 5 1-0.6 2.2-1 3.3-1 4.4 0 8 3.6 8 8 0 0.4 0 0.8-0.1 1.2H12c-1.1 0-2-0.9-2-2 0-0.9 0.6-1.7 1.5-1.9z"
      fill="#8b949e"
    />
    <g fill="#e6edf3">
      <circle cx="16" cy="32" r="2" />
      <circle cx="24" cy="30" r="2" />
      <circle cx="32" cy="33" r="2" />
      <circle cx="20" cy="38" r="1.5" opacity="0.8" />
      <circle cx="28" cy="38" r="1.5" opacity="0.8" />
    </g>
  {:else if kind === "thunderstorm"}
    <path
      d="M10 20c0-5.5 4.5-10 10-10 3.7 0 6.9 2 8.7 5 1-0.6 2.2-1 3.3-1 4.4 0 8 3.6 8 8 0 0.4 0 0.8-0.1 1.2H12c-1.1 0-2-0.9-2-2 0-0.9 0.6-1.7 1.5-1.9z"
      fill="#6e7681"
    />
    <polygon points="22,28 18,36 22,36 20,42 28,32 24,32 26,28" fill="#d29922" />
    <g stroke="#58a6ff" stroke-width="2.5" stroke-linecap="round">
      <line x1="14" y1="30" x2="12" y2="36" opacity="0.8" />
      <line x1="34" y1="30" x2="32" y2="36" opacity="0.8" />
    </g>
  {:else}
    <circle cx="24" cy="24" r="14" fill="none" stroke="#484f58" stroke-width="2" />
    <text x="24" y="28" text-anchor="middle" fill="#8b949e" font-size="14">?</text>
  {/if}
</svg>

<style>
  .weather-icon {
    flex-shrink: 0;
    display: block;
  }

  .weather-icon.compact :global(text) {
    font-size: 12px;
  }
</style>
