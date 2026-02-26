import Link from "next/link";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AuthErrorPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-red-600">ログインエラー</h1>
      <p className="text-sm text-zinc-600">
        Discord ログイン中にエラーが発生しました。以下を確認してください。
      </p>
      <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700">
        <li>
          <strong>nextjs-web/.env.local</strong> に
          <code className="mx-1 rounded bg-zinc-100 px-1">NEXTAUTH_SECRET</code>（長いランダム文字列）と
          <code className="mx-1 rounded bg-zinc-100 px-1">DISCORD_CLIENT_SECRET</code> が設定されているか
        </li>
        <li>
          Discord Developer Portal のアプリで、Redirect に
          <code className="mx-1 rounded bg-zinc-100 px-1">http://localhost:3000/api/auth/callback/discord</code>
          が追加されているか
        </li>
        <li>Docker で動かしている場合は <code className="rounded bg-zinc-100 px-1">docker compose down</code> のあと <code className="rounded bg-zinc-100 px-1">docker compose up -d --build</code> で再起動し、.env.local が読み込まれているか</li>
      </ul>
      {error && (
        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          エラー: {error}
        </p>
      )}
      <Link className="inline-flex w-fit rounded bg-indigo-600 px-4 py-2 text-sm text-white" href="/">
        トップに戻る
      </Link>
    </main>
  );
}
