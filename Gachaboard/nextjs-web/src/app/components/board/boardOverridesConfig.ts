/**
 * boardOverrides 用の設定。
 * GEO_SIZES はツールバーから geo シェイプを即配置する際のデフォルトサイズ。
 */
export const GEO_SIZES: Record<string, { w: number; h: number }> = {
  star: { w: 200, h: 190 },
  cloud: { w: 300, h: 180 },
  rectangle: { w: 200, h: 120 },
  ellipse: { w: 200, h: 120 },
  triangle: { w: 200, h: 120 },
  diamond: { w: 200, h: 120 },
  hexagon: { w: 200, h: 120 },
  octagon: { w: 200, h: 120 },
  oval: { w: 200, h: 120 },
  pentagon: { w: 200, h: 120 },
  heart: { w: 200, h: 120 },
  rhombus: { w: 200, h: 120 },
};

export const GEO_DEFAULT_SIZE = { w: 200, h: 120 } as const;

/** ツールバーに表示するツール ID */
export const TOOLBAR_ALLOWED_IDS: readonly string[] = ["select", "draw", "eraser", "file-upload-all", "rectangle"];

/** アクションメニューから非表示にする ID */
export const HIDE_ACTION_IDS: readonly string[] = ["rotate-cw", "rotate-ccw", "toggle-dark-mode"];
