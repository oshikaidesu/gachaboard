import { NextRequest, NextResponse } from "next/server";
import getYouTubeID from "get-youtube-id";
import { requireLogin } from "@/lib/authz";
import { env } from "@/lib/env";

const cache = new Map<string, { data: OgpData; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1時間

type OgpData = {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  isYoutube?: boolean;
  youtubeId?: string;
};

/** x.com / twitter.com を fxtwitter.com に変換して OGP を正しく取得できるようにする */
function toFxTwitterUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//, "https://fxtwitter.com/");
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//.test(url);
}

/** SSRF 対策: localhost・プライベート IP・非 HTTP プロトコルを拒否 */
function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    if (/^10\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false; // link-local
    if (/^::1$/.test(host) || /^fe80:/i.test(host)) return false; // IPv6 local
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const isE2eMode = env.E2E_TEST_MODE;
  if (!isE2eMode) {
    const session = await requireLogin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });
  if (!isAllowedUrl(rawUrl)) {
    return NextResponse.json({ error: "URL not allowed (SSRF protection)" }, { status: 400 });
  }

  // X/Twitter URL は FxTwitter 経由で OGP を取得する
  const url = isTwitterUrl(rawUrl) ? toFxTwitterUrl(rawUrl) : rawUrl;

  const cached = cache.get(rawUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const youtubeId = getYouTubeID(url);
  if (youtubeId) {
    const data: OgpData = {
      url: rawUrl,
      isYoutube: true,
      youtubeId,
      title: "YouTube Video",
      image: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
    cache.set(rawUrl, { data, ts: Date.now() });
    return NextResponse.json(data);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GachaboardBot/1.0" },
    });
    clearTimeout(timeout);

    const html = await res.text();
    const { load } = await import("cheerio");
    const $ = load(html);

    const getMeta = (prop: string) =>
      $(`meta[property="${prop}"]`).attr("content") ||
      $(`meta[name="${prop}"]`).attr("content");

    const data: OgpData = {
      url: rawUrl,
      title: getMeta("og:title") || $("title").text() || undefined,
      description: getMeta("og:description") || getMeta("description") || undefined,
      image: getMeta("og:image") || undefined,
    };

    cache.set(rawUrl, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ url: rawUrl, title: rawUrl }, { status: 200 });
  }
}
