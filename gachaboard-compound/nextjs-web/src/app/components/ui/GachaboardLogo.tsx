"use client";

import Link from "next/link";

type Size = "sm" | "md" | "lg";

const sizeMap: Record<Size, number> = {
  sm: 24,
  md: 32,
  lg: 48,
};

type Props = {
  size?: Size;
  href?: string;
  className?: string;
};

/** プロジェクトアイコン。ヘッダー・README 等で共通利用 */
export function GachaboardLogo({ size = "md", href, className = "" }: Props) {
  const px = sizeMap[size];
  const img = (
    <img
      src="/icon.svg"
      alt="Gachaboard"
      width={px}
      height={px}
      className={`shrink-0 ${className}`}
    />
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        {img}
      </Link>
    );
  }
  return img;
}
