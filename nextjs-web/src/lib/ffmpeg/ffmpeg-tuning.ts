/**
 * AE 等との共存向け: CPU スレッド上限、OS プロセス優先度（Windows / Unix）。
 * fluent-ffmpeg 経由で起動する ffmpeg に適用する。
 */

import { execFile } from "child_process";
import { env } from "@/lib/env";
import type { ResourceIntensity } from "./resource-intensity";

/** @returns 例: ["-threads", "2"] または []（制限なし） */
export function resolveFfmpegThreadArgs(intensity: ResourceIntensity): string[] {
  const lim = env.FFMPEG_THREAD_LIMIT;
  if (typeof lim === "number" && lim > 0) {
    return ["-threads", String(lim)];
  }
  if (intensity === "light") return ["-threads", "2"];
  if (intensity === "medium") return ["-threads", "4"];
  return [];
}

export type FfmpegOsPriorityMode = "low" | "normal";

/** auto: 負荷「低い」のときだけ OS 上げ下げを緩める */
export function resolveFfmpegOsPriority(intensity: ResourceIntensity): FfmpegOsPriorityMode {
  const p = env.FFMPEG_OS_PRIORITY;
  if (p === "low") return "low";
  if (p === "normal") return "normal";
  return intensity === "light" ? "low" : "normal";
}

/**
 * Windows: ffmpeg プロセスを Idle に（`start /low` と同じ優先度クラス）。
 * ポリシー等で Idle が拒否された場合は Below normal に落とす。
 */
export function setWindowsFfmpegLowPriority(pid: number): void {
  execFile(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `try { $p = Get-Process -Id ${pid} -ErrorAction Stop; try { $p.PriorityClass = 'Idle' } catch { $p.PriorityClass = 'BelowNormal' } } catch { }`,
    ],
    { windowsHide: true },
    () => {}
  );
}

/** fluent-ffmpeg の FfmpegCommand（公式型とイベント名が一致しないため緩く受ける） */
type FfmpegLikeCommand = {
  renice: (n: number) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: any;
};

/**
 * 占有「低い」等で OS 優先度を下げる。
 * - Unix: nice 経由（fluent-ffmpeg 組み込み）
 * - Windows: 起動直後に Idle（start /low 相当）、失敗時は Below normal
 */
export function applyFfmpegOsPriorityToCommand(cmd: FfmpegLikeCommand, intensity: ResourceIntensity): void {
  if (resolveFfmpegOsPriority(intensity) !== "low") return;

  if (process.platform === "win32") {
    cmd.on("start", () => {
      const proc = (cmd as unknown as { ffmpegProc?: { pid?: number } }).ffmpegProc;
      const pid = proc?.pid;
      if (pid) setWindowsFfmpegLowPriority(pid);
    });
    return;
  }

  cmd.renice(10);
}
