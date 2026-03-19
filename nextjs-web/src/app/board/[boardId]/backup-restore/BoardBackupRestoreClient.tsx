"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GachaboardLogo } from "@/app/components/ui/GachaboardLogo";
import { ThemeToggle } from "@/app/components/theme/ThemeToggle";
import { useRouter } from "next/navigation";
import { RestoreConfirmModal } from "./RestoreConfirmModal";

type Props = {
  boardId: string;
  boardName: string;
  workspaceId: string;
};

type BackupItem = {
  id: string;
  savedAt: string;
  thumbnailSvg: string | null;
};

export default function BoardBackupRestoreClient({ boardId, boardName, workspaceId }: Props) {
  const router = useRouter();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [savingBackup, setSavingBackup] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<BackupItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}/backup`);
    if (res.ok) {
      const data = await res.json();
      setBackups(data.backups ?? []);
    }
    setLoading(false);
  }, [workspaceId, boardId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveFromCurrent = async () => {
    setSavingBackup(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/boards/${boardId}/backup/from-current`,
        { method: "POST" }
      );
      if (res.ok) {
        await load();
      }
    } finally {
      setSavingBackup(false);
    }
  };

  const executeRestore = async (backupId: string) => {
    setConfirmRestore(null);
    setRestoringId(backupId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/boards/${boardId}/backup/${backupId}/restore`,
        { method: "POST" }
      );
      if (res.ok) {
        router.push(`/board/${boardId}`);
      } else {
        setRestoringId(null);
      }
    } catch {
      setRestoringId(null);
    }
  };

  /** SVG を直接 DOM に挿入して表示（data: URL の img だと埋め込み画像が読み込まれないため） */
  const renderThumbnail = (svg: string | null) => {
    if (!svg) return null;
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 bg-background p-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GachaboardLogo size="md" href={`/board/${boardId}`} />
            <h1 className="text-2xl font-semibold dark:text-zinc-100">バックアップ復元</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveFromCurrent}
              disabled={savingBackup}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {savingBackup ? "保存中..." : "今の状態をバックアップ"}
            </button>
            <ThemeToggle />
            <Link
              href={`/board/${boardId}`}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ← ボードに戻る
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          ボード: <span className="font-medium text-zinc-700 dark:text-zinc-300">{boardName}</span>
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          荒らしなどでボードが消えた場合、過去のバックアップから復元できます。直近3件を保持しています。
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-zinc-400 dark:text-zinc-500">
          読み込み中...
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
          まだバックアップがありません。「今の状態をバックアップ」で手動保存するか、ボードを1時間以上編集すると自動でバックアップが作成されます。
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {backups.map((b) => {
            const isRestoring = restoringId === b.id;

            return (
              <li
                key={b.id}
                className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="aspect-video shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  {b.thumbnailSvg ? (
                    <div className="flex h-full w-full items-center justify-center p-2">
                      {renderThumbnail(b.thumbnailSvg)}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
                      サムネイルなし
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(b.savedAt).toLocaleString("ja-JP")}
                  </p>
                  <button
                    onClick={() => setConfirmRestore(b)}
                    disabled={isRestoring}
                    className="mt-auto rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {isRestoring ? "復元中..." : "この状態に復元"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {confirmRestore && (
        <RestoreConfirmModal
          backupSavedAt={confirmRestore.savedAt}
          onConfirm={() => executeRestore(confirmRestore.id)}
          onClose={() => setConfirmRestore(null)}
        />
      )}

      <div className="mt-auto pt-4 text-center">
        <Link
          href={`/workspace/${workspaceId}`}
          className="text-xs text-zinc-400 hover:underline dark:text-zinc-500 dark:hover:text-zinc-400"
        >
          ← ワークスペースに戻る
        </Link>
      </div>
    </main>
  );
}
