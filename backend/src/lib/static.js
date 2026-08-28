import fs from "node:fs";
import path from "node:path";
import { getPathname } from "./http.js";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

export function getStaticDir() {
  if (process.env.STATIC_DIR) {
    return path.resolve(process.env.STATIC_DIR);
  }

  return path.resolve(process.cwd(), "../frontend/dist");
}

export function createStaticRoutes(staticDir) {
  if (!fs.existsSync(staticDir)) {
    return async () => false;
  }

  console.log(`Serving UI from ${staticDir}`);

  return async (req, res) => {
    const pathname = getPathname(req.url ?? "/");
    const method = req.method ?? "GET";

    if (method !== "GET" && method !== "HEAD") {
      return false;
    }

    if (pathname.startsWith("/api") || pathname === "/health") {
      return false;
    }

    let filePath = path.join(
      staticDir,
      pathname === "/" ? "index.html" : pathname
    );

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(staticDir, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      return false;
    }

    const contentType = MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });

    if (method === "HEAD") {
      res.end();
      return true;
    }

    fs.createReadStream(filePath).pipe(res);
    return true;
  };
}
