import {
  getPathname,
  readJsonBody,
  sendHtml,
  sendJson,
} from "../../lib/http.js";
import {
  buildLightPatchFromBody,
  fetchLights,
  hasHueBridgeIp,
  isHueConfigured,
  patchForLight,
  registerHueUser,
  setLightState,
} from "../../modules/hue/client.js";
import { getHueState, setHueState, updateLight } from "../../modules/hue/store.js";

function publicHueState() {
  const hue = getHueState();
  return {
    ...hue,
    lights: hue.lights.map(({ colorGamut, ctRange, controlledAt, ...light }) => light),
  };
}

export async function hueRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (pathname === "/api/hue/lights" && method === "GET") {
    sendJson(res, 200, publicHueState());
    return true;
  }

  if (pathname === "/api/hue/lights" && method === "PUT") {
    try {
      const body = await readJsonBody(req);
      const lights = getHueState().lights;
      const errors = [];

      await Promise.all(
        lights.map(async (light) => {
          const patch = patchForLight(body, light);
          if (!patch) {
            return;
          }

          try {
            await setLightState(light.id, patch, {
              colorGamut: light.colorGamut,
              ctRange: light.ctRange,
              ctCapable: light.ctCapable,
              colorCapable: light.colorCapable,
            });
            updateLight(light.id, {
              ...buildLightPatchFromBody(patch, light),
              reachable: true,
            });
          } catch (err) {
            errors.push({ id: light.id, name: light.name, error: err.message });
          }
        }),
      );

      if (errors.length && errors.length === lights.length) {
        sendJson(res, 502, { error: errors[0].error, errors });
        return true;
      }

      sendJson(res, 200, {
        ...publicHueState(),
        errors: errors.length ? errors : undefined,
      });
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }

    return true;
  }

  if (pathname === "/api/hue/setup" && method === "GET") {
    sendJson(res, 200, {
      configured: isHueConfigured(),
      bridgeIp: process.env.HUE_BRIDGE_IP?.trim() || null,
      hasBridgeIp: hasHueBridgeIp(),
      hasUsername: Boolean(process.env.HUE_USERNAME?.trim()),
      linkPath: "/api/hue/link",
      hint: "Set HUE_BRIDGE_IP in backend/.env, press the bridge link button, then link the bridge to obtain a username.",
    });
    return true;
  }

  if (pathname === "/api/hue/link" && (method === "POST" || method === "GET")) {
    if (!hasHueBridgeIp()) {
      sendJson(res, 503, { error: "Set HUE_BRIDGE_IP first" });
      return true;
    }

    try {
      const username = await registerHueUser();
      sendHtml(
        res,
        200,
        `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hue connected</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; padding: 2rem; max-width: 720px; margin: 0 auto; }
    code, pre { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; display: block; overflow-x: auto; }
    h1 { color: #ffb900; }
  </style>
</head>
<body>
  <h1>Hue bridge linked</h1>
  <p>Add this username to <code>backend/.env</code>, then restart the backend:</p>
  <pre>HUE_USERNAME=${username}</pre>
  <p>You can close this page.</p>
</body>
</html>`,
      );
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }

    return true;
  }

  const lightMatch = pathname.match(/^\/api\/hue\/lights\/([^/]+)$/);
  if (lightMatch && method === "PUT") {
    const lightId = decodeURIComponent(lightMatch[1]);

    try {
      const body = await readJsonBody(req);
      const current = getHueState().lights.find((light) => light.id === lightId);
      await setLightState(lightId, body, {
        colorGamut: current?.colorGamut,
        ctRange: current?.ctRange,
        ctCapable: current?.ctCapable,
        colorCapable: current?.colorCapable,
      });

      if (current) {
        updateLight(lightId, {
          ...buildLightPatchFromBody(body, current),
          reachable: true,
        });
      } else {
        const hue = await fetchLights();
        setHueState({ ...hue, error: null });
      }

      sendJson(res, 200, publicHueState());
    } catch (err) {
      sendJson(res, 502, { error: err.message });
    }

    return true;
  }

  return false;
}
