import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import ReactionPresetClient from "./ReactionPresetClient";

type Props = {
  params: Promise<{ boardId: string }>;
};

export default async function ReactionPresetPage({ params }: Props) {
  const { boardId } = await params;

  const [board, session] = await Promise.all([
    db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        snapshotData: true,
      },
    }),
    getServerSession(authOptions),
  ]);

  if (!board) notFound();

  if (!session?.user?.id) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/board/${boardId}/reaction-preset`)}`);
  }

  const data = board.snapshotData as { reactionEmojiPreset?: string[] | null } | null;
  const initialEmojis =
    Array.isArray(data?.reactionEmojiPreset) && data.reactionEmojiPreset.length > 0
      ? data.reactionEmojiPreset
      : null;

  return (
    <ReactionPresetClient
      boardId={board.id}
      boardName={board.name}
      workspaceId={board.workspaceId}
      initialEmojis={initialEmojis}
    />
  );
}
