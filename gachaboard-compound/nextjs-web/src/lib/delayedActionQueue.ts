/**
 * 遅延実行キュー。指定時間後にアクションを実行し、
 * その前に cancel されれば実行をキャンセルできる。
 * Undo 対応の「削除後 N 分で trash」等に利用。
 * staggerMs を指定すると、複数同時実行時に間を空けて実行する（サーバー負荷分散）。
 */
export type DelayedActionOptions = {
  keepalive?: boolean;
};

export function createDelayedActionQueue<T>(
  delayMs: number,
  onExecute: (id: string, data: T, options?: DelayedActionOptions) => void,
  staggerMs: number = 0
) {
  const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; data: T }>();
  const runQueue: { id: string; data: T; options?: DelayedActionOptions }[] = [];
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  function runOne() {
    const next = runQueue.shift();
    if (!next) {
      drainTimer = null;
      return;
    }
    onExecute(next.id, next.data, next.options);
    if (runQueue.length > 0 && staggerMs > 0) drainTimer = setTimeout(runOne, staggerMs);
    else if (runQueue.length > 0) runOne();
    else drainTimer = null;
  }

  function enqueueRun(id: string, data: T, options?: DelayedActionOptions) {
    runQueue.push({ id, data, options });
    if (!drainTimer) drainTimer = staggerMs > 0 ? setTimeout(runOne, 0) : (runOne(), null);
  }

  return {
    schedule(id: string, data: T) {
      const prev = pending.get(id);
      if (prev) clearTimeout(prev.timer);
      const timer = setTimeout(() => {
        pending.delete(id);
        enqueueRun(id, data);
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
        enqueueRun(id, data, options);
      }
      pending.clear();
    },
  };
}
