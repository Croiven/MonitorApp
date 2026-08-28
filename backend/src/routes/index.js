import { createStaticRoutes, getStaticDir } from "../lib/static.js";
import { healthRoutes } from "./health.js";
import { rootRoutes } from "./root.js";
import { ruuviHistoryRoutes } from "./ruuvi/history.js";
import { ruuviReadingRoutes } from "./ruuvi/readings.js";
import { ruuviTagRoutes } from "./ruuvi/tags.js";
import { systemRoutes } from "./system/index.js";
import { weatherRoutes } from "./weather/index.js";

export const routes = [
  healthRoutes,
  ruuviTagRoutes,
  ruuviReadingRoutes,
  ruuviHistoryRoutes,
  weatherRoutes,
  systemRoutes,
  createStaticRoutes(getStaticDir()),
  rootRoutes,
];
