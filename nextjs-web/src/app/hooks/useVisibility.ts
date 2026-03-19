"use client";

import { useInView } from "react-intersection-observer";

type UseVisibilityOptions = {
  /** ビューポートの手前で先行検知（例: "200px" で 200px 手前から visible） */
  rootMargin?: string;
};

/**
 * IntersectionObserver でコンポーネントの可視状態を返すフック。
 * react-intersection-observer を使用。
 * ビューポート外のシェイプでポーリングを停止するために使う。
 */
export function useVisibility<T extends HTMLElement = HTMLElement>(
  options?: UseVisibilityOptions
): {
  ref: (node?: T | null) => void;
  visible: boolean;
} {
  const { ref, inView } = useInView({ threshold: 0, rootMargin: options?.rootMargin });
  return { ref: ref as (node?: T | null) => void, visible: inView };
}
