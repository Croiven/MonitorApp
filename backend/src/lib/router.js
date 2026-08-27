import { sendJson } from "./http.js";

export function createRouter(handlers) {
  return async (req, res) => {
    try {
      for (const handler of handlers) {
        if (await handler(req, res)) {
          return;
        }
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  };
}
