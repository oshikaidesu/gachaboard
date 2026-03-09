"use client";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "すべての種類" },
  { value: "image", label: "画像" },
  { value: "gif", label: "GIF" },
  { value: "video", label: "動画" },
  { value: "audio", label: "音声" },
  { value: "file", label: "その他" },
];

type BoardOption = { id: string; name: string };

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  filterBoard: string;
  onFilterBoardChange: (v: string) => void;
  filterKind: string;
  onFilterKindChange: (v: string) => void;
  boardOptions: BoardOption[];
};

export function AssetFilters({
  search,
  onSearchChange,
  filterBoard,
  onFilterBoardChange,
  filterKind,
  onFilterKindChange,
  boardOptions,
}: Props) {
  const hasFilters = search || filterBoard || filterKind;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="search"
        placeholder="ファイル名で検索..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="min-w-[200px] flex-1 rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-zinc-500"
      />
      <select
        value={filterBoard}
        onChange={(e) => onFilterBoardChange(e.target.value)}
        className="rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:focus:border-zinc-500"
      >
        <option value="">すべてのボード</option>
        <option value="__none__">未配置</option>
        {boardOptions.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select
        value={filterKind}
        onChange={(e) => onFilterKindChange(e.target.value)}
        className="rounded border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-100 dark:focus:border-zinc-500"
      >
        {KIND_OPTIONS.map((o) => (
          <option key={o.value || "_all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hasFilters && (
        <button
          onClick={() => {
            onSearchChange("");
            onFilterBoardChange("");
            onFilterKindChange("");
          }}
          className="text-xs text-zinc-500 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
        >
          クリア
        </button>
      )}
    </div>
  );
}
