import { getPathname, sendJson } from "../../lib/http.js";
import { getSystemStatus } from "../../modules/system/store.js";

export async function systemRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (pathname === "/api/system" && method === "GET") {
    sendJson(res, 200, getSystemStatus());
    return true;
  }

  return false;
}
