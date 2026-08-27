import { getTagName } from "../../db/index.js";

const readings = new Map();

function withName(reading) {
  return {
    ...reading,
    name: getTagName(reading.tagId),
  };
}

export function updateReading(tagId, data) {
  readings.set(tagId, {
    ...data,
    tagId,
    receivedAt: new Date().toISOString(),
  });
}

export function removeReading(tagId) {
  readings.delete(tagId);
}

export function getReading(tagId) {
  const reading = readings.get(tagId);
  return reading ? withName(reading) : null;
}

export function getAllReadings() {
  return [...readings.values()].map(withName);
}
