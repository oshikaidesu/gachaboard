"use client";

import Link from "next/link";
import { useInviteInfo } from "@/app/hooks/invite/useInviteInfo";
import { useInviteJoin } from "@/app/hooks/invite/useInviteJoin";

type Props = { token: string };

export default function InviteClient({ token }: Props) {
  const { info, error: infoError, loading } = useInviteInfo(token);
  const { join, joining, error: joinError } = useInviteJoin(token);
  const error = infoError ?? joinError;

  const handleJoin = () => {
    if (!info) return;
    join();
  };

  const baseMain = "flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 sm:px-6";

  if (error) {
    return (
      <main className={baseMain}>
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">招待リンク</h1>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link className="text-sm text-zinc-500 hover:underline dark:text-zinc-400" href="/">
            ← トップに戻る
          </Link>
        </div>
      </main>
    );
  }

  if (loading || !info) {
    return (
      <main className={baseMain}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className={baseMain}>
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 sm:text-3xl">招待リンク</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <strong>{info.workspaceName}</strong> に参加しますか？
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="min-h-[44px] rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {joining ? "参加中..." : "参加する"}
          </button>
          <Link
            href="/"
            className="min-h-[44px] rounded-lg border border-zinc-300 px-6 py-3 text-center text-sm dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            キャンセル
          </Link>
        </div>
      </div>
    </main>
  );
}
