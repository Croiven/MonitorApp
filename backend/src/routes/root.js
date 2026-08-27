import { getPathname, sendText } from "../lib/http.js";

export async function rootRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");

  if (pathname !== "/" || req.method !== "GET") {
    return false;
  }

  sendText(res, 200, "MonitorApp is running\n");
  return true;
}
