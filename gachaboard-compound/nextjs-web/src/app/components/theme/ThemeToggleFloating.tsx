"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

/**
 * ボードページ以外で表示するフローティングのテーマ切り替え。
 * ボードページはヘッダーに DarkModeButton があるため非表示。
 */
export function ThemeToggleFloating() {
  const pathname = usePathname();
  const isBoardPage = pathname?.startsWith("/board/");

  if (isBoardPage) return null;

  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
