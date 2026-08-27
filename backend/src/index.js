import { initDb } from "./db/index.js";
import { startRuuvi } from "./modules/ruuvi/index.js";
import { startServer } from "./server.js";

initDb();
startServer();
startRuuvi();
