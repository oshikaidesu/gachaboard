import dynamic from "next/dynamic";

const TldrawBoard = dynamic(() => import("@/app/components/TldrawBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-sm text-zinc-400">
      ボードを読み込み中...
    </div>
  ),
});

type Props = { params: Promise<{ boardId: string }> };

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params;
  return <TldrawBoard boardId={boardId} />;
}
