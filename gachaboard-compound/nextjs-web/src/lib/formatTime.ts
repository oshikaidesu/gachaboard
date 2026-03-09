import { intervalToDuration } from "date-fns";

/** 秒数を "M:SS" 形式にフォーマット（M は総分数） */
export function formatTime(sec: number): string {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) {
    return "0:00";
  }
  const d = intervalToDuration({ start: 0, end: Math.floor(sec) * 1000 });
  const totalMinutes = (d.hours ?? 0) * 60 + (d.minutes ?? 0);
  const s = String(d.seconds ?? 0).padStart(2, "0");
  return `${totalMinutes}:${s}`;
}
