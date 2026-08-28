import { fetchLights, isHueConfigured } from "./client.js";
import { mergePollLights, setHueError, setHueState } from "./store.js";
const POLL_MS = Number(process.env.HUE_POLL_MS) || 5_000;

async function pollLights() {
  if (!isHueConfigured()) {
    setHueState({
      configured: false,
      bridgeIp: process.env.HUE_BRIDGE_IP?.trim() || null,
      lights: [],
      error: null,
    });
    return;
  }

  try {
    const hue = await fetchLights();
    setHueState({
      ...hue,
      lights: mergePollLights(hue),
      error: null,
    });  } catch (err) {
    setHueError(err.message);
  }
}

export function startHue() {
  if (!isHueConfigured()) {
    console.log("[hue] Not configured — set HUE_BRIDGE_IP and HUE_USERNAME in .env");
    console.log("[hue] Press the bridge link button, then POST /api/hue/link to create a username");
    setHueState({
      configured: false,
      bridgeIp: process.env.HUE_BRIDGE_IP?.trim() || null,
      lights: [],
      error: null,
    });
    return;
  }

  console.log("[hue] Polling lights every %ds", POLL_MS / 1000);
  pollLights();
  setInterval(pollLights, POLL_MS);
}
