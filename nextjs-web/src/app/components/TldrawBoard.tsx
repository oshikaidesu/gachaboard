"use client";

import { Tldraw } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";

type Props = { boardId: string };

export default function TldrawBoard({ boardId }: Props) {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2">
        <Link href="javascript:history.back()" className="text-xs text-zinc-500 hover:underline">
          ← 戻る
        </Link>
        <span className="text-xs text-zinc-400">Board: {boardId}</span>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="ml-auto rounded border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
        >
          URLをコピー
        </button>
      </div>
      <div className="flex-1">
        <Tldraw persistenceKey={`board-${boardId}`} />
      </div>
    </div>
  );
}
