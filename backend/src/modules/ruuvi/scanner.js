import { createRequire } from "node:module";
import { getTagName, isTagNamed, registerDiscoveredTag } from "../../db/index.js";
import { updateReading } from "./store.js";

const require = createRequire(import.meta.url);
const ruuvi = require("node-ruuvitag");

export function startRuuviScanner() {
  ruuvi.on("found", (tag) => {
    const discovered = registerDiscoveredTag(tag.id, tag.address);
    const label = discovered.name ?? tag.id;
    console.log(`RuuviTag discovered: ${label} (${tag.address})`);

    tag.on("updated", (data) => {
      if (data instanceof Error) {
        console.warn(`Failed to parse data from ${tag.id}:`, data.message);
        return;
      }

      if (typeof data.temperature !== "number") {
        return;
      }

      if (!isTagNamed(tag.id)) {
        return;
      }

      updateReading(tag.id, {
        address: tag.address,
        ...data,
      });

      const name = getTagName(tag.id) ?? tag.id;

      console.log(
        `RuuviTag ${name}: ${data.temperature.toFixed(2)}°C, ` +
          `${data.humidity.toFixed(2)}%, ${data.pressure} Pa`
      );
    });
  });

  ruuvi.on("warning", (message) => {
    console.warn("BLE warning:", message);
  });

  ruuvi.start();
}
