import { saveReadings } from "../../db/index.js";
import {
  msUntilNextInterval,
  toRecordedAtIso,
} from "../../lib/datetime.js";
import { getAllReadings } from "./store.js";

function saveSnapshot() {
  const readings = getAllReadings();
  if (readings.length === 0) {
    return;
  }

  const recordedAt = toRecordedAtIso();
  saveReadings(readings.map((reading) => ({ ...reading, recordedAt })));
  console.log(`Saved ${readings.length} RuuviTag reading(s) at ${recordedAt}`);
}

export function startPersistence() {
  const scheduleNext = () => {
    setTimeout(() => {
      saveSnapshot();
      scheduleNext();
    }, msUntilNextInterval());
  };

  scheduleNext();
}
