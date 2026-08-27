import { startPersistence } from "./persistence.js";
import { startRuuviScanner } from "./scanner.js";

export function startRuuvi() {
  startPersistence();
  startRuuviScanner();
  console.log("Scanning for RuuviTags...");
}
