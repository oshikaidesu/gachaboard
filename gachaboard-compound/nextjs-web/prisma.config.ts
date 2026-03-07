import { defineConfig } from "prisma/config";
import * as fs from "fs";
import * as path from "path";
import * as urlModule from "url";

const __filename = urlModule.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readEnvLocal(): Record<string, string> {
  const envPath = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

const localEnv = readEnvLocal();
const dbUrl = process.env["DATABASE_URL"] ?? localEnv["DATABASE_URL"] ?? "";

export default defineConfig({
  datasource: {
    url: dbUrl,
  },
});
