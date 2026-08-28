import { collectSystemStatus } from "./collect.js";
import { setSystemError, setSystemStatus } from "./store.js";

const POLL_MS = Number(process.env.SYSTEM_POLL_MS) || 10_000;

async function pollSystem() {
  try {
    const status = await collectSystemStatus();
    setSystemStatus({
      ...status,
      error: null,
    });
  } catch (err) {
    setSystemError(err.message);
  }
}

export function startSystem() {
  console.log("[system] Polling host status every %ds", POLL_MS / 1000);
  pollSystem();
  setInterval(pollSystem, POLL_MS);
}
