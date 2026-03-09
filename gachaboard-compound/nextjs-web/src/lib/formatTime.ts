import { intervalToDuration } from "date-fns";

/** 秒数を "M:SS" 形式にフォーマット（M は総分数） */
export function formatTime(sec: number): string {
  const d = intervalToDuration({ start: 0, end: sec * 1000 });
  const totalMinutes = (d.hours ?? 0) * 60 + (d.minutes ?? 0);
  const s = String(d.seconds ?? 0).padStart(2, "0");
  return `${totalMinutes}:${s}`;
}
