import path from "path";
import fs from "fs/promises";
import { ensureLocalFromS3, uploadToS3 } from "@/lib/storage";
import { s3KeyConverted, s3KeyWaveform } from "@/lib/s3";
import { applyFfmpegOsPriorityToCommand, resolveFfmpegThreadArgs } from "./ffmpeg-tuning";
import { deriveOutputPreset } from "./load-preset-behavior";
import { getMergedMediaEncodingEffective } from "./media-encoding-prefs";
import { runWithFfmpegLimit } from "./concurrency";

export async function runWavToMp3(storageKey: string): Promise<void> {
  return runWithFfmpegLimit(() => runWavToMp3Impl(storageKey));
}

async function runWavToMp3Impl(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const eff = await getMergedMediaEncodingEffective();
  const { mp3BitrateK } = deriveOutputPreset(eff.outputPreset);
  let tmpSrc: string | null = null;
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  const base = storageKey.replace(/\.[^.]+$/, "");
  const tmpDest = path.join(tmpDir, `mp3_${base}.mp3`);
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const mp3Cmd = ffmpeg(tmpSrc!)
      .outputOptions(resolveFfmpegThreadArgs(eff.resourceIntensity))
      .audioCodec("libmp3lame")
      .audioBitrate(mp3BitrateK);
    applyFfmpegOsPriorityToCommand(mp3Cmd, eff.resourceIntensity);
    await new Promise<void>((resolve, reject) => {
      mp3Cmd.save(tmpDest).on("end", () => resolve()).on("error", reject);
    });
    await uploadToS3(s3KeyConverted(storageKey, ".mp3"), tmpDest, "audio/mpeg");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
    await fs.unlink(tmpDest).catch(() => {});
  }
}

export async function runWaveform(storageKey: string): Promise<void> {
  return runWithFfmpegLimit(() => runWaveformImpl(storageKey));
}

async function runWaveformImpl(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { writeFile } = await import("fs/promises");
  const eff = await getMergedMediaEncodingEffective();
  const { waveformSampleRate, waveformBarCount } = deriveOutputPreset(eff.outputPreset);
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const wfCmd = ffmpeg(tmpSrc!)
        .outputOptions(resolveFfmpegThreadArgs(eff.resourceIntensity))
        .audioChannels(1)
        .audioFrequency(waveformSampleRate)
        .format("s16le");
      applyFfmpegOsPriorityToCommand(wfCmd, eff.resourceIntensity);
      wfCmd
        .pipe()
        .on("data", (chunk: Buffer) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const samplesPerBar = Math.max(1, Math.floor(sampleCount / waveformBarCount));
    const peaks: number[] = [];
    for (let i = 0; i < waveformBarCount; i++) {
      let max = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, sampleCount);
      for (let j = start; j < end; j++) {
        const sample = Math.abs(pcmBuffer.readInt16LE(j * 2));
        if (sample > max) max = sample;
      }
      peaks.push(max / 32768);
    }
    const tmpJson = path.join(process.cwd(), "uploads", "tmp", `wave_${storageKey.replace(/\.[^.]+$/, "")}.json`);
    await fs.mkdir(path.dirname(tmpJson), { recursive: true });
    await writeFile(tmpJson, JSON.stringify({ peaks }), "utf-8");
    await uploadToS3(s3KeyWaveform(storageKey), tmpJson, "application/json");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
  }
}
