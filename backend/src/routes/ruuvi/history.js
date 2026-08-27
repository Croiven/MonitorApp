import { getHistory } from "../../db/index.js";
import { getPathname, parseQuery, sendJson } from "../../lib/http.js";

export async function ruuviHistoryRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");

  if (pathname !== "/api/history" || (req.method ?? "GET") !== "GET") {
    return false;
  }

  const query = parseQuery(req.url ?? "/");
  const tagId = query.get("tagId") ?? undefined;
  const limit = query.get("limit") ? Number(query.get("limit")) : 100;

  sendJson(res, 200, getHistory({ tagId, limit }));
  return true;
}
