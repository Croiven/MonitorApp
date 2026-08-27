import http from "node:http";
import { createRouter } from "./lib/router.js";
import { routes } from "./routes/index.js";

const PORT = process.env.PORT ?? 3000;

export function startServer() {
  const server = http.createServer(createRouter(routes));

  server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  return server;
}
