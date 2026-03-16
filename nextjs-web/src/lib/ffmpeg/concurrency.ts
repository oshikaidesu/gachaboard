/**
 * ffmpeg 系処理の同時実行数を制限するキュー。
 * 同時アップロードが約10人程度を想定し、デフォルト最大10並列。
 */

const MAX_CONCURRENT =
  typeof process.env.FFMPEG_MAX_CONCURRENT !== "undefined"
    ? Math.max(1, parseInt(process.env.FFMPEG_MAX_CONCURRENT, 10) || 10)
    : 10;

type Task<T> = { fn: () => Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };

const queue: Task<unknown>[] = [];
let running = 0;

function runNext(): void {
  if (running >= MAX_CONCURRENT || queue.length === 0) return;
  running++;
  const { fn, resolve, reject } = queue.shift()!;
  Promise.resolve()
    .then(() => fn())
    .then(
      (v) => {
        running--;
        resolve(v);
        runNext();
      },
      (e) => {
        running--;
        reject(e);
        runNext();
      }
    );
}

/**
 * 同時実行数制限付きで ffmpeg 系の非同期処理を実行する。
 */
export function runWithFfmpegLimit<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ fn, resolve: resolve as (v: unknown) => void, reject });
    runNext();
  });
}
