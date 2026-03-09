/**
 * 遅延実行キュー。指定時間後にアクションを実行し、
 * その前に cancel されれば実行をキャンセルできる。
 * Undo 対応の「削除後 N 分で trash」等に利用。
 */
export type DelayedActionOptions = {
  keepalive?: boolean;
};

export function createDelayedActionQueue<T>(
  delayMs: number,
  onExecute: (id: string, data: T, options?: DelayedActionOptions) => void
) {
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; data: T }>();

  return {
    schedule(id: string, data: T) {
      const prev = pending.get(id);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        pending.delete(id);
        onExecute(id, data);
      }, delayMs);
      pending.set(id, { timer, data });
    },
    cancel(id: string) {
      const prev = pending.get(id);
      if (prev) {
        clearTimeout(prev.timer);
        pending.delete(id);
      }
    },
    flushAll(options?: DelayedActionOptions) {
      for (const [id, { timer, data }] of pending) {
        clearTimeout(timer);
        onExecute(id, data, options);
      }
      pending.clear();
    },
  };
}
