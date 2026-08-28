async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`);
  }

  return data;
}

export function fetchTags() {
  return request("/api/tags");
}

export function fetchReadings() {
  return request("/api/readings");
}

export function fetchHistory(tagId, { hours = 24, limit = 1000 } = {}) {
  const params = new URLSearchParams({
    tagId,
    hours: String(hours),
    limit: String(limit),
  });
  return request(`/api/history?${params}`);
}

export function setTagName(tagId, name) {
  return request(`/api/tags/${encodeURIComponent(tagId)}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function removeTagName(tagId) {
  return request(`/api/tags/${encodeURIComponent(tagId)}`, {
    method: "DELETE",
  });
}

export function fetchWeather() {
  return request("/api/weather");
}

export function fetchSystemStatus() {
  return request("/api/system");
}

export function fetchNowPlaying() {
  return request("/api/spotify/now-playing");
}

export function spotifyControl(action) {
  return request("/api/spotify/control", {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
