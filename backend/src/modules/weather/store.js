const defaultState = {
  configured: false,
  location: null,
  current: null,
  forecast: [],
  error: null,
  updatedAt: null,
};

let state = { ...defaultState };

export function getWeather() {
  return state;
}

export function setWeather(next) {
  state = {
    ...state,
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function setWeatherError(message) {
  state = {
    ...state,
    error: message,
    updatedAt: new Date().toISOString(),
  };
}
