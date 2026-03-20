"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";

type ApiResponse = {
  stored: { videoBackend: string; resourceIntensity: string; outputPreset: string } | null;
  effective: {
    videoBackend: string;
    resourceIntensity: string;
    outputPreset: string;
    forceHwEncoder: string | null;
  };
  envLocked: { videoBackend: boolean; resourceIntensity: boolean; outputPreset: boolean };
  availableEncoders: string[];
  resolvedSummary: string;
  otherFfmpeg?: { thumbnail: string; mp3: string; waveform: string; cpuAndOs: string };
};

const BACKEND_OPTIONS = [
  {
    value: "cpu",
    label: "CPU",
    hint: "動画は常に libx264（ソフトウェア）。GPU/VRAM を使いません",
  },
  {
    value: "gpu",
    label: "GPU（利用可なら）",
    hint: "利用可能な HW エンコーダを自動選択。VRAM の共有で他アプリと干渉しうる",
  },
] as const;

const OCCUPANCY_OPTIONS = [
  {
    value: "light",
    label: "低い",
    hint: "裏処理の並列・優先度を抑え、他アプリを優先",
  },
  {
    value: "medium",
    label: "標準",
    hint: "普段使いのバランス",
  },
  {
    value: "heavy",
    label: "高い",
    hint: "ffmpeg に CPU スレッド制限なし・通常優先度（変換は速くなりやすい）",
  },
] as const;

const OUTPUT_PRESET_OPTIONS = [
  {
    value: "light",
    label: "低い",
    hint: "プレビュー向け・ファイルサイズ小さめ",
  },
  {
    value: "medium",
    label: "標準",
    hint: "従来のトランスコードに近いバランス",
  },
  {
    value: "heavy",
    label: "高い",
    hint: "サムネ・ビットレート・波形の解像度を上げる",
  },
] as const;

export default function MediaEncodingClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoBackend, setVideoBackend] = useState<string>("gpu");
  const [resourceIntensity, setResourceIntensity] = useState<string>("medium");
  const [outputPreset, setOutputPreset] = useState<string>("medium");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/server/media-encoding");
    if (!res.ok) {
      setError(res.status === 401 ? "ログインが必要です" : "読み込みに失敗しました");
      return;
    }
    const j = (await res.json()) as ApiResponse;
    setData(j);
    setVideoBackend(j.effective.videoBackend);
    setResourceIntensity(j.effective.resourceIntensity);
    setOutputPreset(j.effective.outputPreset);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/server/media-encoding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBackend, resourceIntensity, outputPreset }),
    });
    if (!res.ok) {
      setError("保存に失敗しました");
      setSaving(false);
      return;
    }
    const j = (await res.json()) as ApiResponse;
    setData(j);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-[#1e2226] dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-[#25292e]">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <Link
              href="/workspaces"
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-slate-400 dark:hover:text-white"
            >
              ← ワークスペース
            </Link>
            <h1 className="mt-2 text-2xl font-semibold">メディア変換（ffmpeg）</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-slate-400">
              <strong>バックグラウンド占有</strong>（他アプリとの譲り合い）と<strong>プレビュー変換の品質・サイズ</strong>は別項目です。どちらも既定は
              <strong>標準</strong>です。
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/30 dark:text-sky-100">
          <p className="font-medium text-sky-900 dark:text-sky-50">占有（左の項目）で効くこと</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sky-900/90 dark:text-sky-100/90">
            <li>
              <strong>CPU スレッド</strong> — 「低い／標準」では{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-black/30">-threads 2</code> や{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-black/30">4</code>。「高い」は制限なし。{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-black/30">FFMPEG_THREAD_LIMIT</code> で上書き可。
            </li>
            <li>
              <strong>OS 優先度</strong> — 「低い」では Windows は{" "}
              <strong>Idle</strong>（<code className="rounded bg-white/70 px-1 dark:bg-black/30">start /low</code> 相当。AE
              などが動いているとき ffmpeg が譲りやすい）、Unix は nice 10。{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-black/30">FFMPEG_OS_PRIORITY</code> で常時指定も可能。
            </li>
            <li>
              変換の<strong>同時実行数</strong>は{" "}
              <code className="rounded bg-white/70 px-1 dark:bg-black/30">FFMPEG_MAX_CONCURRENT</code>（既定 10）。
            </li>
          </ul>
          <p className="mt-3 font-medium text-sky-900 dark:text-sky-50">品質（右の項目）で効くこと</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sky-900/90 dark:text-sky-100/90">
            <li>
              動画ライト MP4 の <strong>CRF / CQ・ビットレート</strong>、NVENC の <strong>p1 / p4</strong> プリセット（例: 標準 → p4）。
            </li>
            <li>
              サムネ JPEG の q、MP3 ビットレート、波形のサンプルレート／バー数。
            </li>
          </ul>
        </div>

        {data && (
          <div className="mb-6 space-y-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-slate-600 dark:bg-[#25292e]">
              <p className="font-medium text-zinc-800 dark:text-white">動画（ライト MP4）— 現在の解決結果</p>
              <p className="mt-1 text-zinc-600 dark:text-slate-300">{data.resolvedSummary}</p>
              {data.effective.forceHwEncoder && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  環境変数で GPU エンコーダ固定: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">{data.effective.forceHwEncoder}</code>
                </p>
              )}
              <p className="mt-3 text-xs text-zinc-500 dark:text-slate-400">
                ffmpeg が認識しているエンコーダ:{" "}
                {data.availableEncoders.length ? data.availableEncoders.join(", ") : "（検出できず）"}
              </p>
            </div>
            {data.otherFfmpeg && (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-slate-600 dark:bg-[#25292e]">
                <p className="font-medium text-zinc-800 dark:text-white">プレビュー品質（サムネ・MP3・波形）</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-600 dark:text-slate-300">
                  <li>{data.otherFfmpeg.thumbnail}</li>
                  <li>{data.otherFfmpeg.mp3}</li>
                  <li>{data.otherFfmpeg.waveform}</li>
                </ul>
                <p className="mt-3 font-medium text-zinc-800 dark:text-white">バックグラウンド占有（スレッド・OS）</p>
                <p className="mt-1 text-zinc-600 dark:text-slate-300">{data.otherFfmpeg.cpuAndOs}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-slate-600 dark:bg-[#25292e]">
          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-white">動画エンコード</label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-slate-400">CPU か GPU（ハードウェア）か。GPU は空いているエンコーダを順に試します。</p>
            <select
              value={videoBackend}
              disabled={data?.envLocked.videoBackend}
              onChange={(e) => setVideoBackend(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-[#1e2226] dark:text-white disabled:opacity-50"
            >
              {BACKEND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
            {data?.envLocked.videoBackend && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                環境変数（<code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_VIDEO_BACKEND</code> または{" "}
                <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_MEDIA_ENCODER</code>
                ）で固定中です。
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-white">バックグラウンド占有</label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-slate-400">
              この PC 上で裏処理が CPU・OS スケジューリングをどれだけ使うか。動画の画質そのものとは別です。
            </p>
            <select
              value={resourceIntensity}
              disabled={data?.envLocked.resourceIntensity}
              onChange={(e) => setResourceIntensity(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-[#1e2226] dark:text-white disabled:opacity-50"
            >
              {OCCUPANCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
            {data?.envLocked.resourceIntensity && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                環境変数（<code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_RESOURCE_INTENSITY</code> または{" "}
                <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_MEDIA_LOAD_PRESET</code>
                ）で固定中です。
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-800 dark:text-white">プレビュー変換の品質・サイズ</label>
            <p className="mb-2 text-xs text-zinc-500 dark:text-slate-400">
              ライト MP4・サムネ・MP3・波形のパラメータ。占有設定とは独立して変えられます。
            </p>
            <select
              value={outputPreset}
              disabled={data?.envLocked.outputPreset}
              onChange={(e) => setOutputPreset(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-[#1e2226] dark:text-white disabled:opacity-50"
            >
              {OUTPUT_PRESET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
            {data?.envLocked.outputPreset && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                環境変数（<code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_OUTPUT_PRESET</code> または{" "}
                <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">FFMPEG_MEDIA_LOAD_PRESET</code>
                ）で固定中です。
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-white/20 dark:hover:bg-white/30"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>

        <p className="mt-6 text-xs text-zinc-500 dark:text-slate-500">
          設定は <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">data/media-encoding.json</code> に保存されます。環境変数{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">FFMPEG_VIDEO_BACKEND</code> /{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">FFMPEG_RESOURCE_INTENSITY</code> /{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">FFMPEG_OUTPUT_PRESET</code> はファイルより優先されます。レガシー{" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">FFMPEG_MEDIA_*</code> は両方の段階に相当する値として解釈されます。
        </p>
      </main>
    </div>
  );
}
