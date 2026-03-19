/**
 * VideoShape / AudioShape で共有する色・寸法定数
 */
import { MIN_COMMENT_LIST_H } from "@/app/hooks/media/useMediaPlayerComments";
export const BLUE = "#3b82f6";
export const ORANGE = "#ff5500";

export const TRACK_BG_LIGHT = "#e2e8f0";
export const TRACK_BG_DARK = "#334155";
export const GRAY_LIGHT = "#d1d5db";
export const GRAY_DARK = "#475569";

export const BG_LIGHT = "#ffffff";
export const BG_DARK = "#1e293b";

export const TEXT_PRIMARY_LIGHT = "#1e293b";
export const TEXT_PRIMARY_DARK = "#f1f5f9";
export const TEXT_LIGHT = "#111827";
export const TEXT_DARK = "#f1f5f9";
export const TEXT_MUTED_LIGHT = "#64748b";
export const TEXT_MUTED_DARK = "#94a3b8";
export const MUTED_LIGHT = "#6b7280";
export const MUTED_DARK = "#94a3b8";

export const BORDER_LIGHT = "#e2e8f0";
export const BORDER_DARK = "#334155";
export const BORDER_SUBTLE_LIGHT = "#f1f5f9";
export const BORDER_SUBTLE_DARK = "#475569";

export const CHECKER_LIGHT = "#e8e8e8";
export const CHECKER_DARK = "#334155";
export const CHECKER_BG_LIGHT = "#f4f4f4";
export const CHECKER_BG_DARK = "#0f172a";

export const SKELETON_LIGHT = "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)";
export const SKELETON_DARK = "linear-gradient(90deg, #334155 25%, #475569 50%, #334155 75%)";

export const SEEK_BAR_HEIGHT = 6;
export const SEEK_BAR_HIT_HEIGHT = 28;
export const CONTROLS_HEIGHT = 36;
export const HEADER_HEIGHT = 26;

/** 動画エリア以外の UI（ヘッダー・コントロール・コメント入力欄）の合計高さ。VideoShape と shapeCreators で共通利用。 */
export const VIDEO_UI_OVERHEAD =
  (HEADER_HEIGHT + 1) +
  (1 + 6 + SEEK_BAR_HIT_HEIGHT + 6 + (CONTROLS_HEIGHT - 10) + 8) +
  (30 + 6) +
  2;

export const WAVEFORM_HEIGHT = 48;
export const WAVEFORM_HIT_HEIGHT = 56;
export const WAVEFORM_VIEW_WIDTH = 360;
export const BAR_GAP = 1;
export const BASE_HEIGHT = 190;

/** 音声シェイプのデフォルト寸法（AudioShapeUtil.getDefaultProps と createShapeForResolved で共通利用） */
export const AUDIO_DEFAULT_W = 460;
export const AUDIO_DEFAULT_H = BASE_HEIGHT + MIN_COMMENT_LIST_H;

/** 動画シェイプのデフォルト寸法（最大サイズ計算で配置時サイズがない場合のフォールバック） */
export const VIDEO_DEFAULT_W = 480;
const VIDEO_DEFAULT_VIDEO_AREA_H = Math.round(VIDEO_DEFAULT_W / (16 / 9));
export const VIDEO_DEFAULT_H = VIDEO_DEFAULT_VIDEO_AREA_H + VIDEO_UI_OVERHEAD + MIN_COMMENT_LIST_H;
