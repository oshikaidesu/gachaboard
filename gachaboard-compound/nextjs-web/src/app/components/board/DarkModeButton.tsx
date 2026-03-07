"use client";

import { createPortal } from "react-dom";
import { useEditor, useValue } from "@cmpd/editor";
import { useActions } from "@cmpd/compound";

type Props = {
  portalTarget: HTMLDivElement | null;
};

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

/**
 * ダークモード切り替えボタン。
 * ライトモード時は月アイコン（クリックでダークへ）、ダークモード時は太陽アイコン（クリックでライトへ）。
 */
export function DarkModeButton({ portalTarget }: Props) {
  const editor = useEditor();
  const isDarkMode = useValue("isDarkMode", () => editor.user.getIsDarkMode(), [editor]);
  const actions = useActions();

  const handleClick = () => {
    const toggleAction = actions["toggle-dark-mode" as keyof typeof actions] as
      | { onSelect?: (source: string) => void }
      | undefined;
    toggleAction?.onSelect?.("header");
    // アプリ全体のテーマを即時反映（ThemeProvider が受信）
    const next = !isDarkMode;
    document.dispatchEvent(
      new CustomEvent("gachaboard-theme-change", { detail: { isDarkMode: next } })
    );
  };

  const button = (
    <button
      type="button"
      onClick={handleClick}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      title={isDarkMode ? "ライトモードにする" : "ダークモードにする"}
    >
      {isDarkMode ? <SunIcon /> : <MoonIcon />}
    </button>
  );

  if (!portalTarget || typeof document === "undefined") return null;
  return createPortal(button, portalTarget);
}
