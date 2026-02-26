"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export function SignInButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn("discord", { callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm">未ログインです。Discordでログインしてください。</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "リダイレクト中..." : "Discordでログイン"}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <p className="text-xs text-zinc-500">
        つながらない場合: .env.local の NEXTAUTH_SECRET と DISCORD_CLIENT_SECRET を設定し、Discord Developer Portal の Redirect URI に
        <code className="mx-1 rounded bg-zinc-100 px-1">http://localhost:3000/api/auth/callback/discord</code>
        を追加してください。
      </p>
    </div>
  );
}
