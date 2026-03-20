import { NextResponse } from "next/server";
import { assertServerOwner } from "@/lib/auth/authz";
import { env } from "@/lib/env";
import { clearFfmpegEncoderCache, probeAvailableEncoders, resolveVideoTranscodeOptions } from "@/lib/ffmpeg/encoder-strategy";
import { describeMediaEncodingBehavior } from "@/lib/ffmpeg/load-preset-behavior";
import { getMergedMediaEncodingEffective } from "@/lib/ffmpeg/media-encoding-prefs";
import {
  envOverridesMediaEncoding,
  mergeMediaEncodingSources,
  normalizeBackend,
  normalizeIntensity,
  normalizeOutputPreset,
  readMediaEncodingFile,
  writeMediaEncodingFile,
  type MediaEncodingStored,
} from "@/lib/server/media-encoding-store";

const DEFAULTS: MediaEncodingStored = {
  videoBackend: "gpu",
  resourceIntensity: "medium",
  outputPreset: "medium",
};

/** GET: 現在のメディア変換設定 */
export async function GET() {
  const owner = await assertServerOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const eff = await getMergedMediaEncodingEffective();
  const available = await probeAvailableEncoders();
  const resolved = await resolveVideoTranscodeOptions({
    videoBackend: eff.videoBackend,
    resourceIntensity: eff.resourceIntensity,
    outputPreset: eff.outputPreset,
    forceHwEncoder: eff.forceHwEncoder,
  });
  const locks = envOverridesMediaEncoding();
  const file = await readMediaEncodingFile();
  const otherFfmpeg = describeMediaEncodingBehavior(eff.resourceIntensity, eff.outputPreset);

  return NextResponse.json({
    stored: file,
    effective: {
      videoBackend: eff.videoBackend,
      resourceIntensity: eff.resourceIntensity,
      outputPreset: eff.outputPreset,
      forceHwEncoder: eff.videoBackend === "gpu" ? eff.forceHwEncoder ?? null : null,
    },
    envLocked: locks,
    availableEncoders: [...available].sort(),
    resolvedSummary: resolved.summary,
    otherFfmpeg,
  });
}

type PatchBody = Partial<Pick<MediaEncodingStored, "videoBackend" | "resourceIntensity" | "outputPreset">>;

/** PATCH: data/media-encoding.json を更新 */
export async function PATCH(req: Request) {
  const owner = await assertServerOwner();
  if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locks = envOverridesMediaEncoding();
  const prev = (await readMediaEncodingFile()) ?? DEFAULTS;
  const effFromEnv = mergeMediaEncodingSources(
    prev,
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

  const next: MediaEncodingStored = {
    videoBackend: locks.videoBackend ? effFromEnv.videoBackend : normalizeBackend(body.videoBackend ?? prev.videoBackend),
    resourceIntensity: locks.resourceIntensity
      ? effFromEnv.resourceIntensity
      : normalizeIntensity(body.resourceIntensity ?? prev.resourceIntensity),
    outputPreset: locks.outputPreset
      ? effFromEnv.outputPreset
      : normalizeOutputPreset(body.outputPreset ?? prev.outputPreset),
  };

  await writeMediaEncodingFile(next);
  clearFfmpegEncoderCache();

  const eff = await getMergedMediaEncodingEffective();
  const resolved = await resolveVideoTranscodeOptions({
    videoBackend: eff.videoBackend,
    resourceIntensity: eff.resourceIntensity,
    outputPreset: eff.outputPreset,
    forceHwEncoder: eff.forceHwEncoder,
  });
  const otherFfmpeg = describeMediaEncodingBehavior(eff.resourceIntensity, eff.outputPreset);
  const available = await probeAvailableEncoders();

  return NextResponse.json({
    stored: next,
    effective: {
      videoBackend: eff.videoBackend,
      resourceIntensity: eff.resourceIntensity,
      outputPreset: eff.outputPreset,
      forceHwEncoder: eff.videoBackend === "gpu" ? eff.forceHwEncoder ?? null : null,
    },
    envLocked: locks,
    availableEncoders: [...available].sort(),
    resolvedSummary: resolved.summary,
    otherFfmpeg,
  });
}
