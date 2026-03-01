import { NextRequest, NextResponse } from "next/server";
import { requireLogin } from "@/lib/authz";

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

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

/** x.com / twitter.com を fxtwitter.com に変換して OGP を正しく取得できるようにする */
function toFxTwitterUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//, "https://fxtwitter.com/");
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//.test(url);
}

export async function GET(req: NextRequest) {
  const isE2eMode = process.env.E2E_TEST_MODE === "1";
  if (!isE2eMode) {
    const session = await requireLogin();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // X/Twitter URL は FxTwitter 経由で OGP を取得する
  const url = isTwitterUrl(rawUrl) ? toFxTwitterUrl(rawUrl) : rawUrl;

  const cached = cache.get(rawUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const youtubeId = extractYoutubeId(url);
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
