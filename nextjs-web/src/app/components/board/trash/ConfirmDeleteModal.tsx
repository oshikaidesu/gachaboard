"use client";

/**
 * ゴミ箱での完全削除確認モーダル。
 */

import { formatFileSize } from "@shared/utils";

export type TrashConfirmState = {
  ids: string[];
  totalBytes: number;
  onConfirm: () => void;
};

type Props = {
  state: TrashConfirmState;
  onClose: () => void;
};

export function ConfirmDeleteModal({ state, onClose }: Props) {
  const count = state.ids.length;
  const size = formatFileSize(state.totalBytes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">本当に削除しますか？</h2>
        <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
          {count} 件（{size}）を完全に削除します。
        </p>
        <p className="mb-6 text-sm font-medium text-red-500 dark:text-red-400">この操作は取り消せません。</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            いいえ、戻る
          </button>
          <button
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
          >
            はい、削除する
          </button>
        </div>
      </div>
    </div>
  );
}
