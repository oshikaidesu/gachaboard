import path from "path";
import fs from "fs/promises";
import { ensureLocalFromS3, uploadToS3 } from "@/lib/storage";
import { s3KeyConverted, s3KeyWaveform } from "@/lib/s3";

const BAR_COUNT = 200;

export async function runWavToMp3(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  let tmpSrc: string | null = null;
  const tmpDir = path.join(process.cwd(), "uploads", "tmp");
  const base = storageKey.replace(/\.[^.]+$/, "");
  const tmpDest = path.join(tmpDir, `mp3_${base}.mp3`);
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpSrc!)
        .audioCodec("libmp3lame")
        .audioBitrate(192)
        .save(tmpDest)
        .on("end", () => resolve())
        .on("error", reject);
    });
    await uploadToS3(s3KeyConverted(storageKey, ".mp3"), tmpDest, "audio/mpeg");
  } finally {
    if (tmpSrc) await fs.unlink(tmpSrc).catch(() => {});
    await fs.unlink(tmpDest).catch(() => {});
  }
}

export async function runWaveform(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");
  const { writeFile } = await import("fs/promises");
  let tmpSrc: string | null = null;
  try {
    tmpSrc = await ensureLocalFromS3(storageKey);
    const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      ffmpeg(tmpSrc!)
        .audioChannels(1)
        .audioFrequency(8000)
        .format("s16le")
        .pipe()
        .on("data", (chunk: Buffer) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const samplesPerBar = Math.max(1, Math.floor(sampleCount / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
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
