#!/usr/bin/env node
/**
 * プロジェクトルートの .env を nextjs-web/.env.local へのシンボリックリンクに作成
 * Mac / Windows 両対応（Node.js の fs.symlinkSync を使用）
 *
 * Windows: 管理者権限または開発者モードが必要な場合あり
 *  設定 > 更新とセキュリティ > 開発者向け > 開発者モード
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const envLocal = path.join(rootDir, "nextjs-web", ".env.local");
const envRoot = path.join(rootDir, ".env");

// 正本が存在するか確認
if (!fs.existsSync(envLocal)) {
  console.error("Error: nextjs-web/.env.local が存在しません。先に setup:env の 1〜2 ステップを実行してください。");
  process.exit(1);
}

// 既存の .env を削除（シンボリックリンク含む）
if (fs.existsSync(envRoot)) {
  try {
    fs.unlinkSync(envRoot);
  } catch (err) {
    console.error("Error: 既存の .env を削除できません:", err.message);
    process.exit(1);
  }
}

// 相対パスでシンボリックリンク作成（移植性のため）
const target = path.relative(path.dirname(envRoot), envLocal);

try {
  fs.symlinkSync(target, envRoot, "file");
  console.log(">>> プロジェクトルートの .env を nextjs-web/.env.local へのシンボリックリンクにしました");
} catch (err) {
  if (process.platform === "win32") {
    console.error("");
    console.error("Windows でシンボリックリンク作成に失敗しました。");
    console.error("以下のいずれかを試してください:");
    console.error("  1. 管理者として PowerShell を起動して再実行");
    console.error("  2. 設定 > 開発者向け > 開発者モード を有効化");
    console.error("");
    console.error("代替: 手動で .env を作成し、nextjs-web/.env.local の内容をコピーしてください。");
  }
  console.error("Error:", err.message);
  process.exit(1);
}
