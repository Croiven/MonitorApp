import { startPersistence } from "./persistence.js";
import { startRuuviScanner } from "./scanner.js";

export function startRuuvi() {
  if (process.env.RUUVI_ENABLED === "false") {
    console.log("[ruuvi] Disabled via RUUVI_ENABLED=false");
    return;
  }

  startPersistence();
  startRuuviScanner();
  console.log("Scanning for RuuviTags...");
}
