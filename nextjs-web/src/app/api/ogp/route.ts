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

export async function GET(req: NextRequest) {
  const session = await requireLogin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const youtubeId = extractYoutubeId(url);
  if (youtubeId) {
    const data: OgpData = {
      url,
      isYoutube: true,
      youtubeId,
      title: "YouTube Video",
      image: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
    cache.set(url, { data, ts: Date.now() });
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
      url,
      title: getMeta("og:title") || $("title").text() || undefined,
      description: getMeta("og:description") || getMeta("description") || undefined,
      image: getMeta("og:image") || undefined,
    };

    cache.set(url, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ url, title: url }, { status: 200 });
  }
}
