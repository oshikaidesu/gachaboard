import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-zinc-600">
          Guild分離前提のプロジェクト一覧（この段階はスケルトン）。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4">
        <p className="text-sm">サインイン中: {session.user.name ?? session.user.email}</p>
        <p className="text-xs text-zinc-500">
          Discord ID: {session.user.discordId || "未取得"}
        </p>
      </section>

      <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        ここに Guild 内の project 一覧を表示します。
      </section>

      <div>
        <Link className="text-sm underline" href="/">
          ホームへ戻る
        </Link>
      </div>
    </main>
  );
}
