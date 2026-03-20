/**
 * outputPreset（プレビュー変換の品質・サイズ）に応じたサムネ・MP3・波形のパラメータ。
 * resourceIntensity は ffmpeg-tuning の -threads のみ。OS 優先度は env FFMPEG_OS_PRIORITY。
 */

import { resolveFfmpegOsPriority, resolveFfmpegThreadArgs } from "./ffmpeg-tuning";
import type { ResourceIntensity } from "./resource-intensity";

export type IntensityDerived = {
  thumbnailJpegQ: number;
  mp3BitrateK: number;
  waveformSampleRate: number;
  waveformBarCount: number;
};

/** プレビュー出力のビットレート・解像度寄りの段階（動画エンコーダ側と同じ light|medium|heavy） */
export function deriveOutputPreset(preset: ResourceIntensity): IntensityDerived {
  switch (preset) {
    case "light":
      return {
        thumbnailJpegQ: 6,
        mp3BitrateK: 128,
        waveformSampleRate: 4000,
        waveformBarCount: 120,
      };
    case "heavy":
      return {
        thumbnailJpegQ: 3,
        mp3BitrateK: 192,
        waveformSampleRate: 8000,
        waveformBarCount: 240,
      };
    default:
      return {
        thumbnailJpegQ: 4,
        mp3BitrateK: 192,
        waveformSampleRate: 8000,
        waveformBarCount: 200,
      };
  }
}

/** @deprecated 旧名。deriveOutputPreset と同じ */
export const deriveResourceIntensityBehavior = deriveOutputPreset;

export function describeMediaEncodingBehavior(
  resourceIntensity: ResourceIntensity,
  outputPreset: ResourceIntensity
): {
  thumbnail: string;
  mp3: string;
  waveform: string;
  cpuAndOs: string;
} {
  const d = deriveOutputPreset(outputPreset);
  const t = resolveFfmpegThreadArgs(resourceIntensity);
  const thr = t.length ? `ffmpeg ${t.join(" ")}（デコード・エンコードの並列を抑制）` : "CPU スレッド: 制限なし（占有「高い」）";
  const os = resolveFfmpegOsPriority(resourceIntensity);
  const osLine =
    os === "low"
      ? process.platform === "win32"
        ? "OS 優先度: Idle（start /low 相当。AE 等のレンダリを優先）※失敗時は Below normal にフォールバック"
        : "OS 優先度を下げる（macOS・Linux: nice 10）※他アプリを優先"
      : "OS 優先度: 通常プロセス";

  return {
    thumbnail: `サムネ JPEG q=${d.thumbnailJpegQ}`,
    mp3: `MP3 ${d.mp3BitrateK} kb/s`,
    waveform: `波形 ${d.waveformSampleRate} Hz / ${d.waveformBarCount} バー`,
    cpuAndOs: `${thr}。${osLine}`,
  };
}
