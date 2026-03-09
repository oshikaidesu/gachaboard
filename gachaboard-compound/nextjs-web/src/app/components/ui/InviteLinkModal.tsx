"use client";

import { useEffect, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";

type Props = {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
};

export function InviteLinkModal({ workspaceId, workspaceName, onClose }: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/invite`)
      .then((res) => (res.ok ? res.json() : { inviteUrl: null }))
      .then((data) => setInviteUrl(data.inviteUrl))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const createOrReset = async () => {
    setCreating(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/invite`, { method: "POST" });
    if (res.ok) {
      const { inviteUrl: url } = await res.json();
      setInviteUrl(url);
      if (url) copyToClipboard(url);
    }
    setCreating(false);
  };

  const copy = () => {
    if (inviteUrl) copyToClipboard(inviteUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 text-center dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold dark:text-zinc-100">
          {workspaceName} の招待リンク
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">読み込み中...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {inviteUrl ? (
                <>
                  <button
                    onClick={copy}
                    className="rounded bg-zinc-800 px-3 py-2 text-sm text-white dark:bg-slate-600 dark:hover:bg-slate-500"
                  >
                    {inviteUrl && copiedText === inviteUrl ? "コピー済み" : "コピー"}
                  </button>
                  <button
                    onClick={() =>
                      confirm("招待リンクをリセットしますか？以前のリンクは使えなくなります。") &&
                      createOrReset()
                    }
                    disabled={creating}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
                  >
                    {creating ? "処理中..." : "リセット"}
                  </button>
                </>
              ) : (
                <button
                  onClick={createOrReset}
                  disabled={creating}
                  className="rounded bg-zinc-800 px-4 py-2 text-sm text-white dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
                >
                  {creating ? "発行中..." : "招待リンクを発行"}
                </button>
              )}
            </div>
            {inviteUrl && (
              <div className="rounded border border-zinc-300 bg-zinc-50 p-3 text-center dark:border-slate-600 dark:bg-slate-800">
                <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-slate-400">招待URL</p>
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-center text-sm text-blue-600 underline dark:text-blue-400"
                >
                  {inviteUrl}
                </a>
              </div>
            )}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded border border-zinc-300 py-2 text-center text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
