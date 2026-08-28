const defaultState = {
  hostname: null,
  platform: null,
  platformLabel: null,
  boardName: null,
  uptimeSec: 0,
  uptimeLabel: "—",
  memory: null,
  disk: null,
  cpu: null,
  temperature: null,
  error: null,
  updatedAt: null,
};

let state = { ...defaultState };

export function getSystemStatus() {
  return state;
}

export function setSystemStatus(next) {
  state = {
    ...state,
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function setSystemError(message) {
  state = {
    ...state,
    error: message,
    updatedAt: new Date().toISOString(),
  };
}
