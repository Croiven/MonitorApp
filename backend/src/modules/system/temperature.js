import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PREFERRED_ZONE_TYPES = [
  "cpu-thermal",
  "x86_pkg_temp",
  "soc-thermal",
  "bcm2835_thermal",
  "acpitz",
  "k10temp",
  "coretemp",
];

function normalizeTemp(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Number(value.toFixed(1));
}

async function readThermalZone(baseDir, zoneName) {
  const zonePath = path.join(baseDir, zoneName);

  try {
    const [typeRaw, tempRaw] = await Promise.all([
      readFile(path.join(zonePath, "type"), "utf8"),
      readFile(path.join(zonePath, "temp"), "utf8"),
    ]);

    const celsius = normalizeTemp(Number(tempRaw.trim()) / 1000);

    if (celsius == null) {
      return null;
    }

    return {
      type: typeRaw.trim(),
      celsius,
    };
  } catch {
    return null;
  }
}

async function getLinuxThermalZones() {
  const baseDir = "/sys/class/thermal";
  const entries = await readdir(baseDir);
  const zones = await Promise.all(
    entries
      .filter((entry) => entry.startsWith("thermal_zone"))
      .map((entry) => readThermalZone(baseDir, entry)),
  );

  return zones.filter(Boolean);
}

function pickThermalZone(zones) {
  if (zones.length === 0) {
    return null;
  }

  for (const preferredType of PREFERRED_ZONE_TYPES) {
    const match = zones.find((zone) => zone.type === preferredType);
    if (match) {
      return match;
    }
  }

  return zones.reduce((hottest, zone) => (
    zone.celsius > hottest.celsius ? zone : hottest
  ));
}

async function getPiTemperature() {
  try {
    const { stdout } = await execFileAsync("vcgencmd", ["measure_temp"], { timeout: 3_000 });
    const match = stdout.match(/temp=([\d.]+)/);

    if (!match) {
      return null;
    }

    return {
      celsius: normalizeTemp(Number(match[1])),
      label: "CPU",
      source: "vcgencmd",
    };
  } catch {
    return null;
  }
}

async function getPiThrottled() {
  try {
    const { stdout } = await execFileAsync("vcgencmd", ["get_throttled"], { timeout: 3_000 });
    const match = stdout.match(/throttled=(0x[0-9a-f]+)/i);

    if (!match) {
      return null;
    }

    return Number.parseInt(match[1], 16) !== 0;
  } catch {
    return null;
  }
}

async function getLinuxTemperature(isRaspberryPi) {
  if (isRaspberryPi) {
    const [piTemp, throttled] = await Promise.all([
      getPiTemperature(),
      getPiThrottled(),
    ]);

    if (piTemp) {
      return {
        ...piTemp,
        throttled,
      };
    }
  }

  try {
    const zones = await getLinuxThermalZones();
    const zone = pickThermalZone(zones);

    if (!zone) {
      return null;
    }

    return {
      celsius: zone.celsius,
      label: zone.type,
      source: "thermal",
      throttled: null,
    };
  } catch {
    return null;
  }
}

async function getWindowsTemperature() {
  const script = [
    "$zone = Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1",
    "if ($zone) {",
    "  [math]::Round(($zone.CurrentTemperature / 10) - 273.15, 1)",
    "}",
  ].join(" ");

  try {
    const { stdout } = await execFileAsync(
      "powershell",
      ["-NoProfile", "-Command", script],
      { timeout: 10_000, windowsHide: true },
    );

    const celsius = normalizeTemp(Number(stdout.trim()));

    if (celsius == null) {
      return null;
    }

    return {
      celsius,
      label: "Thermal zone",
      source: "wmi",
      throttled: null,
    };
  } catch {
    return null;
  }
}

export async function getTemperature(boardName) {
  const isRaspberryPi = boardName?.toLowerCase().includes("raspberry pi") ?? false;

  if (process.platform === "linux") {
    return getLinuxTemperature(isRaspberryPi);
  }

  if (process.platform === "win32") {
    return getWindowsTemperature();
  }

  return null;
}
