"use client";

import { useEffect, useState } from "react";

type Props = {
  workspaceId: string;
  className?: string;
};

/** ワークスペースカード内に表示するコンパクトな招待URLセクション */
export function InviteLinkInline({ workspaceId, className = "" }: Props) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

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
      if (url && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => setCopied(true));
        setTimeout(() => setCopied(false), 2500);
      }
    }
    setCreating(false);
  };

  const copy = () => {
    if (inviteUrl && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true));
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className={`mt-4 border-t border-zinc-200 pt-4 dark:border-slate-600/60 ${className}`}
      onClick={(e) => e.preventDefault()}
    >
      {loading ? (
        <span className="text-xs text-zinc-400 dark:text-slate-500">読み込み中...</span>
      ) : inviteUrl ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-slate-400">招待URL</span>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={copy}
                className="rounded px-1.5 py-0.5 text-[11px] text-white hover:bg-zinc-600 dark:hover:bg-slate-500 bg-zinc-700 dark:bg-slate-600"
              >
                {copied ? "コピー済み" : "コピー"}
              </button>
              <button
                type="button"
                onClick={() =>
                  confirm("招待リンクをリセットしますか？以前のリンクは使えなくなります。") &&
                  createOrReset()
                }
                disabled={creating}
                className="rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {creating ? "処理中..." : "リセット"}
              </button>
            </div>
          </div>
          <span className="block truncate text-xs text-zinc-500 dark:text-slate-400" title={inviteUrl}>
            {inviteUrl}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-zinc-500 dark:text-slate-400">招待URL</span>
          <button
            type="button"
            onClick={createOrReset}
            disabled={creating}
            className="rounded bg-zinc-700 px-1.5 py-0.5 text-[11px] text-white hover:bg-zinc-600 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50"
          >
            {creating ? "発行中..." : "招待リンクを発行"}
          </button>
        </div>
      )}
    </div>
  );
}
