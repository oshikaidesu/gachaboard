/**
 * 動画トランスコード用エンコーダ解決（クロスプラットフォーム）。
 * videoBackend: CPU / GPU（HW 利用可なら）
 * outputPreset: プレビュー品質・ビットレート（light/medium/heavy）
 * resourceIntensity: バックグラウンド占有（applyThreadCap のみ。-threads はここ）
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { resolveFfmpegThreadArgs } from "./ffmpeg-tuning";
import type { ResourceIntensity, VideoBackend } from "./resource-intensity";

const execFileAsync = promisify(execFile);

const SCALE_VF = "scale=-2:min(ih\\,720)";

/** 旧 UI / env 互換用。gpu 強制時に限定 */
export type HwEncoderId = "h264_nvenc" | "h264_qsv" | "h264_amf" | "h264_videotoolbox";

export type ResolvedVideoEncode = {
  videoCodec: string;
  outputOptions: string[];
  summary: string;
};

let cachedEncoderLines: string | null = null;

async function getEncoderListText(): Promise<string> {
  if (cachedEncoderLines !== null) return cachedEncoderLines;
  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-hide_banner", "-encoders"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    });
    cachedEncoderLines = stdout;
  } catch {
    cachedEncoderLines = "";
  }
  return cachedEncoderLines;
}

export function clearFfmpegEncoderCache(): void {
  cachedEncoderLines = null;
}

const ALL_HW: HwEncoderId[] = ["h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox"];

export async function probeAvailableEncoders(): Promise<Set<string>> {
  const text = await getEncoderListText();
  const found = new Set<string>();
  found.add("libx264");
  for (const id of ALL_HW) {
    const re = new RegExp(`\\s${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`);
    if (re.test(text)) found.add(id);
  }
  return found;
}

function autoEncoderOrder(): string[] {
  if (process.platform === "darwin") {
    return ["h264_videotoolbox", "h264_nvenc", "h264_qsv", "h264_amf", "libx264"];
  }
  return ["h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox", "libx264"];
}

function pickFirstAvailable(order: string[], available: Set<string>): string | null {
  for (const id of order) {
    if (available.has(id)) return id;
  }
  return null;
}

function buildLibx264(outputPreset: ResourceIntensity): ResolvedVideoEncode {
  if (outputPreset === "light") {
    return {
      videoCodec: "libx264",
      outputOptions: ["-vf", SCALE_VF, "-crf", "32", "-preset", "ultrafast", "-movflags", "+faststart"],
      summary: `CPU libx264 ultrafast CRF32（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
    };
  }
  if (outputPreset === "heavy") {
    return {
      videoCodec: "libx264",
      outputOptions: ["-vf", SCALE_VF, "-crf", "28", "-preset", "veryfast", "-movflags", "+faststart"],
      summary: `CPU libx264 veryfast CRF28（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
    };
  }
  return {
    videoCodec: "libx264",
    outputOptions: ["-vf", SCALE_VF, "-crf", "30", "-preset", "veryfast", "-movflags", "+faststart"],
    summary: `CPU libx264 veryfast CRF30（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
  };
}

function buildNvenc(outputPreset: ResourceIntensity): ResolvedVideoEncode {
  const preset = outputPreset === "medium" ? "p4" : "p1";
  const cq = outputPreset === "light" ? "30" : outputPreset === "heavy" ? "26" : "28";
  return {
    videoCodec: "h264_nvenc",
    outputOptions: [
      "-vf",
      SCALE_VF,
      "-preset",
      preset,
      "-rc",
      "vbr",
      "-cq",
      cq,
      "-b:v",
      "0",
      "-movflags",
      "+faststart",
    ],
    summary: `GPU h264_nvenc ${preset} CQ${cq}（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
  };
}

function buildQsv(outputPreset: ResourceIntensity): ResolvedVideoEncode {
  const q = outputPreset === "light" ? "32" : outputPreset === "heavy" ? "24" : "28";
  return {
    videoCodec: "h264_qsv",
    outputOptions: ["-vf", SCALE_VF, "-preset", "veryfast", "-global_quality", q, "-movflags", "+faststart"],
    summary: `GPU h264_qsv veryfast gq=${q}（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
  };
}

function buildAmf(outputPreset: ResourceIntensity): ResolvedVideoEncode {
  const qp = outputPreset === "light" ? "32" : outputPreset === "heavy" ? "24" : "28";
  const quality = outputPreset === "heavy" ? "speed" : outputPreset === "light" ? "speed" : "balanced";
  return {
    videoCodec: "h264_amf",
    outputOptions: [
      "-vf",
      SCALE_VF,
      "-quality",
      quality,
      "-rc",
      "cqp",
      "-qp_i",
      qp,
      "-qp_p",
      qp,
      "-qp_b",
      qp,
      "-movflags",
      "+faststart",
    ],
    summary: `GPU h264_amf ${quality} CQP${qp}（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
  };
}

function buildVideotoolbox(outputPreset: ResourceIntensity): ResolvedVideoEncode {
  const br = outputPreset === "light" ? "1.5M" : outputPreset === "heavy" ? "4M" : "2.5M";
  return {
    videoCodec: "h264_videotoolbox",
    outputOptions: ["-vf", SCALE_VF, "-b:v", br, "-maxrate", br, "-bufsize", "8M", "-movflags", "+faststart"],
    summary: `GPU h264_videotoolbox ${br}（プレビュー品質: ${outputQualityJp(outputPreset)}）`,
  };
}

function outputQualityJp(i: ResourceIntensity): string {
  if (i === "light") return "低";
  if (i === "heavy") return "高";
  return "標準";
}

function buildForCodec(codec: string, outputPreset: ResourceIntensity): ResolvedVideoEncode {
  switch (codec) {
    case "h264_nvenc":
      return buildNvenc(outputPreset);
    case "h264_qsv":
      return buildQsv(outputPreset);
    case "h264_amf":
      return buildAmf(outputPreset);
    case "h264_videotoolbox":
      return buildVideotoolbox(outputPreset);
    default:
      return buildLibx264(outputPreset);
  }
}

function applyThreadCap(intensity: ResourceIntensity, r: ResolvedVideoEncode): ResolvedVideoEncode {
  const t = resolveFfmpegThreadArgs(intensity);
  if (!t.length) return r;
  return {
    ...r,
    outputOptions: [...t, ...r.outputOptions],
    summary: `${r.summary} / -threads ${t[1]}`,
  };
}

export type ResolveVideoOptionsInput = {
  videoBackend: VideoBackend;
  /** バックグラウンド占有（-threads のみ付与） */
  resourceIntensity: ResourceIntensity;
  /** プレビュー変換の品質（CRF/CQ 等） */
  outputPreset: ResourceIntensity;
  /** レガシー env 等: 特定 GPU エンコーダを最優先（無ければ CPU） */
  forceHwEncoder?: HwEncoderId;
};

export async function resolveVideoTranscodeOptions(input: ResolveVideoOptionsInput): Promise<ResolvedVideoEncode> {
  const { videoBackend, resourceIntensity, outputPreset, forceHwEncoder } = input;
  const available = await probeAvailableEncoders();

  let resolved: ResolvedVideoEncode;

  if (videoBackend === "cpu") {
    resolved = buildLibx264(outputPreset);
  } else if (forceHwEncoder && available.has(forceHwEncoder)) {
    resolved = buildForCodec(forceHwEncoder, outputPreset);
  } else if (forceHwEncoder && !available.has(forceHwEncoder)) {
    console.warn(`[encoder-strategy] 指定 GPU エンコーダ ${forceHwEncoder} が無いため CPU にフォールバックします`);
    resolved = buildLibx264(outputPreset);
  } else {
    const order = autoEncoderOrder();
    const picked = pickFirstAvailable(order, available);
    if (picked && picked !== "libx264") {
      resolved = buildForCodec(picked, outputPreset);
    } else {
      resolved = buildLibx264(outputPreset);
    }
  }

  return applyThreadCap(resourceIntensity, resolved);
}
