const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

let accessToken = null;
let tokenExpiresAt = 0;

function getCredentials() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? "",
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN?.trim() ?? "",
  };
}

export function isSpotifyConfigured() {
  const { clientId, clientSecret, refreshToken } = getCredentials();
  return Boolean(clientId && clientSecret && refreshToken);
}

export function hasSpotifyAppCredentials() {
  const { clientId, clientSecret } = getCredentials();
  return Boolean(clientId && clientSecret);
}

function normalizeSpotifyHost(host) {
  return host.replace(/^localhost/i, "127.0.0.1");
}

export function getSpotifyRedirectUri(req) {
  const configured = process.env.SPOTIFY_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  if (req?.headers?.host) {
    const proto = req.headers["x-forwarded-proto"] ?? "http";
    const host = normalizeSpotifyHost(req.headers.host);
    return `${proto}://${host}/api/spotify/callback`;
  }

  const port = process.env.PORT ?? 3000;
  return `http://127.0.0.1:${port}/api/spotify/callback`;
}

export function getSuggestedRedirectUris() {
  const port = process.env.PORT ?? 3000;
  return [
    `http://127.0.0.1:${port}/api/spotify/callback`,
    "http://127.0.0.1:5173/api/spotify/callback",
  ];
}

async function refreshAccessToken() {
  const { clientId, clientSecret, refreshToken } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Spotify token refresh failed");
  }

  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  return refreshAccessToken();
}

function mapTrack(item) {
  if (!item) {
    return null;
  }

  const track = item.type === "track" ? item : item.item;
  if (!track || track.type !== "track") {
    return null;
  }

  const image = track.album?.images?.[0]?.url ?? null;
  const releaseDate = track.album?.release_date ?? "";

  return {
    id: track.id,
    name: track.name,
    artists: track.artists?.map((artist) => artist.name) ?? [],
    album: track.album?.name ?? "",
    durationMs: track.duration_ms ?? 0,
    trackNumber: track.track_number ?? null,
    explicit: Boolean(track.explicit),
    releaseYear: releaseDate ? releaseDate.slice(0, 4) : null,
    imageUrl: image,
  };
}

function mapQueueTrack(item) {
  if (!item) {
    return null;
  }

  if (item.type === "episode") {
    const image = item.images?.[0]?.url ?? item.show?.images?.[0]?.url ?? null;
    return {
      id: item.id,
      name: item.name,
      artists: item.show?.name ? [item.show.name] : ["Podcast"],
      album: item.show?.name ?? "Podcast",
      durationMs: item.duration_ms ?? 0,
      imageUrl: image,
    };
  }

  if (item.type !== "track") {
    return null;
  }

  const images = item.album?.images ?? [];
  const image = images.at(-1)?.url ?? images[0]?.url ?? null;

  return {
    id: item.id,
    name: item.name,
    artists: item.artists?.map((artist) => artist.name) ?? [],
    album: item.album?.name ?? "",
    durationMs: item.duration_ms ?? 0,
    imageUrl: image,
  };
}

async function fetchUpcoming(token) {
  const response = await fetch(`${API_BASE}/me/player/queue`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204 || response.status === 404) {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const seen = new Set();

  return (data.queue ?? [])
    .map(mapQueueTrack)
    .filter((track) => {
      if (!track || seen.has(track.id)) {
        return false;
      }

      seen.add(track.id);
      return true;
    })
    .slice(0, 5);
}

function mapDevice(device) {
  if (!device) {
    return null;
  }

  return {
    id: device.id ?? null,
    name: device.name ?? null,
    type: device.type ?? null,
    volumePercent: device.volume_percent ?? null,
  };
}

function normalizeRepeatState(value) {
  if (value === "context" || value === "track") {
    return value;
  }

  return "off";
}

function mapPlaybackState(data, upcoming = []) {
  const track = mapTrack(data?.item);
  const currentId = track?.id;
  const filteredUpcoming = currentId
    ? upcoming.filter((item) => item.id !== currentId)
    : upcoming;

  return {
    configured: true,
    playing: Boolean(track),
    paused: !data.is_playing,
    track,
    progressMs: data.progress_ms ?? 0,
    device: mapDevice(data.device),
    shuffle: Boolean(data.shuffle_state),
    repeat: normalizeRepeatState(data.repeat_state),
    contextType: data.context?.type ?? null,
    upcoming: filteredUpcoming.slice(0, 5),
  };
}

function buildDeviceParams(deviceId) {
  const params = new URLSearchParams();
  if (deviceId) {
    params.set("device_id", deviceId);
  }
  return params;
}

export async function fetchCurrentlyPlaying() {
  if (!isSpotifyConfigured()) {
    return {
      configured: false,
      playing: false,
      paused: false,
      track: null,
      progressMs: 0,
      upcoming: [],
    };
  }

  const token = await getAccessToken();
  const [response, upcoming] = await Promise.all([
    fetch(`${API_BASE}/me/player`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    fetchUpcoming(token),
  ]);

  if (response.status === 204) {
    return {
      configured: true,
      playing: false,
      paused: false,
      track: null,
      progressMs: 0,
      device: null,
      shuffle: false,
      repeat: "off",
      upcoming,
    };
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `Spotify API error (${response.status})`);
  }

  const data = await response.json();
  return mapPlaybackState(data, upcoming);
}

function expandQueueTrack(queueTrack, currentTrack) {
  return {
    id: queueTrack.id,
    name: queueTrack.name,
    artists: queueTrack.artists ?? [],
    album: queueTrack.album ?? currentTrack?.album ?? "",
    durationMs: queueTrack.durationMs ?? 0,
    trackNumber: null,
    explicit: false,
    releaseYear: null,
    imageUrl: queueTrack.imageUrl ?? null,
  };
}

function toHistoryTrack(track) {
  if (!track?.id) {
    return null;
  }

  return {
    id: track.id,
    name: track.name,
    artists: track.artists ?? [],
    album: track.album ?? "",
    durationMs: track.durationMs ?? 0,
    imageUrl: track.imageUrl ?? null,
  };
}

function pushHistory(history, track) {
  const item = toHistoryTrack(track);
  if (!item) {
    return history ?? [];
  }

  return [item, ...(history ?? []).filter((entry) => entry.id !== item.id)].slice(0, 5);
}

export function buildOptimisticPatch(action, state, patch = {}) {
  if (action === "next") {
    const [nextTrack, ...rest] = state.upcoming ?? [];
    if (!nextTrack) {
      return { ...patch, progressMs: 0 };
    }

    return {
      ...patch,
      history: pushHistory(state.history, state.track),
      track: expandQueueTrack(nextTrack, state.track),
      progressMs: 0,
      paused: false,
      playing: true,
      upcoming: rest.slice(0, 5),
    };
  }

  if (action === "previous") {
    const [previousTrack, ...restHistory] = state.history ?? [];
    if (!previousTrack) {
      return { ...patch, progressMs: 0 };
    }

    const currentAsUpcoming = toHistoryTrack(state.track);
    const upcoming = currentAsUpcoming
      ? [currentAsUpcoming, ...(state.upcoming ?? [])].slice(0, 5)
      : state.upcoming ?? [];

    return {
      ...patch,
      track: expandQueueTrack(previousTrack, state.track),
      history: restHistory,
      upcoming,
      progressMs: 0,
      paused: false,
      playing: true,
    };
  }

  if (action === "pause") {
    return { ...patch, paused: true };
  }

  if (action === "play") {
    return { ...patch, paused: false, playing: true };
  }

  return patch;
}

export async function syncPlaybackState() {
  const playback = await fetchCurrentlyPlaying();
  return playback;
}

export async function executePlaybackControl(action, playbackState = {}) {
  if (!isSpotifyConfigured()) {
    throw new Error("Spotify is not configured");
  }

  const token = await getAccessToken();
  const deviceId = playbackState.device?.id ?? null;

  switch (action) {
    case "play":
      await spotifyPlayerRequest(token, "PUT", "/me/player/play", deviceId);
      return {};
    case "pause":
      await spotifyPlayerRequest(token, "PUT", "/me/player/pause", deviceId);
      return {};
    case "next":
      await spotifyPlayerRequest(token, "POST", "/me/player/next", deviceId);
      return {};
    case "previous":
      await spotifyPlayerRequest(token, "POST", "/me/player/previous", deviceId);
      return {};
    case "shuffle": {
      const next = !playbackState.shuffle;
      const params = buildDeviceParams(deviceId);
      params.set("state", String(next));
      await spotifyPlayerRequest(token, "PUT", `/me/player/shuffle?${params}`);
      return { shuffle: next };
    }
    case "repeat": {
      const current = normalizeRepeatState(playbackState.repeat);
      const next = current === "off" ? "context" : current === "context" ? "track" : "off";
      const params = buildDeviceParams(deviceId);
      params.set("state", next);
      await spotifyPlayerRequest(token, "PUT", `/me/player/repeat?${params}`);
      return { repeat: next };
    }
    default:
      throw new Error(`Unknown playback action: ${action}`);
  }
}

async function spotifyPlayerRequest(token, method, path, deviceId = null) {
  let url = `${API_BASE}${path}`;

  if (deviceId && !path.includes("device_id=")) {
    const joiner = path.includes("?") ? "&" : "?";
    url = `${url}${joiner}device_id=${encodeURIComponent(deviceId)}`;
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 204 || response.status === 202) {
    return;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message ?? `Spotify API error (${response.status})`);
  }
}

export async function exchangeAuthCode(code, redirectUri) {
  const { clientId, clientSecret } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description ?? data.error ?? "Spotify auth failed");
  }

  return data;
}

export function buildAuthorizeUrl(state, redirectUri) {
  const { clientId } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "user-read-currently-playing user-read-playback-state user-modify-playback-state",
    state,
  });

  return `https://accounts.spotify.com/authorize?${params}`;
}
