/**
 * バックグラウンドの ffmpeg がマシンリソースをどれだけ使うかの段階（動画・サムネ・音声で共通）。
 * 内部値は light / medium / heavy のまま。
 */

export type ResourceIntensity = "light" | "medium" | "heavy";

export type VideoBackend = "cpu" | "gpu";
