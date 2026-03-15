/**
 * Discord OAuth ログインエラー時のトラブルシューティング（サインイン・エラーページで共有）
 */
type Props = { callbackUrl?: string };

export function AuthTroubleshooting({ callbackUrl }: Props) {
  return (
    <>
      {/* トラブルシューティング: 最も多い原因（PostgreSQL） */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
        <h2 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          よくある原因: PostgreSQL が起動していない
        </h2>
        <p className="mb-2 text-xs text-amber-900 dark:text-amber-100">
          Next.js のターミナルに{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50 dark:text-amber-200">ECONNREFUSED</code>{" "}
          が出ている場合は、Docker で PostgreSQL を起動してください。
        </p>
        <pre className="overflow-x-auto rounded bg-amber-100/80 p-3 text-xs dark:bg-amber-900/30 dark:text-amber-100">
{`# 0. 状態確認（PostgreSQL / MinIO / sync-server）
cd nextjs-web
npm run status

# 1. Docker Desktop を起動（macOS・未起動時）
open -a Docker
# 最大5分待つ（起動スクリプト経由なら自動で待機）

# 2. PostgreSQL を起動（プロジェクトルートで）
docker compose up -d postgres

# 3. スキーマを適用
cd nextjs-web
npx prisma db push

# 4. Next.js を再起動してから再試行`}
        </pre>
      </section>

      {/* その他の確認事項 */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">その他の確認事項</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-400">
          <li>
            <strong>nextjs-web/.env.local</strong> に{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">NEXTAUTH_SECRET</code> と{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">DISCORD_CLIENT_SECRET</code>{" "}
            が設定されているか
          </li>
          <li>
            Discord Developer Portal の Redirect に、以下の URL が追加されているか
            {callbackUrl ? (
              <p className="mt-1 break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800 dark:text-zinc-300">
                <code>{callbackUrl}</code>
              </p>
            ) : (
              <ul className="ml-4 mt-1 list-inside list-disc text-zinc-600 dark:text-zinc-500">
                <li>ローカル: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">http://localhost:18580/api/auth/callback/discord</code></li>
                <li>Tailscale: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">https://&lt;あなたのTailscaleホスト&gt;/api/auth/callback/discord</code></li>
              </ul>
            )}
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">DATABASE_URL</code> のポートが{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">5433</code> になっているか
          </li>
        </ul>
      </section>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        詳細は{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">docs/discord-auth-troubleshooting.md</code>{" "}
        を参照してください。
      </p>
    </>
  );
}
