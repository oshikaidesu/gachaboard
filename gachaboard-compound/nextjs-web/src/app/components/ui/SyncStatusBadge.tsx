"use client";

/**
 * compound 用の同期ステータス表示。
 * store の型は useYjsStore の戻り値に合わせる。
 */
type Props = {
  store: { status: string; connectionStatus?: string };
  syncUrl: string;
  boardId: string;
  userId: string;
};

export function SyncStatusBadge({ store }: Props) {
  const status =
    store.status === "synced-remote" && store.connectionStatus === "online"
      ? "同期中"
      : store.status === "synced-remote"
        ? "オフライン"
        : "ローカル保存";
  return <span className="text-xs text-zinc-400">{status}</span>;
}
