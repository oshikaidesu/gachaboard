"use client";

import { useState } from "react";

/**
 * 復元確認モーダル。二段構えで、2段目は YES/NO を逆に配置（復元は左、キャンセルは右）。
 */

type Props = {
  backupSavedAt: string;
  onConfirm: () => void;
  onClose: () => void;
};

export function RestoreConfirmModal({ backupSavedAt, onConfirm, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-zinc-700 dark:bg-zinc-900">
        {step === 1 ? (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">復元しますか？</h2>
            <p className="mb-1 text-sm text-zinc-500 dark:text-zinc-400">
              {new Date(backupSavedAt).toLocaleString("ja-JP")} の状態に戻します。
            </p>
            <p className="mb-6 text-sm font-medium text-amber-600 dark:text-amber-400">
              現在の内容は失われてしまいます。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                キャンセル
              </button>
              <button
                onClick={() => setStep(2)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white/20 dark:hover:bg-white/30"
              >
                次へ
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">最終確認</h2>
            <p className="mb-6 text-sm font-medium text-red-500 dark:text-red-400">
              現在の内容は失われてしまいます。この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onConfirm}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              >
                復元する
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
