import {
  deleteTagName,
  getAllTags,
  getTag,
  setTagName,
} from "../../db/index.js";
import {
  getPathname,
  readJsonBody,
  sendJson,
  sendNoContent,
} from "../../lib/http.js";
import { removeReading } from "../../modules/ruuvi/store.js";

export async function ruuviTagRoutes(req, res) {
  const pathname = getPathname(req.url ?? "/");
  const method = req.method ?? "GET";

  if (pathname === "/api/tags" && method === "GET") {
    sendJson(res, 200, getAllTags());
    return true;
  }

  const tagMatch = pathname.match(/^\/api\/tags\/([^/]+)$/);
  if (!tagMatch) {
    return false;
  }

  const tagId = decodeURIComponent(tagMatch[1]);

  if (method === "GET") {
    const tag = getTag(tagId);
    if (!tag) {
      sendJson(res, 404, { error: "Tag not found" });
      return true;
    }
    sendJson(res, 200, tag);
    return true;
  }

  if (method === "PUT") {
    const body = await readJsonBody(req);
    if (typeof body.name !== "string") {
      sendJson(res, 400, { error: 'Body must include a "name" string' });
      return true;
    }

    try {
      sendJson(res, 200, setTagName(tagId, body.name));
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return true;
  }

  if (method === "DELETE") {
    if (!deleteTagName(tagId)) {
      sendJson(res, 404, { error: "Tag not found or name not set" });
      return true;
    }
    removeReading(tagId);
    sendNoContent(res);
    return true;
  }

  return false;
}
