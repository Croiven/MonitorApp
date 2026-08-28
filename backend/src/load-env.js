import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = dotenv.config({ path: path.join(backendRoot, ".env") });

if (result.error && result.error.code !== "ENOENT") {
  console.warn("[env] Failed to load .env:", result.error.message);
}
