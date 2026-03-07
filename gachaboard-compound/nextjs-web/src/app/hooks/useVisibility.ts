"use client";

import { useEffect, useRef, useState } from "react";

/**
 * IntersectionObserver でコンポーネントの可視状態を返すフック。
 * ビューポート外のシェイプでポーリングを停止するために使う。
 */
export function useVisibility<T extends HTMLElement = HTMLElement>(): {
  ref: React.RefObject<T | null>;
  visible: boolean;
} {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
