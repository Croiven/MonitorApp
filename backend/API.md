# MonitorApp Backend API

Base URL: `http://localhost:3000` (default, configurable via `PORT`)

All JSON endpoints return `Content-Type: application/json` unless noted otherwise.

## Overview

The backend scans for RuuviTags over Bluetooth and exposes REST endpoints for tag management and sensor data.

| Behavior | Description |
|----------|-------------|
| Tag discovery | All nearby RuuviTags are saved to the database when first seen |
| Reading tracking | Only **named** tags have live readings logged, stored in memory, and persisted to history |
| History persistence | Latest reading for each named tag is saved to SQLite every 60 seconds |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `DB_PATH` | `data/monitor.db` | SQLite database file path |
| `SAVE_INTERVAL_MS` | `60000` | How often readings are persisted (ms) |

---

## Health

### `GET /health`

Health check.

**Response `200`**

```json
{ "status": "ok" }
```

---

## Tags

Tags represent discovered RuuviTags. Naming a tag starts reading tracking for that tag.

### `GET /api/tags`

List all discovered tags (named and unnamed), ordered by most recently seen.

**Response `200`**

```json
[
  {
    "tagId": "a1b2c3d4e5f6",
    "address": "aa:bb:cc:dd:ee:ff",
    "name": "Living room",
    "firstSeen": "2026-08-27 00:19:12",
    "lastSeen": "2026-08-27 00:19:23",
    "updatedAt": "2026-08-27 00:20:00"
  },
  {
    "tagId": "f6e5d4c3b2a1",
    "address": "11:22:33:44:55:66",
    "name": null,
    "firstSeen": "2026-08-27 00:19:27",
    "lastSeen": "2026-08-27 00:19:27",
    "updatedAt": null
  }
]
```

### `GET /api/tags/:tagId`

Get a single tag by ID.

**Path parameters**

| Name | Description |
|------|-------------|
| `tagId` | RuuviTag BLE peripheral ID |

**Example**

```
GET /api/tags/a1b2c3d4e5f6
```

**Response `200`**

```json
{
  "tagId": "a1b2c3d4e5f6",
  "address": "aa:bb:cc:dd:ee:ff",
  "name": "Living room",
  "firstSeen": "2026-08-27 00:19:12",
  "lastSeen": "2026-08-27 00:19:23",
  "updatedAt": "2026-08-27 00:20:00"
}
```

**Response `404`**

```json
{ "error": "Tag not found" }
```

> **Note:** Use the tag ID in the **path**, not as a query parameter.  
> `/api/tags?tagId=...` is not supported. Use `/api/tags/:tagId` instead.

### `PUT /api/tags/:tagId`

Set or update a tag name. Once named, the tag is tracked for live readings and history.

**Request body**

```json
{
  "name": "Living room"
}
```

**Response `200`** — returns the updated tag object (same shape as `GET /api/tags/:tagId`).

**Response `400`**

```json
{ "error": "Body must include a \"name\" string" }
```

```json
{ "error": "Tag name cannot be empty" }
```

**Example**

```bash
curl -X PUT http://localhost:3000/api/tags/a1b2c3d4e5f6 \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Living room\"}"
```

### `DELETE /api/tags/:tagId`

Remove a tag name. The tag remains in the database as discovered, but reading tracking stops. Historical readings are kept.

**Response `204`** — no body.

**Response `404`**

```json
{ "error": "Tag not found or name not set" }
```

---

## Live readings

In-memory latest readings from **named tags only**.

### `GET /api/readings`

Get the latest reading for each named tag currently in range.

**Response `200`**

```json
[
  {
    "tagId": "a1b2c3d4e5f6",
    "name": "Living room",
    "address": "aa:bb:cc:dd:ee:ff",
    "temperature": 25.01,
    "humidity": 50.46,
    "pressure": 101383,
    "rssi": -65,
    "dataFormat": 5,
    "battery": 3103,
    "accelerationX": 4,
    "accelerationY": 100,
    "accelerationZ": 1032,
    "txPower": -18,
    "movementCounter": 10,
    "measurementSequenceNumber": 12560,
    "mac": "aa:bb:cc:dd:ee:ff",
    "receivedAt": "2026-08-27T00:20:15.123Z"
  }
]
```

Returns an empty array `[]` if no named tags have readings yet.

### `GET /api/readings/:tagId`

Get the latest reading for one named tag.

**Path parameters**

| Name | Description |
|------|-------------|
| `tagId` | RuuviTag BLE peripheral ID |

**Example**

```
GET /api/readings/a1b2c3d4e5f6
```

**Response `200`** — single reading object (same fields as items in `GET /api/readings`).

**Response `404`**

```json
{ "error": "Tag not found" }
```

Returned when the tag is unnamed, not in range, or has no reading in memory.

---

## History

Readings persisted to SQLite (saved every minute for named tags).

### `GET /api/history`

Get historical readings.

**Query parameters**

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `tagId` | No | — | Filter by tag ID |
| `limit` | No | `100` | Max results (1–1000) |

**Examples**

```
GET /api/history
GET /api/history?tagId=a1b2c3d4e5f6
GET /api/history?tagId=a1b2c3d4e5f6&limit=50
GET /api/history?limit=20
```

**Response `200`**

```json
[
  {
    "id": 42,
    "tagId": "a1b2c3d4e5f6",
    "name": "Living room",
    "address": "aa:bb:cc:dd:ee:ff",
    "temperature": 25.01,
    "humidity": 50.46,
    "pressure": 101383,
    "rssi": -65,
    "dataFormat": 5,
    "battery": 3103,
    "accelerationX": 4,
    "accelerationY": 100,
    "accelerationZ": 1032,
    "txPower": -18,
    "movementCounter": 10,
    "measurementSequenceNumber": 12560,
    "mac": "aa:bb:cc:dd:ee:ff",
    "receivedAt": "2026-08-27T00:20:15.123Z",
    "recordedAt": "2026-08-27 00:21:00"
  }
]
```

Results are ordered by `recordedAt` descending (newest first).

When no `tagId` is given, only readings from named tags are returned.

---

## Weather

Current conditions, full hourly forecast, and 2-day outlook from [Open-Meteo](https://open-meteo.com) (no API key).

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_LAT` | — | Latitude (required) |
| `WEATHER_LON` | — | Longitude (required) |
| `WEATHER_LOCATION` | timezone name | Display label for the widget |
| `WEATHER_POLL_MS` | `1800000` | How often the backend refreshes weather (ms) |

### `GET /api/weather`

**Response `200`**

```json
{
  "configured": true,
  "location": "Helsinki",
  "current": {
    "temperature": 15.2,
    "humidity": 65,
    "windSpeed": 12,
    "weatherCode": 3,
    "description": "Overcast"
  },
  "today": {
    "date": "2026-08-28",
    "dayLabel": "Today",
    "tempMin": 10.1,
    "tempMax": 17.8,
    "weatherCode": 3,
    "description": "Overcast",
    "hours": [
      {
        "time": "2026-08-28T14:00",
        "hourLabel": "14:00",
        "temperature": 15.2,
        "weatherCode": 3,
        "description": "Overcast",
        "precipitation": 12
      }
    ]
  },
  "forecast": [
    {
      "date": "2026-08-29",
      "dayLabel": "Fri",
      "tempMin": 10.1,
      "tempMax": 17.8,
      "weatherCode": 61,
      "description": "Light rain",
      "hours": []
    },
    {
      "date": "2026-08-30",
      "dayLabel": "Sat",
      "tempMin": 11.2,
      "tempMax": 18.4,
      "weatherCode": 2,
      "description": "Partly cloudy",
      "hours": []
    }
  ],
  "error": null,
  "updatedAt": "2026-08-28T00:00:00.000Z"
}
```

When not configured, `configured` is `false`.

---

## System

Host status for the machine running the backend (Windows dev PC or Raspberry Pi).

| Variable | Default | Description |
|----------|---------|-------------|
| `SYSTEM_POLL_MS` | `10000` | How often host stats are refreshed (ms) |

### `GET /api/system`

**Response `200`**

```json
{
  "hostname": "raspberrypi",
  "platform": "linux",
  "platformLabel": "Raspberry Pi",
  "boardName": "Raspberry Pi 4 Model B Rev 1.4",
  "uptimeSec": 86400,
  "uptimeLabel": "1d 0h",
  "memory": { "total": 4000000000, "used": 1200000000, "free": 2800000000, "usedPct": 30 },
  "disk": { "path": "/", "total": 32000000000, "used": 14000000000, "free": 18000000000, "usedPct": 44 },
  "cpu": { "cores": 4, "load1": 0.18, "load5": 0.22, "load15": 0.15 },
  "temperature": {
    "celsius": 42.3,
    "label": "CPU",
    "source": "vcgencmd",
    "throttled": false
  },
  "error": null,
  "updatedAt": "2026-08-28T00:00:00.000Z"
}
```

On Windows, CPU load averages are not available (`load1` is `null`). Temperature uses WMI when supported; many desktop PCs report `temperature: null`. On Raspberry Pi, temperature comes from `vcgencmd` with thermal zone fallback, and `throttled` indicates CPU throttling.

---

## Root

### `GET /`

Plain text status message.

**Response `200`** — `text/plain`

```
MonitorApp is running
```

---

## Error responses

| Status | When |
|--------|------|
| `400` | Invalid request body |
| `404` | Unknown route or resource not found |
| `500` | Server error |

**Error body shape**

```json
{ "error": "Description of the error" }
```

---

## Data fields reference

### Tag

| Field | Type | Description |
|-------|------|-------------|
| `tagId` | string | BLE peripheral ID |
| `address` | string \| null | MAC address |
| `name` | string \| null | User-assigned name; `null` if unnamed |
| `firstSeen` | string | When the tag was first discovered (SQLite datetime) |
| `lastSeen` | string | When the tag was last seen (SQLite datetime) |
| `updatedAt` | string \| null | When the name was last updated |

### Reading

| Field | Type | Description |
|-------|------|-------------|
| `tagId` | string | BLE peripheral ID |
| `name` | string \| null | Tag name at query time |
| `address` | string | MAC address |
| `temperature` | number | Celsius |
| `humidity` | number | Relative humidity (%) |
| `pressure` | number | Pascals |
| `rssi` | number | Signal strength (dBm) |
| `dataFormat` | number | Ruuvi data format (`3` or `5`) |
| `battery` | number | Battery voltage (mV) |
| `accelerationX` | number | Acceleration X axis |
| `accelerationY` | number | Acceleration Y axis |
| `accelerationZ` | number | Acceleration Z axis |
| `txPower` | number | TX power (dBm), format 5 only |
| `movementCounter` | number | Movement counter, format 5 only |
| `measurementSequenceNumber` | number | Sequence number, format 5 only |
| `mac` | string | MAC from payload, format 5 only |
| `receivedAt` | string | When the BLE packet was received (ISO 8601) |
| `recordedAt` | string | When saved to database (history only, SQLite datetime) |
| `id` | number | Database row ID (history only) |

---

## Typical workflow

1. Start the backend — nearby RuuviTags appear in `GET /api/tags` with `"name": null`.
2. Name a tag via `PUT /api/tags/:tagId` — reading tracking begins.
3. Poll `GET /api/readings` for live data.
4. Query `GET /api/history` for stored minute-by-minute data.
5. Optionally `DELETE /api/tags/:tagId` to stop tracking while keeping the tag discovered.
