"use client";

import { useState } from "react";

type Props = {
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
};

export function BoardCreateForm({ onCreate, onCancel }: Props) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await onCreate(newName.trim());
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="flex gap-2 rounded-lg border border-zinc-200 p-4 dark:border-slate-600 dark:bg-slate-800/80">
      <input
        autoFocus
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        placeholder="ボード名"
        className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-slate-500"
      />
      <button
        onClick={handleCreate}
        disabled={creating || !newName.trim()}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white/20 dark:hover:bg-white/30"
      >
        {creating ? "作成中..." : "作成"}
      </button>
      <button
        onClick={() => {
          setNewName("");
          onCancel();
        }}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        キャンセル
      </button>
    </div>
  );
}
