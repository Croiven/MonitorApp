import { createStaticRoutes, getStaticDir } from "../lib/static.js";
import { healthRoutes } from "./health.js";
import { rootRoutes } from "./root.js";
import { ruuviHistoryRoutes } from "./ruuvi/history.js";
import { ruuviReadingRoutes } from "./ruuvi/readings.js";
import { ruuviTagRoutes } from "./ruuvi/tags.js";

export const routes = [
  healthRoutes,
  ruuviTagRoutes,
  ruuviReadingRoutes,
  ruuviHistoryRoutes,
  createStaticRoutes(getStaticDir()),
  rootRoutes,
];
