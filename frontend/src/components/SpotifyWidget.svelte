<script>
  import { onMount } from "svelte";
  import { fetchNowPlaying, spotifyControl } from "../lib/api.js";

  const POLL_MS = 15_000;
  const QUEUE_SIZE = 5;

  const CONTEXT_LABELS = {
    album: "Album",
    artist: "Artist",
    playlist: "Playlist",
    show: "Podcast",
  };

  const DEVICE_LABELS = {
    Computer: "PC",
    Smartphone: "Phone",
    Speaker: "Speaker",
    Tv: "TV",
    Cast: "Cast",
    Tablet: "Tablet",
    Game_console: "Console",
    Automobile: "Car",
  };

  let playback = $state(null);
  let tick = $state(Date.now());
  let controlling = $state(false);
  let controlError = $state("");
  let controlSeq = 0;

  const progressMs = $derived.by(() => {
    if (!playback?.track || !playback.playing || playback.paused) {
      return playback?.progressMs ?? 0;
    }

    const base = playback.progressMs ?? 0;
    const updatedAt = playback.updatedAt ? new Date(playback.updatedAt).getTime() : tick;
    const elapsed = tick - updatedAt;
    return Math.min(base + Math.max(elapsed, 0), playback.track.durationMs);
  });

  const progressPct = $derived(
    playback?.track?.durationMs
      ? (progressMs / playback.track.durationMs) * 100
      : 0
  );

  const remainingMs = $derived(
    playback?.track?.durationMs
      ? Math.max(playback.track.durationMs - progressMs, 0)
      : 0
  );

  const contextLabel = $derived(
    playback?.contextType ? CONTEXT_LABELS[playback.contextType] ?? playback.contextType : null
  );

  const deviceLabel = $derived.by(() => {
    const device = playback?.device;
    if (!device?.name) {
      return null;
    }

    const typeLabel = device.type ? DEVICE_LABELS[device.type] ?? device.type : null;
    return typeLabel ? `${device.name} · ${typeLabel}` : device.name;
  });

  const repeatLabel = $derived.by(() => {
    switch (playback?.repeat) {
      case "context":
        return "All";
      case "track":
        return "One";
      default:
        return "Off";
    }
  });

  const repeatAriaLabel = $derived.by(() => {
    switch (playback?.repeat) {
      case "context":
        return "Repeat all on. Click to repeat one song.";
      case "track":
        return "Repeat one on. Click to turn repeat off.";
      default:
        return "Repeat off. Click to repeat all.";
    }
  });

  const queueSlots = $derived.by(() => {
    const exclude = new Set([
      ...(playback?.track?.id ? [playback.track.id] : []),
      ...(playback?.history ?? []).map((entry) => entry.id).filter(Boolean),
    ]);
    const items = (playback?.upcoming ?? []).filter((track) => track?.id && !exclude.has(track.id));
    return Array.from({ length: QUEUE_SIZE }, (_, index) => items[index] ?? null);
  });

  function formatMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  async function refresh() {
    try {
      playback = await fetchNowPlaying();
      controlError = "";
    } catch (err) {
      playback = {
        configured: true,
        playing: false,
        track: null,
        error: err.message,
      };
    }
  }

  function nextRepeatState(current) {
    switch (current) {
      case "context":
        return "track";
      case "track":
        return "off";
      default:
        return "context";
    }
  }

  function trackFromQueueItem(item, fallback) {
    return {
      id: item.id,
      name: item.name,
      artists: item.artists ?? [],
      album: item.album ?? fallback?.album ?? "",
      durationMs: item.durationMs ?? 0,
      trackNumber: null,
      explicit: false,
      releaseYear: null,
      imageUrl: item.imageUrl ?? null,
    };
  }

  function pushLocalHistory(history, track) {
    if (!track?.id) {
      return history ?? [];
    }

    const item = trackFromQueueItem(track, track);
    return [item, ...(history ?? []).filter((entry) => entry.id !== item.id)].slice(0, 5);
  }

  function applyNextOptimistic(state) {
    const [nextTrack, ...rest] = state.upcoming ?? [];
    if (!nextTrack) {
      return state;
    }

    return {
      ...state,
      history: pushLocalHistory(state.history, state.track),
      track: trackFromQueueItem(nextTrack, state.track),
      progressMs: 0,
      paused: false,
      playing: true,
      upcoming: rest.slice(0, 5),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyPreviousOptimistic(state) {
    const [previousTrack, ...restHistory] = state.history ?? [];
    if (!previousTrack) {
      return state;
    }

    const currentAsUpcoming = state.track ? trackFromQueueItem(state.track, state.track) : null;
    const upcoming = currentAsUpcoming
      ? [currentAsUpcoming, ...(state.upcoming ?? [])].slice(0, 5)
      : state.upcoming ?? [];

    return {
      ...state,
      track: trackFromQueueItem(previousTrack, state.track),
      history: restHistory,
      upcoming,
      progressMs: 0,
      paused: false,
      playing: true,
      updatedAt: new Date().toISOString(),
    };
  }

  async function sendControl(action) {
    if (!playback?.configured) {
      return;
    }

    const isSkip = action === "next" || action === "previous";
    if (!isSkip && controlling) {
      return;
    }

    if (!isSkip) {
      controlling = true;
    }

    controlError = "";
    const snapshot = playback;
    const seq = ++controlSeq;

    if (action === "shuffle") {
      playback = { ...playback, shuffle: !playback.shuffle };
    } else if (action === "repeat") {
      playback = {
        ...playback,
        repeat: nextRepeatState(playback.repeat ?? "off"),
      };
    } else if (action === "pause") {
      playback = { ...playback, paused: true };
    } else if (action === "play") {
      playback = { ...playback, paused: false, playing: true };
    } else if (action === "next") {
      playback = applyNextOptimistic(playback);
    } else if (action === "previous") {
      playback = applyPreviousOptimistic(playback);
    }

    try {
      const result = await spotifyControl(action);
      if (seq === controlSeq) {
        playback = result;
        tick = Date.now();
      }
    } catch (err) {
      if (seq === controlSeq) {
        if (isSkip) {
          controlError = err.message;
        } else {
          playback = snapshot;
          controlError = err.message;
        }
      }
    } finally {
      if (!isSkip) {
        controlling = false;
      }
    }
  }

  onMount(() => {
    refresh();
    const pollTimer = setInterval(refresh, POLL_MS);
    const tickTimer = setInterval(() => {
      tick = Date.now();
    }, 1000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  });
</script>

<article class="spotify-card">

  {#if playback?.error}
    <p class="status error">{playback.error}</p>
  {:else if !playback?.configured}
    <p class="status">Not configured</p>
    <p class="hint">Add Spotify credentials to backend/.env</p>
  {:else if !playback?.track}
    <p class="status">Nothing playing</p>
    {#if deviceLabel}
      <p class="hint">Last device: {deviceLabel}</p>
    {/if}
  {:else}
    <div class="content">
    <div class="main-col">
    <div class="now-playing">
      {#if playback.track.imageUrl}
        <img class="art" src={playback.track.imageUrl} alt="" />
      {:else}
        <div class="art placeholder" aria-hidden="true"></div>
      {/if}

      <div class="meta">
        <p class="track">
          {playback.track.name}
          {#if playback.track.explicit}
            <span class="explicit">E</span>
          {/if}
        </p>
        <p class="artist">{playback.track.artists.join(", ")}</p>
        <p class="album">
          {playback.track.album}
          {#if playback.track.releaseYear}
            <span class="year"> · {playback.track.releaseYear}</span>
          {/if}
          {#if playback.track.trackNumber}
            <span class="year"> · #{playback.track.trackNumber}</span>
          {/if}
        </p>

        <div class="progress-row">
          <div class="progress" aria-hidden="true">
            <span class="bar" style:width="{progressPct}%"></span>
          </div>
          <div class="times">
            <span>{formatMs(progressMs)}</span>
            <span>{formatMs(remainingMs)} left</span>
          </div>
        </div>

        <div class="footer">
          {#if deviceLabel}
            <span class="detail">{deviceLabel}</span>
          {/if}
          {#if playback.device?.volumePercent != null}
            <span class="detail">Vol {playback.device.volumePercent}%</span>
          {/if}
          {#if contextLabel}
            <span class="detail">{contextLabel}</span>
          {/if}
        </div>
      </div>
    </div>

    <div class="controls">
      <button
        type="button"
        class="control toggle"
        class:on={playback.shuffle === true}
        aria-pressed={playback.shuffle === true}
        aria-label={playback.shuffle ? "Shuffle on" : "Shuffle off"}
        title={playback.shuffle ? "Turn shuffle off" : "Turn shuffle on"}
        disabled={controlling}
        onclick={() => sendControl("shuffle")}
      >
        <span class="toggle-icon" aria-hidden="true">⇄</span>
        <span class="toggle-text">Shuffle</span>
      </button>

      <div class="transport">
        <button
          type="button"
          class="control"
          aria-label="Previous track"
          disabled={controlling}
          onclick={() => sendControl("previous")}
        >
          ‹‹
        </button>
        <button
          type="button"
          class="control primary"
          aria-label={playback.paused ? "Play" : "Pause"}
          disabled={controlling}
          onclick={() => sendControl(playback.paused ? "play" : "pause")}
        >
          {playback.paused ? "▶" : "❚❚"}
        </button>
        <button
          type="button"
          class="control"
          aria-label="Next track"
          disabled={controlling}
          onclick={() => sendControl("next")}
        >
          ››
        </button>
      </div>

      <button
        type="button"
        class="control toggle repeat"
        class:on={playback.repeat === "context"}
        class:one={playback.repeat === "track"}
        aria-pressed={playback.repeat === "context" || playback.repeat === "track"}
        aria-label={repeatAriaLabel}
        title={repeatAriaLabel}
        disabled={controlling}
        onclick={() => sendControl("repeat")}
      >
        <span class="toggle-icon" aria-hidden="true">
          {playback.repeat === "track" ? "↻1" : "↻"}
        </span>
        <span class="toggle-text">{repeatLabel}</span>
      </button>
    </div>

    {#if controlError}
      <p class="control-error">{controlError}</p>
    {/if}
    </div>

    <div class="upcoming">
      <p class="upcoming-title">Up next</p>
      <ol class="queue">
        {#each queueSlots as track, index (`${track?.id ?? "empty"}-${index}`)}
          <li class:empty={!track} aria-hidden={!track}>
            <span class="queue-index">{index + 1}</span>
            {#if track?.imageUrl}
              <img class="queue-art" src={track.imageUrl} alt="" />
            {:else}
              <span class="queue-art placeholder"></span>
            {/if}
            <div class="queue-meta">
              <span class="queue-track">{track?.name ?? "—"}</span>
              <span class="queue-artist">{track ? track.artists.join(", ") : ""}</span>
            </div>
            <span class="queue-duration">{track ? formatMs(track.durationMs) : ""}</span>
          </li>
        {/each}
      </ol>
    </div>
    </div>
  {/if}
</article>

<style>
  .spotify-card {
    display: flex;
    flex-direction: column;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    min-height: 7.5rem;
    line-height: 1.2;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.55rem;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    justify-content: flex-end;
  }

  .brand {
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #1db954;
  }

  .badge {
    font-size: 0.62rem;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status {
    margin: 0;
    font-size: 0.95rem;
    color: #8b949e;
  }

  .status.error {
    color: #ff7b72;
    font-size: 0.85rem;
  }

  .hint {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: #6e7681;
  }

  .now-playing {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    min-width: 0;
    flex: 1;
  }

  .content {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    min-width: 0;
  }

  .main-col {
    flex: 1;
    min-width: 0;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.65rem;
    flex-wrap: wrap;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .control {
    appearance: none;
    border: 1px solid #30363d;
    background: #21262d;
    color: #e6edf3;
    border-radius: 999px;
    min-width: 2.25rem;
    height: 2.25rem;
    padding: 0 0.65rem;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .control.toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-width: auto;
    height: 2rem;
    padding: 0 0.6rem;
    color: #8b949e;
    background: #161b22;
  }

  .control.toggle .toggle-icon {
    font-size: 0.9rem;
    line-height: 1;
  }

  .control.toggle .toggle-text {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .control.toggle.on {
    color: #1db954;
    border-color: #1db954;
    background: rgba(29, 185, 84, 0.12);
  }

  .control.toggle.repeat.one {
    color: #1db954;
    border-color: #1db954;
    background: rgba(29, 185, 84, 0.12);
  }

  .control.toggle.repeat.one .toggle-icon {
    font-size: 0.72rem;
    font-weight: 700;
  }

  .control:hover:not(:disabled) {
    background: #30363d;
    border-color: #484f58;
  }

  .control.toggle.on:hover:not(:disabled),
  .control.toggle.repeat.one:hover:not(:disabled) {
    background: rgba(29, 185, 84, 0.18);
    border-color: #1ed760;
  }

  .control:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .control.primary {
    min-width: 2.75rem;
    height: 2.75rem;
    font-size: 0.95rem;
    background: #1db954;
    border-color: #1db954;
    color: #0d1117;
  }

  .control.primary:hover:not(:disabled) {
    background: #1ed760;
    border-color: #1ed760;
  }

  .control-error {
    margin: 0.35rem 0 0;
    font-size: 0.72rem;
    color: #ff7b72;
  }

  .upcoming {
    flex: 1;
    min-width: 0;
    border-left: 1px solid #30363d;
    padding-left: 1rem;
  }

  .upcoming-title {
    margin: 0 0 0.45rem;
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8b949e;
  }

  .queue {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-height: calc(5 * 1.75rem + 4 * 0.35rem);
  }

  .queue li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    min-height: 1.75rem;
  }

  .queue li.empty {
    visibility: hidden;
  }

  .queue-index {
    flex-shrink: 0;
    width: 0.85rem;
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    color: #6e7681;
    text-align: right;
  }

  .queue-art {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .queue-art.placeholder {
    display: block;
    background: linear-gradient(135deg, #1db954 0%, #191414 100%);
  }

  .queue-meta {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .queue-track {
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .queue-artist {
    font-size: 0.65rem;
    color: #8b949e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .queue-duration {
    flex-shrink: 0;
    font-size: 0.62rem;
    font-variant-numeric: tabular-nums;
    color: #6e7681;
  }

  @media (max-width: 599px) {
    .content {
      flex-direction: column;
    }

    .upcoming {
      width: 100%;
      border-left: 0;
      padding-left: 0;
      border-top: 1px solid #30363d;
      padding-top: 0.65rem;
    }
  }

  .art {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
  }

  .art.placeholder {
    background: linear-gradient(135deg, #1db954 0%, #191414 100%);
  }

  .meta {
    min-width: 0;
    flex: 1;
  }

  .track {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .explicit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 0.3rem;
    padding: 0.05rem 0.25rem;
    border-radius: 3px;
    font-size: 0.55rem;
    font-weight: 700;
    vertical-align: middle;
    color: #8b949e;
    border: 1px solid #484f58;
  }

  .artist {
    margin: 0.15rem 0 0;
    font-size: 0.8rem;
    color: #c9d1d9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .album {
    margin: 0.1rem 0 0.45rem;
    font-size: 0.72rem;
    color: #8b949e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .year {
    color: #6e7681;
  }

  .progress-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .progress {
    height: 4px;
    background: #30363d;
    border-radius: 999px;
    overflow: hidden;
  }

  .bar {
    display: block;
    height: 100%;
    background: #1db954;
    border-radius: 999px;
    transition: width 1s linear;
  }

  .times {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
    color: #8b949e;
  }

  .footer {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.55rem;
    margin-top: 0.35rem;
  }

  .detail {
    font-size: 0.65rem;
    color: #6e7681;
  }
</style>
