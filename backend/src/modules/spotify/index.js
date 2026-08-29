import {
  fetchCurrentlyPlaying,
  getSuggestedRedirectUris,
  isSpotifyConfigured,
  shouldRefreshQueue,
  SpotifyRateLimitError,
} from "./client.js";
import {
  clearNowPlayingError,
  setNowPlaying,
  setNowPlayingError,
} from "./store.js";

const POLL_MS = Number(process.env.SPOTIFY_POLL_MS) || 15_000;

let backoffUntil = 0;

async function pollNowPlaying() {
  if (Date.now() < backoffUntil) {
    return;
  }

  if (!isSpotifyConfigured()) {
    setNowPlaying({
      configured: false,
      playing: false,
      paused: false,
      track: null,
      progressMs: 0,
      device: null,
      shuffle: false,
      repeat: "off",
      upcoming: [],
      history: [],
      error: null,
    });
    return;
  }

  try {
    const includeUpcoming = shouldRefreshQueue();
    const playback = await fetchCurrentlyPlaying({ includeUpcoming });

    setNowPlaying({
      ...playback,
      error: null,
    });
    clearNowPlayingError();
  } catch (err) {
    if (err instanceof SpotifyRateLimitError) {
      backoffUntil = Date.now() + err.retryAfterSec * 1000;
      console.warn("[spotify] Rate limited — backing off for %ds", err.retryAfterSec);
    }

    setNowPlayingError(err.message);
  }
}

export function startSpotify() {
  if (!isSpotifyConfigured()) {
    console.log("[spotify] Not configured — set SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN");
    console.log("[spotify] Visit /api/spotify/auth after adding client id/secret to obtain a refresh token");
    console.log("[spotify] Redirect URIs to add in Spotify dashboard:");
    for (const uri of getSuggestedRedirectUris()) {
      console.log("[spotify]   %s", uri);
    }
    setNowPlaying({
      configured: false,
      playing: false,
      paused: false,
      track: null,
      progressMs: 0,
      device: null,
      shuffle: false,
      repeat: "off",
      upcoming: [],
      history: [],
      error: null,
    });
    return;
  }

  const queuePollMs = Number(process.env.SPOTIFY_QUEUE_POLL_MS) || 60_000;
  console.log(
    "[spotify] Polling playback every %ds, queue every %ds",
    POLL_MS / 1000,
    queuePollMs / 1000,
  );
  pollNowPlaying();
  setInterval(pollNowPlaying, POLL_MS);
}
