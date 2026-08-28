const defaultState = {
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
  updatedAt: null,
};

let state = { ...defaultState };

const HISTORY_LIMIT = 5;

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

  return [item, ...(history ?? []).filter((entry) => entry.id !== item.id)].slice(0, HISTORY_LIMIT);
}

export function getNowPlaying() {
  return state;
}

export function setNowPlaying(next) {
  const previousTrack = state.track;
  const nextTrack = next.track;
  let history = next.history ?? state.history ?? [];

  if (
    !Object.prototype.hasOwnProperty.call(next, "history")
    && nextTrack?.id
    && previousTrack?.id
    && nextTrack.id !== previousTrack.id
  ) {
    history = pushHistory(history, previousTrack);
  }

  state = {
    ...state,
    ...next,
    history,
    updatedAt: new Date().toISOString(),
  };
}

export function setNowPlayingError(message) {
  state = {
    ...state,
    error: message,
    updatedAt: new Date().toISOString(),
  };
}

export function clearNowPlayingError() {
  if (!state.error) {
    return;
  }

  state = {
    ...state,
    error: null,
  };
}
