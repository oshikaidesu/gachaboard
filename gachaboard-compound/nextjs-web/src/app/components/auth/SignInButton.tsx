"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      await signIn("discord", { callbackUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm dark:text-zinc-300">未ログインです。Discordでログインしてください。</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
      >
        {loading ? "リダイレクト中..." : "Discordでログイン"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        つながらない場合: .env.local の NEXTAUTH_SECRET と DISCORD_CLIENT_SECRET を設定し、Discord Developer Portal の Redirect URI に
        <code className="mx-1 rounded bg-zinc-100 px-1 dark:bg-zinc-800 dark:text-zinc-300">http://localhost:3000/api/auth/callback/discord</code>
        を追加してください。
      </p>
    </div>
  );
}
