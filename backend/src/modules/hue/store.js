const defaultState = {
  configured: false,
  bridgeIp: null,
  lights: [],
  error: null,
  updatedAt: null,
};

let state = { ...defaultState };

export function getHueState() {
  return state;
}

export function setHueState(next) {
  state = {
    ...state,
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function setHueError(message) {
  state = {
    ...state,
    error: message,
    updatedAt: new Date().toISOString(),
  };
}

export function updateLight(id, patch) {
  state = {
    ...state,
    lights: state.lights.map((light) =>
      light.id === id ? { ...light, ...patch, controlledAt: Date.now() } : light,
    ),
    updatedAt: new Date().toISOString(),
  };
}

const CONTROL_HOLD_MS = 3_000;

export function mergePollLights(incoming) {
  const now = Date.now();

  return incoming.lights.map((light) => {
    const previous = state.lights.find((entry) => entry.id === light.id);
    if (previous?.controlledAt && now - previous.controlledAt < CONTROL_HOLD_MS) {
      return previous;
    }
    return light;
  });
}
