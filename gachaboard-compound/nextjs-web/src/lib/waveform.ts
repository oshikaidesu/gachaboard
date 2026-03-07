import { getFilePath, getWaveformPath, ensureUploadDirs } from "@/lib/storage";
import { writeFile } from "fs/promises";

/**
 * 音声ファイルから波形データ（JSON）を生成する。
 * 非同期で実行する想定。API ルートやアップロード完了処理から呼び出す。
 */
export async function generateWaveform(storageKey: string): Promise<void> {
  const { default: ffmpeg } = await import("fluent-ffmpeg");

  await ensureUploadDirs();

  const inputPath = getFilePath(storageKey);
  const outputPath = getWaveformPath(storageKey);
  const BAR_COUNT = 200;

  const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(8000)
      .format("s16le")
      .pipe()
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });

  // 16bit signed PCM → Float32 samples
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

  await writeFile(outputPath, JSON.stringify({ peaks }), "utf-8");
}
