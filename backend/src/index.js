import "./load-env.js";
import { initDb } from "./db/index.js";
import { startHue } from "./modules/hue/index.js";
import { startRuuvi } from "./modules/ruuvi/index.js";
import { startSpotify } from "./modules/spotify/index.js";
import { startSystem } from "./modules/system/index.js";
import { startWeather } from "./modules/weather/index.js";
import { startServer } from "./server.js";

console.log("[startup] Initializing database...");
initDb();

console.log("[startup] Starting HTTP server...");
startServer();

console.log("[startup] Starting RuuviTag scanner...");
startRuuvi();

console.log("[startup] Starting weather...");
startWeather();

console.log("[startup] Starting system monitor...");
startSystem();

console.log("[startup] Starting Spotify...");
startSpotify();

console.log("[startup] Starting Hue...");
startHue();

console.log("[startup] Ready");