"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

/**
 * ヘッダーにテーマ切り替えがないページでのみ表示するフローティングのテーマ切り替え。
 * ボード・ワークスペース・アセット管理はヘッダーに組み込み済みのため非表示。
 */
export function ThemeToggleFloating() {
  const pathname = usePathname();
  const hasHeaderToggle =
    pathname?.startsWith("/board/") ||
    pathname?.startsWith("/workspaces") ||
    pathname?.startsWith("/workspace/");

  if (hasHeaderToggle) return null;

  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
