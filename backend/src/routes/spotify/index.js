import {
  getPathname,
  parseQuery,
  readJsonBody,
  sendHtml,
  sendJson,
  sendRedirect,
} from "../../lib/http.js";
import {
  buildAuthorizeUrl,
  buildOptimisticPatch,
  exchangeAuthCode,
  executePlaybackControl,
  getSpotifyRedirectUri,
  getSuggestedRedirectUris,
  hasSpotifyAppCredentials,
  isSpotifyConfigured,
  syncPlaybackState,
} from "../../modules/spotify/client.js";
import { getNowPlaying, setNowPlaying } from "../../modules/spotify/store.js";
import { markQueuePollRefreshed } from "../../modules/spotify/client.js";

const SYNC_ACTIONS = new Set(["next", "previous", "play", "pause"]);

let controlQueue = Promise.resolve();
let syncGeneration = 0;
let syncTimer = null;

function enqueueControl(task) {
  const run = controlQueue.then(task, task);
  controlQueue = run.catch(() => {});
  return run;
}

function mergeSyncedPlayback(current, synced) {
  return {
    ...synced,
    history: current.history ?? [],
    upcoming: synced.upcoming ?? [],
    shuffle: synced.shuffle ?? current.shuffle,
    repeat: synced.repeat ?? current.repeat,
    error: null,
  };
}

function schedulePlaybackSync(trackIdBefore = null) {
  syncGeneration += 1;
  const generation = syncGeneration;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  const attemptSync = async (attempt = 0) => {
    if (generation !== syncGeneration) {
      return;
    }

    try {
      const synced = await syncPlaybackState();
      if (generation !== syncGeneration) {
        return;
      }

      const current = getNowPlaying();
      const syncedId = synced.track?.id ?? null;

      if (trackIdBefore && syncedId === trackIdBefore && attempt < 6) {
        syncTimer = setTimeout(() => attemptSync(attempt + 1), 400);
        return;
      }

      if (trackIdBefore && syncedId && syncedId !== trackIdBefore) {
        markQueuePollRefreshed();
      }

      setNowPlaying(mergeSyncedPlayback(current, synced));
    } catch {
      if (generation === syncGeneration && attempt < 6) {
        syncTimer = setTimeout(() => attemptSync(attempt + 1), 400);
      }
    }
  };

  syncTimer = setTimeout(() => attemptSync(0), 500);
}

async function handlePlaybackControl(action) {
  const current = getNowPlaying();
  const trackIdBefore = current.track?.id ?? null;
  const patch = await executePlaybackControl(action, current);
  const optimistic = buildOptimisticPatch(action, current, patch);

  setNowPlaying({
    ...current,
    ...optimistic,
    error: null,
  });

  if (SYNC_ACTIONS.has(action)) {
    const waitForTrackChange = action === "next" || action === "previous";
    schedulePlaybackSync(waitForTrackChange ? trackIdBefore : null);
  }

  return getNowPlaying();
}

export async function spotifyRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (pathname === "/api/spotify/now-playing" && method === "GET") {
    sendJson(res, 200, getNowPlaying());
    return true;
  }

  if (pathname === "/api/spotify/control" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const action = body.action;

      if (!action || typeof action !== "string") {
        sendJson(res, 400, { error: "Missing action" });
        return true;
      }

      const playback = await enqueueControl(() => handlePlaybackControl(action));
      sendJson(res, 200, playback);
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }

    return true;
  }

  if (pathname === "/api/spotify/setup" && method === "GET") {
    const redirectUri = getSpotifyRedirectUri(req);
    sendJson(res, 200, {
      configured: isSpotifyConfigured(),
      hasClientCredentials: hasSpotifyAppCredentials(),
      hasRefreshToken: Boolean(process.env.SPOTIFY_REFRESH_TOKEN?.trim()),
      redirectUri,
      suggestedRedirectUris: getSuggestedRedirectUris(),
      authPath: "/api/spotify/auth",
      hint: "Add client id/secret to backend/.env, register redirectUri in the Spotify app, then connect to obtain a refresh token.",
    });
    return true;
  }

  if (pathname === "/api/spotify/auth" && method === "GET") {
    if (!hasSpotifyAppCredentials()) {
      sendJson(res, 503, { error: "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first" });
      return true;
    }

    const redirectUri = getSpotifyRedirectUri(req);
    console.log("[spotify] Auth redirect_uri:", redirectUri);
    sendRedirect(res, buildAuthorizeUrl("monitorapp", redirectUri));
    return true;
  }

  if (pathname === "/api/spotify/callback" && method === "GET") {
    const redirectUri = getSpotifyRedirectUri(req);
    const query = parseQuery(req.url ?? "/");
    const error = query.get("error");
    const code = query.get("code");

    if (error) {
      sendHtml(
        res,
        400,
        `<!doctype html><html><body style="font-family:system-ui;background:#0d1117;color:#e6edf3;padding:2rem;max-width:720px;margin:0 auto">
<h1>Spotify auth failed</h1>
<p>${error}</p>
<p>Add this exact redirect URI in your Spotify app settings:</p>
<pre style="background:#161b22;border:1px solid #30363d;padding:1rem;border-radius:8px">${redirectUri}</pre>
<p>Then open auth again from the same host/port (e.g. <code>${redirectUri.replace("/callback", "/auth")}</code>).</p>
</body></html>`,
      );
      return true;
    }

    if (!code) {
      sendHtml(res, 400, "<!doctype html><html><body><h1>Missing authorization code</h1></body></html>");
      return true;
    }

    try {
      const tokens = await exchangeAuthCode(code, redirectUri);
      sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Spotify connected</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 2rem; max-width: 720px; margin: 0 auto; }
    code, pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; display: block; overflow-x: auto; }
    h1 { color: #1db954; }
  </style>
</head>
<body>
  <h1>Spotify connected</h1>
  <p>Add this refresh token to <code>backend/.env</code>, then restart the backend:</p>
  <pre>SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}</pre>
  <p>You can close this page.</p>
</body>
</html>`,
      );
    } catch (err) {
      sendHtml(res, 500, `<!doctype html><html><body><h1>Spotify auth failed</h1><p>${err.message}</p></body></html>`);
    }

    return true;
  }

  return false;
}
