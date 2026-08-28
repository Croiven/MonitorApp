import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { getTemperature } from "./temperature.js";

const execFileAsync = promisify(execFile);

function roundPct(used, total) {
  if (!total) {
    return 0;
  }

  return Math.round((used / total) * 100);
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function getMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  return {
    total,
    used,
    free,
    usedPct: roundPct(used, total),
  };
}

function getCpu() {
  const [load1, load5, load15] = os.loadavg();
  const cores = os.cpus().length;

  return {
    cores,
    load1: load1 > 0 ? Number(load1.toFixed(2)) : null,
    load5: load5 > 0 ? Number(load5.toFixed(2)) : null,
    load15: load15 > 0 ? Number(load15.toFixed(2)) : null,
  };
}

async function getLinuxDisk() {
  const { stdout } = await execFileAsync("df", ["-P", "-B1", "/"], { timeout: 5_000 });
  const line = stdout.trim().split("\n").at(-1);

  if (!line) {
    return null;
  }

  const parts = line.split(/\s+/);
  const total = Number(parts[1]);
  const used = Number(parts[2]);
  const free = Number(parts[3]);

  return {
    path: "/",
    total,
    used,
    free,
    usedPct: roundPct(used, total),
  };
}

async function getWindowsDisk() {
  const script = [
    "$disk = Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"",
    "if (-not $disk) { exit 1 }",
    "$used = [int64]$disk.Size - [int64]$disk.FreeSpace",
    "Write-Output ($disk.Size.ToString() + ' ' + $used.ToString() + ' ' + $disk.FreeSpace.ToString())",
  ].join("; ");

  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-Command", script],
    { timeout: 10_000, windowsHide: true },
  );

  const [total, used, free] = stdout.trim().split(/\s+/).map(Number);

  if (!total) {
    return null;
  }

  return {
    path: "C:",
    total,
    used,
    free,
    usedPct: roundPct(used, total),
  };
}

async function getDisk() {
  try {
    if (process.platform === "win32") {
      return await getWindowsDisk();
    }

    if (process.platform === "linux") {
      return await getLinuxDisk();
    }
  } catch {
    return null;
  }

  return null;
}

async function getBoardName() {
  if (process.platform !== "linux") {
    return null;
  }

  try {
    const raw = await readFile("/proc/device-tree/model", "utf8");
    return raw.replace(/\0/g, "").trim();
  } catch {
    return null;
  }
}

function getPlatformLabel(platform, boardName) {
  if (platform === "win32") {
    return "Windows";
  }

  if (boardName?.toLowerCase().includes("raspberry pi")) {
    return "Raspberry Pi";
  }

  if (platform === "linux") {
    return "Linux";
  }

  return platform;
}

export async function collectSystemStatus() {
  const platform = process.platform;
  const boardName = await getBoardName();
  const [disk, temperature] = await Promise.all([
    getDisk(),
    getTemperature(boardName),
  ]);

  const uptimeSec = os.uptime();

  return {
    hostname: os.hostname(),
    platform,
    platformLabel: getPlatformLabel(platform, boardName),
    boardName,
    uptimeSec,
    uptimeLabel: formatUptime(uptimeSec),
    memory: getMemory(),
    disk,
    cpu: getCpu(),
    temperature,
    updatedAt: new Date().toISOString(),
  };
}
