#!/usr/bin/env node
/**
 * setup:env のエントリポイント（Mac/Windows 両対応）
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === "win32";

const script = isWin
  ? path.join(__dirname, "run-env.ps1")
  : path.join(__dirname, "env.sh");

const result = isWin
  ? spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-NoProfile", "-File", script], {
      stdio: "inherit",
      shell: true,
    })
  : spawnSync("bash", [script], { stdio: "inherit" });

process.exit(result.status ?? 1);
