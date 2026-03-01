"use client";

import {
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiToolbarButton,
  useValue,
} from "@tldraw/tldraw";
import { brushModeAtom } from "@/app/tools/SmartHandTool";

/**
 * 範囲選択トグルボタン付きツールバー。
 * SmartHandTool の brushModeAtom と連動する。
 */
export function SmartHandToolbar(props: React.ComponentProps<typeof DefaultToolbar>) {
  const isBrushMode = useValue("brushMode", () => brushModeAtom.get(), []);
  return (
    <DefaultToolbar {...props}>
      <TldrawUiToolbarButton
        type="tool"
        isActive={isBrushMode}
        title="範囲選択 (ドラッグで複数選択)"
        onClick={() => brushModeAtom.set(!brushModeAtom.get())}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
          <polyline points="9 11 12 14 15 11" />
        </svg>
      </TldrawUiToolbarButton>
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
}
