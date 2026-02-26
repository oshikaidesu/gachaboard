"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const TldrawBoard = dynamic(() => import("@/app/components/TldrawBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  return <TldrawBoard boardId={boardId} />;
}
