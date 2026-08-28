import https from "node:https";

const DEVICE_TYPE = "MonitorApp#monitor-kiosk";

function getBridgeIp() {
  return process.env.HUE_BRIDGE_IP?.trim() ?? "";
}

function getUsername() {
  return process.env.HUE_USERNAME?.trim() ?? "";
}

export function isHueConfigured() {
  return Boolean(getBridgeIp() && getUsername());
}

export function hasHueBridgeIp() {
  return Boolean(getBridgeIp());
}

function createAgent() {
  return new https.Agent({ rejectUnauthorized: false });
}

function request(path, { method = "GET", body } = {}) {
  const bridgeIp = getBridgeIp();
  if (!bridgeIp) {
    return Promise.reject(new Error("HUE_BRIDGE_IP is not set"));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: bridgeIp,
        port: 443,
        path,
        method,
        agent: createAgent(),
        headers: body ? { "Content-Type": "application/json" } : undefined,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode ?? 500,
              data: data ? JSON.parse(data) : null,
            });
          } catch (err) {
            reject(err);
          }
        });
      },
    );

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function parseHueErrors(data) {
  if (!Array.isArray(data)) {
    return null;
  }

  const error = data.find((entry) => entry.error)?.error;
  if (!error) {
    return null;
  }

  return error.description ?? "Hue API error";
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex ?? "");
  if (!match) {
    return null;
  }

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function rgbToXy(red, green, blue) {
  const toLinear = (channel) => {
    const value = channel / 255;
    return value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92;
  };

  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);

  const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047867;
  const Z = r * 0.000088 + g * 0.07317 + b * 0.83306;
  const sum = X + Y + Z;

  if (sum === 0) {
    return [0, 0];
  }

  return [X / sum, Y / sum];
}

function xyToRgb(x, y, brightness = 254) {
  const z = 1 - x - y;
  const Y = brightness / 254;
  const X = y === 0 ? 0 : (Y / y) * x;
  const Z = y === 0 ? 0 : (Y / y) * z;

  const gamma = (channel) =>
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;

  r = Math.max(0, Math.min(1, gamma(r)));
  g = Math.max(0, Math.min(1, gamma(g)));
  b = Math.max(0, Math.min(1, gamma(b)));

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function hsvToHex(h, s, v) {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (huePrime >= 0 && huePrime < 1) {
    r1 = chroma;
    g1 = x;
  } else if (huePrime < 2) {
    r1 = x;
    g1 = chroma;
  } else if (huePrime < 3) {
    g1 = chroma;
    b1 = x;
  } else if (huePrime < 4) {
    g1 = x;
    b1 = chroma;
  } else if (huePrime < 5) {
    r1 = x;
    b1 = chroma;
  } else {
    r1 = chroma;
    b1 = x;
  }

  const m = value - chroma;
  return rgbToHex(
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  );
}

function hsToHex(hue, sat, bri) {
  return hsvToHex((hue / 65535) * 360, (sat / 254) * 100, (bri / 254) * 100);
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointInGamut(x, y, gamut) {
  const points = gamut.map(([px, py]) => ({ x: px, y: py }));
  const target = { x, y };
  const c1 = cross(points[0], points[1], target);
  const c2 = cross(points[1], points[2], target);
  const c3 = cross(points[2], points[0], target);
  const hasNegative = c1 < 0 || c2 < 0 || c3 < 0;
  const hasPositive = c1 > 0 || c2 > 0 || c3 > 0;
  return !(hasNegative && hasPositive);
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    return start;
  }

  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return { x: start.x + t * dx, y: start.y + t * dy };
}

function clampToGamut(x, y, gamut) {
  if (!gamut?.length || gamut.length < 3) {
    return [x, y];
  }

  if (pointInGamut(x, y, gamut)) {
    return [x, y];
  }

  const points = gamut.map(([px, py]) => ({ x: px, y: py }));
  const target = { x, y };
  const edges = [
    [points[0], points[1]],
    [points[1], points[2]],
    [points[2], points[0]],
  ];

  let best = points[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [start, end] of edges) {
    const candidate = closestPointOnSegment(target, start, end);
    const distance = (target.x - candidate.x) ** 2 + (target.y - candidate.y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return [best.x, best.y];
}

function readLightColor(raw) {
  const state = raw.state;
  if (!state) {
    return null;
  }

  if (state.colormode === "ct" && state.ct != null) {
    return ctToHex(state.ct);
  }

  const bri = state.bri ?? 254;

  if (Array.isArray(state.xy) && state.xy.length === 2) {
    const rgb = xyToRgb(state.xy[0], state.xy[1], bri);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  if (state.hue != null && state.sat != null) {
    return hsToHex(state.hue, state.sat, bri);
  }

  return null;
}

function ctToHex(mired) {
  const kelvin = Math.max(1000, Math.min(40_000, 1_000_000 / mired));
  const temp = kelvin / 100;
  let r;
  let g;
  let b;

  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * (temp - 60) ** -0.1332047592));
    g = Math.min(255, Math.max(0, 288.1221695283 * (temp - 60) ** -0.0755148492));
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  }

  return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
}

function clampCt(ct, ctRange) {
  const min = ctRange?.min ?? 153;
  const max = ctRange?.max ?? 500;
  return Math.max(min, Math.min(max, Math.round(ct)));
}

export const LIGHT_PRESETS = {
  warm: { label: "Warm", ct: 454, xy: [0.4574, 0.41] },
  neutral: { label: "Neutral", ct: 366, xy: [0.3688, 0.3689] },
  cool: { label: "Cool", ct: 250, xy: [0.3227, 0.329] },
  daylight: { label: "Daylight", ct: 153, xy: [0.3144, 0.3302] },
};

function hasColorControl(raw) {
  return Boolean(raw.capabilities?.control?.colorgamut?.length);
}

function hasCtControl(raw) {
  return raw.capabilities?.control?.ct != null;
}

export function patchForLight(body, light) {
  if (!light) {
    return null;
  }

  const patch = {};

  if (body.on !== undefined) {
    patch.on = body.on;
  }

  if (body.brightness !== undefined) {
    patch.brightness = body.brightness;
  }

  if (body.preset !== undefined && light.presetCapable) {
    patch.preset = body.preset;
  }

  if (body.color !== undefined && light.colorCapable) {
    patch.color = body.color;
  }

  if (body.ct !== undefined && light.ctCapable) {
    patch.ct = body.ct;
  }

  return Object.keys(patch).length ? patch : null;
}

export function buildLightPatchFromBody(body, current) {
  const patch = {};

  if (body.on !== undefined) {
    patch.on = Boolean(body.on);
  }

  if (body.brightness !== undefined) {
    patch.brightness = body.brightness;
  }

  if (body.color !== undefined) {
    patch.on = true;
    patch.color = body.color;
    patch.colormode = "xy";
  }

  if (body.ct !== undefined && current?.ctRange) {
    const ct = clampCt(body.ct, current.ctRange);
    patch.on = true;
    patch.ct = ct;
    patch.colormode = "ct";
    patch.color = ctToHex(ct);
  }

  if (body.preset !== undefined) {
    const definition = LIGHT_PRESETS[body.preset];
    if (!definition) {
      throw new Error(`Unknown preset: ${body.preset}`);
    }

    patch.on = true;

    if (current?.ctCapable && current?.ctRange) {
      const ct = clampCt(definition.ct, current.ctRange);
      patch.ct = ct;
      patch.colormode = "ct";
      patch.color = ctToHex(ct);
    } else if (current?.colorCapable && current?.colorGamut) {
      let [x, y] = definition.xy;
      [x, y] = clampToGamut(x, y, current.colorGamut);
      const rgb = xyToRgb(x, y, 254);
      patch.colormode = "xy";
      patch.color = rgbToHex(rgb.r, rgb.g, rgb.b);
    }
  }

  return patch;
}

function mapLight(id, raw) {
  const bri = raw.state?.bri;
  const colorCapable = hasColorControl(raw);
  const ctCapable = hasCtControl(raw);
  const colorGamut = colorCapable ? raw.capabilities.control.colorgamut : null;
  const ctRange = ctCapable ? raw.capabilities.control.ct : null;
  const colormode = raw.state?.colormode ?? null;
  const ct = raw.state?.ct ?? null;
  const presetCapable = ctCapable || colorCapable;

  return {
    id,
    name: raw.name ?? `Light ${id}`,
    on: Boolean(raw.state?.on),
    brightness: bri == null ? null : Math.round((bri / 254) * 100),
    reachable: raw.state?.reachable !== false,
    type: raw.type ?? null,
    colorCapable,
    ctCapable,
    presetCapable,
    colormode,
    ct,
    color: presetCapable || colorCapable ? readLightColor(raw) : null,
    colorGamut,
    ctRange,
  };
}

export async function registerHueUser() {
  const { status, data } = await request("/api", {
    method: "POST",
    body: { devicetype: DEVICE_TYPE },
  });

  const error = parseHueErrors(data);
  if (error) {
    throw new Error(error);
  }

  const username = data?.find((entry) => entry.success?.username)?.success?.username;
  if (!username) {
    throw new Error(status === 200 ? "Unexpected Hue link response" : `Hue link failed (${status})`);
  }

  return username;
}

export async function fetchLights() {
  if (!isHueConfigured()) {
    return {
      configured: false,
      bridgeIp: getBridgeIp() || null,
      lights: [],
    };
  }

  const { status, data } = await request(`/api/${getUsername()}/lights`);

  if (status === 401 || status === 403) {
    throw new Error("Hue username is invalid — press the bridge link button and run /api/hue/link");
  }

  if (status !== 200 || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(parseHueErrors(data) ?? `Hue API error (${status})`);
  }

  const lights = Object.entries(data)
    .map(([id, raw]) => mapLight(id, raw))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return {
    configured: true,
    bridgeIp: getBridgeIp(),
    lights,
  };
}

export async function setLightState(id, { on, brightness, color, ct, preset }, { colorGamut, ctRange, ctCapable, colorCapable } = {}) {
  if (!isHueConfigured()) {
    throw new Error("Hue is not configured");
  }

  const body = {};

  if (on !== undefined) {
    body.on = Boolean(on);
  }

  if (brightness !== undefined) {
    body.bri = Math.max(1, Math.min(254, Math.round((brightness / 100) * 254)));
  }

  if (preset !== undefined) {
    const definition = LIGHT_PRESETS[preset];
    if (!definition) {
      throw new Error(`Unknown preset: ${preset}`);
    }

    if (ctCapable && ctRange) {
      body.ct = clampCt(definition.ct, ctRange);
    } else if (colorCapable && colorGamut) {
      let [x, y] = definition.xy;
      [x, y] = clampToGamut(x, y, colorGamut);
      body.xy = [Number(x.toFixed(4)), Number(y.toFixed(4))];
    } else {
      throw new Error("Light does not support white presets");
    }

    body.on = true;
  } else if (ct !== undefined) {
    if (!ctRange) {
      throw new Error("Light does not support color temperature");
    }

    body.ct = clampCt(ct, ctRange);
    body.on = true;
  } else if (color !== undefined) {
    const rgb = hexToRgb(color);
    if (!rgb) {
      throw new Error("Invalid color");
    }

    let [x, y] = rgbToXy(rgb.r, rgb.g, rgb.b);
    [x, y] = clampToGamut(x, y, colorGamut);
    body.xy = [Number(x.toFixed(4)), Number(y.toFixed(4))];
    body.on = true;
  }

  if (!Object.keys(body).length) {
    throw new Error("Nothing to update");
  }

  if (body.ct !== undefined || body.xy !== undefined) {
    body.transitiontime = 0;
  }

  const { status, data } = await request(`/api/${getUsername()}/lights/${encodeURIComponent(id)}/state`, {
    method: "PUT",
    body,
  });

  const error = parseHueErrors(data);
  if (error) {
    throw new Error(error);
  }

  if (status !== 200) {
    throw new Error(`Hue API error (${status})`);
  }

  return body;
}
