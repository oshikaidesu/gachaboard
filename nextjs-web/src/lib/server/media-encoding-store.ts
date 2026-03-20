/**
 * メディア変換設定の永続化（サーバーローカル JSON）。
 * 3 軸: videoBackend, resourceIntensity（CPU 並列・-threads）, outputPreset（プレビュー変換の品質・サイズ）。
 * 旧形式（1 つの負荷つまみのみ）は読み込み時に両方へ複製。
 */

import fs from "fs/promises";
import path from "path";
import type { ResourceIntensity, VideoBackend } from "@/lib/ffmpeg/resource-intensity";

export type MediaEncodingStored = {
  videoBackend: VideoBackend;
  resourceIntensity: ResourceIntensity;
  outputPreset: ResourceIntensity;
};

const DEFAULTS: MediaEncodingStored = {
  videoBackend: "gpu",
  resourceIntensity: "medium",
  outputPreset: "medium",
};

type LegacyOnDisk = {
  loadPreset?: string;
  encoder?: string;
  videoBackend?: string;
  resourceIntensity?: string;
  outputPreset?: string;
};

function prefsPath(): string {
  return path.join(process.cwd(), "data", "media-encoding.json");
}

function migratedFromParsed(o: LegacyOnDisk): MediaEncodingStored {
  if (o.videoBackend === "cpu" || o.videoBackend === "gpu") {
    const ri = normalizeIntensity(o.resourceIntensity);
    const op = normalizeOutputPreset(o.outputPreset ?? o.resourceIntensity ?? ri);
    return {
      videoBackend: normalizeBackend(o.videoBackend),
      resourceIntensity: ri,
      outputPreset: op,
    };
  }
  const lp =
    o.loadPreset === "gentle" || o.loadPreset === "balanced" || o.loadPreset === "speed"
      ? o.loadPreset
      : "balanced";
  const intensity: ResourceIntensity =
    lp === "gentle" ? "light" : lp === "speed" ? "heavy" : "medium";
  const enc = o.encoder;
  const backend: VideoBackend = enc === "libx264" || lp === "gentle" ? "cpu" : "gpu";
  return { videoBackend: backend, resourceIntensity: intensity, outputPreset: intensity };
}

export async function readMediaEncodingFile(): Promise<MediaEncodingStored | null> {
  try {
    const raw = await fs.readFile(prefsPath(), "utf8");
    const j = JSON.parse(raw) as LegacyOnDisk;
    if (!j || typeof j !== "object") return null;
    return migratedFromParsed(j);
  } catch {
    return null;
  }
}

export async function writeMediaEncodingFile(prefs: MediaEncodingStored): Promise<void> {
  const dir = path.dirname(prefsPath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

export function normalizeBackend(v: unknown): VideoBackend {
  if (v === "cpu" || v === "gpu") return v;
  return DEFAULTS.videoBackend;
}

export function normalizeIntensity(v: unknown): ResourceIntensity {
  if (v === "light" || v === "medium" || v === "heavy") return v;
  return DEFAULTS.resourceIntensity;
}

export function normalizeOutputPreset(v: unknown): ResourceIntensity {
  if (v === "light" || v === "medium" || v === "heavy") return v;
  return DEFAULTS.outputPreset;
}

type LegacyEnv = {
  loadPreset?: "gentle" | "balanced" | "speed";
  encoder?: string;
};

function fromLegacyEnv(legacy: LegacyEnv): MediaEncodingStored | null {
  const { loadPreset, encoder } = legacy;
  if (!loadPreset && !encoder) return null;
  const lp = loadPreset ?? "balanced";
  const intensity: ResourceIntensity =
    lp === "gentle" ? "light" : lp === "speed" ? "heavy" : "medium";
  const enc = encoder?.trim();
  const backend: VideoBackend = enc === "libx264" || lp === "gentle" ? "cpu" : "gpu";
  return { videoBackend: backend, resourceIntensity: intensity, outputPreset: intensity };
}

/**
 * 優先度: 新 env → レガシー env → ファイル（なければ既定）。
 */
export function mergeMediaEncodingSources(
  file: MediaEncodingStored | null,
  envNew: Partial<{
    videoBackend: VideoBackend;
    resourceIntensity: ResourceIntensity;
    outputPreset: ResourceIntensity;
  }>,
  envLegacy: LegacyEnv
): MediaEncodingStored {
  const base = file ?? DEFAULTS;
  const leg = fromLegacyEnv(envLegacy);

  return {
    videoBackend: envNew.videoBackend ?? leg?.videoBackend ?? base.videoBackend,
    resourceIntensity: envNew.resourceIntensity ?? leg?.resourceIntensity ?? base.resourceIntensity,
    outputPreset: envNew.outputPreset ?? leg?.outputPreset ?? base.outputPreset,
  };
}

/** env がファイルより優先される項目 */
export function envOverridesMediaEncoding(): {
  videoBackend: boolean;
  resourceIntensity: boolean;
  outputPreset: boolean;
} {
  const nb = !!process.env.FFMPEG_VIDEO_BACKEND?.trim();
  const ni = !!process.env.FFMPEG_RESOURCE_INTENSITY?.trim();
  const no = !!process.env.FFMPEG_OUTPUT_PRESET?.trim();
  const lb = !!process.env.FFMPEG_MEDIA_ENCODER?.trim();
  const li = !!process.env.FFMPEG_MEDIA_LOAD_PRESET?.trim();
  return {
    videoBackend: nb || lb,
    resourceIntensity: ni || li,
    outputPreset: no || li,
  };
}
