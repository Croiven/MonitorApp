import "./load-env.js";
import { initDb } from "./db/index.js";
import { startRuuvi } from "./modules/ruuvi/index.js";
import { startSystem } from "./modules/system/index.js";
import { startWeather } from "./modules/weather/index.js";
import { startServer } from "./server.js";

initDb();
startServer();
startRuuvi();
startWeather();
startSystem();
