import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads", "assets");
export const CONVERTED_DIR = process.env.CONVERTED_DIR ?? path.join(process.cwd(), "uploads", "converted");

export async function ensureUploadDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(CONVERTED_DIR, { recursive: true });
}

export async function deleteFile(storageKey: string) {
  const filePath = path.join(UPLOAD_DIR, storageKey);
  const convertedPath = path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp3"));
  if (existsSync(filePath)) await fs.unlink(filePath);
  if (existsSync(convertedPath)) await fs.unlink(convertedPath);
}

export function getFilePath(storageKey: string) {
  return path.join(UPLOAD_DIR, storageKey);
}

export function getConvertedPath(storageKey: string) {
  return path.join(CONVERTED_DIR, storageKey.replace(/\.[^.]+$/, ".mp3"));
}
