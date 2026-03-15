"use client";

import { useInView } from "react-intersection-observer";

/**
 * IntersectionObserver でコンポーネントの可視状態を返すフック。
 * react-intersection-observer を使用。
 * ビューポート外のシェイプでポーリングを停止するために使う。
 */
export function useVisibility<T extends HTMLElement = HTMLElement>(): {
  ref: (node?: T | null) => void;
  visible: boolean;
} {
  const { ref, inView } = useInView({ threshold: 0 });
  return { ref: ref as (node?: T | null) => void, visible: inView };
}
