/**
 * data/media-encoding.json と env をマージ。レガシー env・特定 GPU 強制を反映。
 */

import { env } from "@/lib/env";
import type { HwEncoderId } from "@/lib/ffmpeg/encoder-strategy";
import { mergeMediaEncodingSources, readMediaEncodingFile } from "@/lib/server/media-encoding-store";
import type { MediaEncodingStored } from "@/lib/server/media-encoding-store";

const HW_IDS: HwEncoderId[] = ["h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox"];

export type MediaEncodingEffective = MediaEncodingStored & {
  /** レガシー FFMPEG_MEDIA_ENCODER が HW 指定のときのみ。gpu バックエンドで効く */
  forceHwEncoder?: HwEncoderId;
};

function parseForceHwEncoder(raw: string | undefined): HwEncoderId | undefined {
  const s = raw?.trim();
  if (!s || s === "auto" || s === "libx264") return undefined;
  if ((HW_IDS as string[]).includes(s)) return s as HwEncoderId;
  return undefined;
}

export async function getMergedMediaEncodingEffective(): Promise<MediaEncodingEffective> {
  const file = await readMediaEncodingFile();
  const merged = mergeMediaEncodingSources(
    file,
    {
      videoBackend: env.FFMPEG_VIDEO_BACKEND,
      resourceIntensity: env.FFMPEG_RESOURCE_INTENSITY,
      outputPreset: env.FFMPEG_OUTPUT_PRESET,
    },
    {
      loadPreset: env.FFMPEG_MEDIA_LOAD_PRESET,
      encoder: env.FFMPEG_MEDIA_ENCODER,
    }
  );
  const forceHwEncoder = parseForceHwEncoder(env.FFMPEG_MEDIA_ENCODER);
  return { ...merged, forceHwEncoder };
}
