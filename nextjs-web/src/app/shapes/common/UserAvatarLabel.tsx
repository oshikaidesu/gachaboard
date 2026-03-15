"use client";

import { getSafeHref } from "@/lib/safeUrl";

export type UserAvatarLabelSize = "xs" | "sm" | "md";

const SIZE = {
  xs: { avatar: 14, fontSize: 12, gap: 4 },
  sm: { avatar: 16, fontSize: 10, gap: 6 },
  md: { avatar: 20, fontSize: 12, gap: 4 },
} as const;

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: UserAvatarLabelSize;
  /** 長い名前の省略用。指定時は名前部分が ... で切れる */
  minWidth?: number;
  maxWidth?: number;
  /** インライン表示用の追加スタイル（コメント欄など） */
  style?: React.CSSProperties;
};

/**
 * Discord アイコン + ユーザー名を表示する共通コンポーネント。
 * コメント著者・シェイプ作成者ラベルで共通利用。
 * avatarUrl は getSafeHref で検証してから表示する。
 * maxWidth を指定すると名前が長いときに省略表示される。
 */
export function UserAvatarLabel({
  name,
  avatarUrl,
  size = "sm",
  minWidth,
  maxWidth,
  style,
}: Props) {
  if (!name) return null;
  const safeAvatarUrl = getSafeHref(avatarUrl ?? null);
  const s = SIZE[size];
  const hasWidthConstraint = maxWidth !== undefined;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        fontSize: s.fontSize,
        lineHeight: 1.4,
        minWidth,
        maxWidth,
        overflow: hasWidthConstraint ? "hidden" : undefined,
        ...style,
      }}
    >
      {safeAvatarUrl && (
        <img
          src={safeAvatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          style={{
            width: s.avatar,
            height: s.avatar,
            borderRadius: 4,
            objectFit: "cover",
            flexShrink: 0,
            display: "block",
          }}
        />
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: hasWidthConstraint ? 0 : undefined,
          flex: hasWidthConstraint ? 1 : undefined,
        }}
      >
        {name}
      </span>
    </span>
  );
}
