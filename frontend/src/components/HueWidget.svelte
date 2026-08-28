<script>
  import { onMount } from "svelte";
  import { fetchHueLights, updateAllHueLights, updateHueLight } from "../lib/api.js";

  const POLL_MS = 5_000;

  const LIGHT_PRESETS = [
    { id: "warm", label: "Warm", ct: 454, tint: "#ffc58a" },
    { id: "neutral", label: "Neutral", ct: 366, tint: "#fff1dd" },
    { id: "cool", label: "Cool", ct: 250, tint: "#dbeaff" },
    { id: "daylight", label: "Daylight", ct: 153, tint: "#f5f9ff" },
  ];

  function ctToHex(mired) {
    const kelvin = Math.max(1000, Math.min(40_000, 1_000_000 / mired));
    const temp = kelvin / 100;
    let r;
    let g;
    let b;

    if (temp <= 66) {
      r = 255;
      g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
    } else {
      r = Math.min(255, Math.max(0, 329.698727446 * (temp - 60) ** -0.1332047592));
      g = Math.min(255, Math.max(0, 288.1221695283 * (temp - 60) ** -0.0755148492));
    }

    if (temp >= 66) {
      b = 255;
    } else if (temp <= 19) {
      b = 0;
    } else {
      b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
    }

    const toHex = (channel) => channel.toString(16).padStart(2, "0");
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
  }

  let hue = $state(null);
  let pending = $state(new Set());
  let bulkPending = $state(false);
  let error = $state("");

  let reachableLights = $derived(hue?.lights?.filter((light) => light.reachable) ?? []);
  let anyOn = $derived(reachableLights.some((light) => light.on));
  let allOn = $derived(reachableLights.length > 0 && reachableLights.every((light) => light.on));
  let anyPresetCapable = $derived(reachableLights.some((light) => light.presetCapable));
  let anyColorCapable = $derived(reachableLights.some((light) => light.colorCapable));
  let masterBrightness = $derived.by(() => {
    if (!reachableLights.length) {
      return 100;
    }
    const total = reachableLights.reduce((sum, light) => sum + (light.brightness ?? 100), 0);
    return Math.round(total / reachableLights.length);
  });
  let masterColor = $derived.by(() => {
    const withColor = reachableLights.filter((light) => light.color);
    if (!withColor.length) {
      return "#ffb900";
    }
    const onLights = withColor.filter((light) => light.on);
    return (onLights[0] ?? withColor[0]).color;
  });
  let controlsDisabled = $derived(bulkPending || reachableLights.length === 0);

  async function refresh() {
    try {
      const data = await fetchHueLights();
      if (hue && pending.size > 0) {
        data.lights = data.lights.map((light) => {
          if (pending.has(light.id)) {
            return hue.lights.find((entry) => entry.id === light.id) ?? light;
          }
          return light;
        });
      }
      hue = data;
      error = "";
    } catch (err) {
      hue = { configured: true, lights: [], error: err.message };
    }
  }

  function presetOptimisticPatch(light, patch) {
    if (!patch.preset) {
      return patch;
    }

    const preset = LIGHT_PRESETS.find((entry) => entry.id === patch.preset);
    if (!preset) {
      return patch;
    }

    const color = ctToHex(preset.ct);

    if (light.ctCapable) {
      return {
        on: true,
        ct: preset.ct,
        colormode: "ct",
        color,
      };
    }

    if (light.colorCapable) {
      return {
        on: true,
        colormode: "xy",
        color,
      };
    }

    return { on: true };
  }

  function applyOptimisticPatch(light, patch) {
    const { preset, ...rest } = patch;
    return {
      ...rest,
      ...presetOptimisticPatch(light, patch),
    };
  }

  async function setAllLights(patch) {
    if (!hue?.configured || bulkPending || !reachableLights.length) {
      return;
    }

    bulkPending = true;
    error = "";
    const snapshot = hue;
    const targetIds = reachableLights.map((light) => light.id);

    pending = new Set([...pending, ...targetIds]);
    hue = {
      ...hue,
      lights: hue.lights.map((light) => {
        if (!light.reachable) {
          return light;
        }
        return { ...light, ...applyOptimisticPatch(light, patch), reachable: true };
      }),
    };

    try {
      hue = await updateAllHueLights(patch);
    } catch (err) {
      hue = snapshot;
      error = err.message;
    } finally {
      bulkPending = false;
      const next = new Set(pending);
      for (const id of targetIds) {
        next.delete(id);
      }
      pending = next;
    }
  }

  async function setLight(id, patch) {
    if (!hue?.configured || pending.has(id) || bulkPending) {
      return;
    }

    pending = new Set(pending).add(id);
    error = "";
    const snapshot = hue;
    const currentLight = hue.lights.find((light) => light.id === id);
    const optimisticPatch = applyOptimisticPatch(currentLight ?? {}, patch);

    hue = {
      ...hue,
      lights: hue.lights.map((light) =>
        light.id === id ? { ...light, ...optimisticPatch, reachable: true } : light,
      ),
    };

    try {
      hue = await updateHueLight(id, patch);
    } catch (err) {
      hue = snapshot;
      error = err.message;
    } finally {
      const next = new Set(pending);
      next.delete(id);
      pending = next;
    }
  }

  function toggleAllLights() {
    setAllLights({ on: !allOn });
  }

  function toggleLight(light) {
    setLight(light.id, { on: !light.on });
  }

  function sliderColor(light) {
    return light?.color ?? "#ffb900";
  }

  function onBrightnessDrag(event) {
    event.currentTarget.style.setProperty("--fill", `${event.currentTarget.value}%`);
  }

  function onAllBrightnessCommit(event) {
    const brightness = Number(event.currentTarget.value);
    setAllLights({ on: true, brightness });
  }

  function onAllColorInput(event) {
    setAllLights({ on: true, color: event.currentTarget.value });
  }

  function selectAllPreset(preset) {
    setAllLights({ preset: preset.id });
  }

  function isAllPresetSelected(preset) {
    const targets = reachableLights.filter((light) => light.presetCapable && light.on);
    if (!targets.length) {
      return false;
    }
    return targets.every((light) => isPresetSelected(light, preset));
  }

  function onBrightnessCommit(light, event) {
    const brightness = Number(event.currentTarget.value);
    setLight(light.id, { on: true, brightness });
  }

  function onColorInput(light, event) {
    const color = event.currentTarget.value;
    setLight(light.id, { on: true, color });
  }

  function selectPreset(light, preset) {
    setLight(light.id, { preset: preset.id });
  }

  function isPresetSelected(light, preset) {
    return light.colormode === "ct" && light.ct != null && Math.abs(light.ct - preset.ct) <= 20;
  }

  onMount(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

<article class="hue-card">
  <div class="header">
    <span class="brand">Hue</span>
    {#if hue?.bridgeIp}
      <span class="bridge">{hue.bridgeIp}</span>
    {/if}
  </div>

  {#if hue?.error && !error}
    <p class="status error">{hue.error}</p>
  {:else if !hue?.configured}
    <p class="status">Not configured</p>
    <p class="hint">Set HUE_BRIDGE_IP and HUE_USERNAME in backend/.env</p>
  {:else if !hue?.lights?.length}
    <p class="status">No lights found</p>
  {:else}
    <div class="all-lights">
      <div class="light-head">
        <button
          type="button"
          class="toggle"
          class:on={allOn}
          aria-pressed={allOn}
          aria-label="{allOn ? 'Turn off all lights' : 'Turn on all lights'}"
          disabled={controlsDisabled}
          onclick={toggleAllLights}
        ></button>
        <div class="meta">
          <span class="name">All lights</span>
        </div>
        <span class="pct">{anyOn ? `${masterBrightness}%` : "—"}</span>
      </div>

      <label class="brightness" class:inactive={!anyOn}>
        <input
          type="range"
          min="1"
          max="100"
          value={masterBrightness}
          style="--fill: {masterBrightness}%; --fill-color: {masterColor}"
          disabled={!anyOn || controlsDisabled}
          oninput={onBrightnessDrag}
          onchange={onAllBrightnessCommit}
        />
      </label>

      {#if anyPresetCapable || anyColorCapable}
        <div class="light-options" class:inactive={!anyOn}>
          {#if anyPresetCapable}
            <div class="presets" role="group" aria-label="White presets for all lights">
              {#each LIGHT_PRESETS as preset (preset.id)}
                <button
                  type="button"
                  class="preset"
                  class:selected={isAllPresetSelected(preset)}
                  style="--tint: {preset.tint}"
                  aria-pressed={isAllPresetSelected(preset)}
                  disabled={!anyOn || controlsDisabled}
                  onclick={() => selectAllPreset(preset)}
                >
                  {preset.label}
                </button>
              {/each}
            </div>
          {/if}
          {#if anyColorCapable}
            <input
              type="color"
              class="color-picker"
              value={masterColor}
              aria-label="Custom color for all color-capable lights"
              disabled={!anyOn || controlsDisabled}
              onchange={onAllColorInput}
            />
          {/if}
        </div>
      {/if}
    </div>

    <ul class="lights">
      {#each hue.lights as light (light.id)}
        <li
          class:off={!light.on}
          class:unreachable={!light.reachable}
        >
          <div class="light-head">
            <button
              type="button"
              class="toggle"
              class:on={light.on}
              aria-pressed={light.on}
              aria-label="{light.on ? 'Turn off' : 'Turn on'} {light.name}"
              disabled={pending.has(light.id) || !light.reachable || bulkPending}
              onclick={() => toggleLight(light)}
            ></button>
            <div class="meta">
              <span class="name">{light.name}</span>
              {#if !light.reachable}
                <span class="tag">Off</span>
              {/if}
            </div>
            <span class="pct">{light.on ? `${light.brightness ?? 100}%` : "—"}</span>
          </div>

          <label class="brightness" class:inactive={!light.on}>
            <input
              type="range"
              min="1"
              max="100"
              value={light.brightness ?? 100}
              style="--fill: {light.brightness ?? 100}%; --fill-color: {sliderColor(light)}"
              disabled={!light.on || pending.has(light.id) || !light.reachable || bulkPending}
              oninput={onBrightnessDrag}
              onchange={(event) => onBrightnessCommit(light, event)}
            />
          </label>

          {#if light.presetCapable || light.colorCapable}
            <div class="light-options" class:inactive={!light.on}>
              {#if light.presetCapable}
                <div class="presets" role="group" aria-label="White presets for {light.name}">
                  {#each LIGHT_PRESETS as preset (preset.id)}
                    <button
                      type="button"
                      class="preset"
                      class:selected={isPresetSelected(light, preset)}
                      style="--tint: {preset.tint}"
                      aria-pressed={isPresetSelected(light, preset)}
                      disabled={!light.on || pending.has(light.id) || !light.reachable || bulkPending}
                      onclick={() => selectPreset(light, preset)}
                    >
                      {preset.label}
                    </button>
                  {/each}
                </div>
              {/if}
              {#if light.colorCapable}
                <input
                  type="color"
                  class="color-picker"
                  value={light.color ?? "#ffffff"}
                  aria-label="Custom color for {light.name}"
                  disabled={!light.on || pending.has(light.id) || !light.reachable || bulkPending}
                  onchange={(event) => onColorInput(light, event)}
                />
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if error}
    <p class="status error">{error}</p>
  {/if}
</article>

<style>
  .hue-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.65rem 0.75rem;
    line-height: 1.2;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 0.4rem;
  }

  .brand {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #58a6ff;
  }

  .bridge {
    font-size: 0.62rem;
    color: #6e7681;
    font-variant-numeric: tabular-nums;
  }

  .status {
    margin: 0;
    font-size: 0.9rem;
    color: #8b949e;
  }

  .status.error {
    color: #ff7b72;
    font-size: 0.82rem;
    margin-top: 0.5rem;
  }

  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: #6e7681;
  }

  .all-lights {
    padding: 0.5rem 0.55rem;
    border: 1px solid #484f58;
    border-radius: 6px;
    background: #0d1117;
    width: 100%;
    margin-bottom: 0.45rem;
  }

  .lights {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    width: 100%;
  }

  @media (max-width: 599px) {
    .lights {
      grid-template-columns: 1fr;
    }
  }

  .lights li {
    padding: 0.5rem 0.55rem;
    border: 1px solid #30363d;
    border-radius: 6px;
    background: #0d1117;
    width: 100%;
  }

  .lights li.off {
    opacity: 0.82;
  }

  .lights li.unreachable {
    opacity: 0.55;
  }

  .light-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .meta {
    min-width: 0;
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .name {
    min-width: 0;
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tag {
    flex-shrink: 0;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #8b949e;
  }

  .pct {
    flex-shrink: 0;
    min-width: 2rem;
    font-size: 0.75rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #c9d1d9;
  }

  .toggle {
    appearance: none;
    width: 2.35rem;
    height: 1.3rem;
    border: 1px solid #484f58;
    border-radius: 999px;
    background: #21262d;
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .toggle::after {
    content: "";
    position: absolute;
    top: 0.12rem;
    left: 0.12rem;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: #c9d1d9;
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .toggle.on {
    background: rgba(88, 166, 255, 0.22);
    border-color: #58a6ff;
  }

  .toggle.on::after {
    transform: translateX(1rem);
    background: #58a6ff;
  }

  .toggle:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .brightness {
    display: block;
    width: 100%;
    margin-top: 0.45rem;
  }

  .brightness.inactive {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .brightness input {
    display: block;
    width: 100%;
    height: 1.35rem;
    margin: 0;
    --fill: 50%;
    --track: #30363d;
    --fill-color: #ffb900;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }

  .brightness.inactive input,
  .brightness input:disabled {
    cursor: not-allowed;
  }

  .brightness input::-webkit-slider-runnable-track {
    height: 0.4rem;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      var(--fill-color) 0%,
      var(--fill-color) var(--fill),
      var(--track) var(--fill),
      var(--track) 100%
    );
  }

  .brightness input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 0.9rem;
    height: 0.9rem;
    margin-top: -0.25rem;
    border: 2px solid #0d1117;
    border-radius: 50%;
    background: var(--fill-color);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .brightness input:hover:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.12);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--fill-color) 35%, transparent);
  }

  .brightness input:active:not(:disabled) {
    cursor: grabbing;
  }

  .brightness input:active:not(:disabled)::-webkit-slider-thumb {
    transform: scale(1.05);
  }

  .brightness input::-moz-range-track {
    height: 0.4rem;
    border: none;
    border-radius: 999px;
    background: var(--track);
  }

  .brightness input::-moz-range-progress {
    height: 0.4rem;
    border-radius: 999px;
    background: var(--fill-color);
  }

  .brightness input::-moz-range-thumb {
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid #0d1117;
    border-radius: 50%;
    background: var(--fill-color);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .brightness input:hover:not(:disabled)::-moz-range-thumb {
    transform: scale(1.12);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--fill-color) 35%, transparent);
  }

  .brightness input:active:not(:disabled)::-moz-range-thumb {
    transform: scale(1.05);
  }

  .light-options {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.45rem;
    width: 100%;
  }

  .light-options.inactive {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    flex: 1;
    min-width: 0;
  }

  .preset {
    appearance: none;
    padding: 0.3rem 0.55rem;
    border: 1px solid #484f58;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tint) 28%, #21262d);
    color: #e6edf3;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
  }

  .preset:hover:not(:disabled) {
    border-color: #8b949e;
  }

  .preset.selected {
    border-color: #ffb900;
    background: color-mix(in srgb, var(--tint) 42%, #21262d);
    box-shadow: inset 0 0 0 1px rgba(255, 185, 0, 0.25);
  }

  .preset:disabled {
    cursor: not-allowed;
  }

  .color-picker {
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    padding: 0.1rem;
    border: 1px solid #484f58;
    border-radius: 6px;
    background: #21262d;
    cursor: pointer;
  }

  .light-options.inactive .color-picker,
  .color-picker:disabled {
    cursor: not-allowed;
  }

  .color-picker::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .color-picker::-webkit-color-swatch {
    border: none;
    border-radius: 4px;
  }

  .color-picker::-moz-color-swatch {
    border: none;
    border-radius: 4px;
  }
</style>
