"use client";

import { useEffect, useRef } from "react";

type Props = {
  title: string;
  nameLabel: string;
  nameValue: string;
  onNameChange: (v: string) => void;
  descLabel?: string;
  descValue?: string;
  onDescChange?: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving?: boolean;
};

export function RenameModal({
  title,
  nameLabel,
  nameValue,
  onNameChange,
  descLabel,
  descValue = "",
  onDescChange,
  onSave,
  onClose,
  saving = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameValue.trim()) onSave();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold dark:text-zinc-100">{title}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{nameLabel}</label>
            <input
              ref={inputRef}
              type="text"
              value={nameValue}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onClose()}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
            />
          </div>
          {descLabel !== undefined && onDescChange && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">{descLabel}</label>
              <input
                type="text"
                value={descValue}
                onChange={(e) => onDescChange(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
              />
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving || !nameValue.trim()}
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
