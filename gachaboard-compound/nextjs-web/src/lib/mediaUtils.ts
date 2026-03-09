/**
 * クライアント用メディアユーティリティ（画像・動画の表示サイズ、テキスト取得）。
 * ブラウザ環境でのみ使用すること（Image / video 要素 / fetch を使用）。
 */

import { MAX_TEXT_PREVIEW_BYTES } from "@shared/constants";

export const IMAGE_LONG_SIDE = 320;
export const VIDEO_LONG_SIDE = 480;

export function getImageDisplaySize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (nw === 0 || nh === 0) {
        resolve({ w: 320, h: 240 });
        return;
      }
      const scale = IMAGE_LONG_SIDE / Math.max(nw, nh);
      resolve({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ w: 320, h: 240 });
    };
    img.src = url;
  });
}

export function getImageDisplaySizeFromUrl(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (nw === 0 || nh === 0) {
        resolve({ w: 320, h: 240 });
        return;
      }
      const scale = IMAGE_LONG_SIDE / Math.max(nw, nh);
      resolve({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.onerror = () => resolve({ w: 320, h: 240 });
    img.src = url;
  });
}

export function getVideoDisplaySizeFromUrl(url: string): Promise<{ w: number; h: number }> {
  const fallback = { w: VIDEO_LONG_SIDE, h: Math.round((VIDEO_LONG_SIDE * 9) / 16) };
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const timer = setTimeout(() => {
      video.removeAttribute("src");
      video.load();
      resolve(fallback);
    }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const { videoWidth: vw, videoHeight: vh } = video;
      video.removeAttribute("src");
      video.load();
      if (vw === 0 || vh === 0) {
        resolve(fallback);
        return;
      }
      const scale = VIDEO_LONG_SIDE / Math.max(vw, vh);
      resolve({ w: Math.round(vw * scale), h: Math.round(vh * scale) });
    };
    video.onerror = () => {
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(fallback);
    };
    video.src = url;
  });
}

export async function fetchTextContent(assetId: string): Promise<string> {
  try {
    const res = await fetch(`/api/assets/${assetId}/file`);
    if (!res.ok) return "(読み込みエラー)";
    const text = await res.text();
    return text.length > MAX_TEXT_PREVIEW_BYTES
      ? text.slice(0, MAX_TEXT_PREVIEW_BYTES) + "\n…(以下省略)"
      : text;
  } catch {
    return "(読み込みエラー)";
  }
}
