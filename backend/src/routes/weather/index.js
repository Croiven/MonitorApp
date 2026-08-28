import { getPathname, sendJson } from "../../lib/http.js";
import { getWeather } from "../../modules/weather/store.js";

export async function weatherRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (pathname === "/api/weather" && method === "GET") {
    sendJson(res, 200, getWeather());
    return true;
  }

  return false;
}
