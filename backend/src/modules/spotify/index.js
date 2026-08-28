import {
  fetchCurrentlyPlaying,
  getSuggestedRedirectUris,
  isSpotifyConfigured,
} from "./client.js";
import {
  clearNowPlayingError,
  setNowPlaying,
  setNowPlayingError,
} from "./store.js";

const POLL_MS = Number(process.env.SPOTIFY_POLL_MS) || 5_000;

async function pollNowPlaying() {
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
    const playback = await fetchCurrentlyPlaying();
    setNowPlaying({
      ...playback,
      error: null,
    });
    clearNowPlayingError();
  } catch (err) {
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

  console.log("[spotify] Polling now playing every %ds", POLL_MS / 1000);
  pollNowPlaying();
  setInterval(pollNowPlaying, POLL_MS);
}
