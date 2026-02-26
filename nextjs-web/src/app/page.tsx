import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignInButton } from "./components/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 p-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Whiteboard Multiplayer</h1>
        <p className="text-sm text-zinc-600">
          Discord認証 + Guild境界の実装を開始した初期画面です。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-5">
        {session?.user ? (
          <div className="space-y-3">
            <p className="text-sm">
              ログイン中: <strong>{session.user.name ?? session.user.email}</strong>
            </p>
            <p className="text-xs text-zinc-500">
              User ID: {session.user.id} / Discord ID: {session.user.discordId}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link className="rounded bg-black px-4 py-2 text-sm text-white" href="/projects">
                Projectsへ
              </Link>
              <a className="rounded border border-zinc-300 px-4 py-2 text-sm" href="/api/auth/signout">
                サインアウト
              </a>
            </div>
          </div>
        ) : (
          <SignInButton />
        )}
      </section>
    </main>
  );
}
