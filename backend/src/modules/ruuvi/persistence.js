import { saveReadings } from "../../db/index.js";
import { getAllReadings } from "./store.js";

const SAVE_INTERVAL_MS = Number(process.env.SAVE_INTERVAL_MS ?? 60_000);

export function startPersistence() {
  setInterval(() => {
    const readings = getAllReadings();
    if (readings.length === 0) {
      return;
    }

    saveReadings(readings);
    console.log(`Saved ${readings.length} RuuviTag reading(s) to database`);
  }, SAVE_INTERVAL_MS);
}
