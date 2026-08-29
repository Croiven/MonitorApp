import { createRequire } from "node:module";
import { getTagName, isTagNamed, registerDiscoveredTag } from "../../db/index.js";
import { updateReading } from "./store.js";

const require = createRequire(import.meta.url);

function attachBleDiagnostics(noble) {
  noble.on("stateChange", (state) => {
    console.log("[ruuvi] BLE adapter state:", state);
    if (state === "poweredOn") {
      ensureScanning(noble);
    }
  });

  noble.on("scanStart", () => {
    console.log("[ruuvi] BLE scan started");
  });

  noble.on("scanStop", () => {
    console.log("[ruuvi] BLE scan stopped");
  });

  noble.on("warning", (message) => {
    console.warn("[ruuvi] BLE warning:", message);
  });

  if (process.env.RUUVI_DEBUG === "true") {
    let discoverCount = 0;
    noble.on("discover", (peripheral) => {
      discoverCount += 1;
      if (discoverCount <= 5 || discoverCount % 25 === 0) {
        console.log(
          `[ruuvi] BLE device #${discoverCount}: ${peripheral.id} (${peripheral.address ?? "no address"})`,
        );
      }
    });
  }

  if (noble.state === "poweredOn") {
    ensureScanning(noble);
  }
}

function ensureScanning(noble) {
  noble.startScanning([], true, (err) => {
    if (err) {
      console.error("[ruuvi] startScanning failed:", err.message);
    }
  });
}

export function startRuuviScanner() {
  let ruuvi;

  try {
    // Load Ruuvi first — its adapter hooks the same @abandonware/noble instance.
    ruuvi = require("node-ruuvitag");
  } catch (err) {
    console.error("[ruuvi] Failed to load node-ruuvitag:", err.message);
    return;
  }

  try {
    const noble = require("@abandonware/noble");
    attachBleDiagnostics(noble);
  } catch (err) {
    console.error("[ruuvi] Failed to attach BLE diagnostics:", err.message);
  }

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
          `${data.humidity.toFixed(2)}%, ${data.pressure} Pa`,
      );
    });
  });

  ruuvi.on("warning", (message) => {
    console.warn("[ruuvi] warning:", message);
  });

  try {
    ruuvi.start();
  } catch (err) {
    console.error("[ruuvi] Failed to start BLE scanner:", err.message);
  }
}
