import { getPathname, sendJson } from "../../lib/http.js";
import { getAllReadings, getReading } from "../../modules/ruuvi/store.js";

export async function ruuviReadingRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (method !== "GET") {
    return false;
  }

  if (pathname === "/api/readings") {
    sendJson(res, 200, getAllReadings());
    return true;
  }

  const readingMatch = pathname.match(/^\/api\/readings\/([^/]+)$/);
  if (!readingMatch) {
    return false;
  }

  const reading = getReading(decodeURIComponent(readingMatch[1]));
  if (!reading) {
    sendJson(res, 404, { error: "Tag not found" });
    return true;
  }

  sendJson(res, 200, reading);
  return true;
}
