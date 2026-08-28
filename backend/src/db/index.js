import Database from "better-sqlite3";
import { parseStoredDate, toRecordedAtIso } from "../lib/datetime.js";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "monitor.db");

let db;
let insertStmt;
let registerTagStmt;
let upsertTagNameStmt;
let getTagNameStmt;
let isTagNamedStmt;
let getAllTagsStmt;
let getTagStmt;
let clearTagNameStmt;

function rowToTag(row) {
  return {
    tagId: row.tag_id,
    address: row.address ?? null,
    name: row.name ?? null,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    updatedAt: row.updated_at ?? null,
  };
}

function rowToReading(row) {
  return {
    id: row.id,
    tagId: row.tag_id,
    name: row.tag_name ?? null,
    address: row.address,
    temperature: row.temperature,
    humidity: row.humidity,
    pressure: row.pressure,
    rssi: row.rssi,
    dataFormat: row.data_format,
    battery: row.battery,
    accelerationX: row.acceleration_x,
    accelerationY: row.acceleration_y,
    accelerationZ: row.acceleration_z,
    txPower: row.tx_power,
    movementCounter: row.movement_counter,
    measurementSequenceNumber: row.measurement_sequence_number,
    mac: row.mac,
    receivedAt: row.received_at,
    recordedAt: row.recorded_at,
  };
}

function migrateTagsTable() {
  const columns = db.prepare("PRAGMA table_info(tags)").all();
  if (columns.length === 0) {
    return;
  }

  const hasLastSeen = columns.some((column) => column.name === "last_seen");
  if (hasLastSeen) {
    return;
  }

  db.exec(`
    CREATE TABLE tags_new (
      tag_id TEXT PRIMARY KEY,
      address TEXT,
      name TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    INSERT INTO tags_new (tag_id, name, first_seen, last_seen, updated_at)
    SELECT tag_id, name, updated_at, updated_at, updated_at FROM tags;

    DROP TABLE tags;
    ALTER TABLE tags_new RENAME TO tags;
  `);
}

export function initDb() {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id TEXT NOT NULL,
      address TEXT,
      temperature REAL,
      humidity REAL,
      pressure REAL,
      rssi INTEGER,
      data_format INTEGER,
      battery INTEGER,
      acceleration_x REAL,
      acceleration_y REAL,
      acceleration_z REAL,
      tx_power INTEGER,
      movement_counter INTEGER,
      measurement_sequence_number INTEGER,
      mac TEXT,
      received_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_readings_tag_recorded
      ON readings (tag_id, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS tags (
      tag_id TEXT PRIMARY KEY,
      address TEXT,
      name TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );
  `);

  migrateTagsTable();

  insertStmt = db.prepare(`
    INSERT INTO readings (
      tag_id, address, temperature, humidity, pressure, rssi, data_format,
      battery, acceleration_x, acceleration_y, acceleration_z, tx_power,
      movement_counter, measurement_sequence_number, mac, received_at, recorded_at
    ) VALUES (
      @tagId, @address, @temperature, @humidity, @pressure, @rssi, @dataFormat,
      @battery, @accelerationX, @accelerationY, @accelerationZ, @txPower,
      @movementCounter, @measurementSequenceNumber, @mac, @receivedAt, @recordedAt
    )
  `);

  registerTagStmt = db.prepare(`
    INSERT INTO tags (tag_id, address, first_seen, last_seen)
    VALUES (@tagId, @address, datetime('now'), datetime('now'))
    ON CONFLICT(tag_id) DO UPDATE SET
      address = excluded.address,
      last_seen = datetime('now')
  `);

  upsertTagNameStmt = db.prepare(`
    INSERT INTO tags (tag_id, name, first_seen, last_seen, updated_at)
    VALUES (@tagId, @name, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(tag_id) DO UPDATE SET
      name = excluded.name,
      updated_at = datetime('now')
  `);

  getTagNameStmt = db.prepare(`
    SELECT name FROM tags WHERE tag_id = ? AND name IS NOT NULL
  `);

  isTagNamedStmt = db.prepare(`
    SELECT 1 FROM tags WHERE tag_id = ? AND name IS NOT NULL
  `);

  getAllTagsStmt = db.prepare(`
    SELECT tag_id, address, name, first_seen, last_seen, updated_at
    FROM tags
    ORDER BY last_seen DESC
  `);

  clearTagNameStmt = db.prepare(`
    UPDATE tags SET name = NULL, updated_at = datetime('now')
    WHERE tag_id = ? AND name IS NOT NULL
  `);

  getTagStmt = db.prepare(`
    SELECT tag_id, address, name, first_seen, last_seen, updated_at
    FROM tags WHERE tag_id = ?
  `);

  console.log(`Database ready: ${DB_PATH}`);
  return db;
}

export function registerDiscoveredTag(tagId, address) {
  registerTagStmt.run({ tagId, address: address ?? null });
  return getTag(tagId);
}

export function saveReading(reading) {
  insertStmt.run({
    tagId: reading.tagId,
    address: reading.address ?? null,
    temperature: reading.temperature ?? null,
    humidity: reading.humidity ?? null,
    pressure: reading.pressure ?? null,
    rssi: reading.rssi ?? null,
    dataFormat: reading.dataFormat ?? null,
    battery: reading.battery ?? null,
    accelerationX: reading.accelerationX ?? null,
    accelerationY: reading.accelerationY ?? null,
    accelerationZ: reading.accelerationZ ?? null,
    txPower: reading.txPower ?? null,
    movementCounter: reading.movementCounter ?? null,
    measurementSequenceNumber: reading.measurementSequenceNumber ?? null,
    mac: reading.mac ?? null,
    receivedAt: reading.receivedAt,
    recordedAt: reading.recordedAt ?? toRecordedAtIso(),
  });
}

export function saveReadings(readings) {
  const saveAll = db.transaction((items) => {
    for (const reading of items) {
      saveReading(reading);
    }
  });

  saveAll(readings);
}

export function setTagName(tagId, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Tag name cannot be empty");
  }

  upsertTagNameStmt.run({ tagId, name: trimmed });
  return getTag(tagId);
}

export function getTagName(tagId) {
  const row = getTagNameStmt.get(tagId);
  return row?.name ?? null;
}

export function isTagNamed(tagId) {
  return Boolean(isTagNamedStmt.get(tagId));
}

export function getTag(tagId) {
  const row = getTagStmt.get(tagId);
  return row ? rowToTag(row) : null;
}

export function getAllTags() {
  return getAllTagsStmt.all().map(rowToTag);
}

export function deleteTagName(tagId) {
  const result = clearTagNameStmt.run(tagId);
  return result.changes > 0;
}

export function getHistory({ tagId, hours = 24, limit = 1000 } = {}) {
  const safeLimit = Math.min(Math.max(1, limit), 2000);
  const since = Date.now() - hours * 60 * 60 * 1000;

  const rows = tagId
    ? db
        .prepare(
          `SELECT readings.*, tags.name AS tag_name
           FROM readings
           LEFT JOIN tags ON tags.tag_id = readings.tag_id
           WHERE readings.tag_id = ?
           ORDER BY readings.recorded_at DESC
           LIMIT ?`
        )
        .all(tagId, safeLimit)
    : db
        .prepare(
          `SELECT readings.*, tags.name AS tag_name
           FROM readings
           INNER JOIN tags ON tags.tag_id = readings.tag_id AND tags.name IS NOT NULL
           ORDER BY readings.recorded_at DESC
           LIMIT ?`
        )
        .all(safeLimit);

  return rows
    .map(rowToReading)
    .filter((row) => {
      const time = parseStoredDate(row.recordedAt);
      return time && time.getTime() >= since;
    });
}
