import { getPathname, sendJson } from "../lib/http.js";

export async function healthRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");

  if (pathname !== "/health") {
    return false;
  }

  sendJson(res, 200, { status: "ok" });
  return true;
}
