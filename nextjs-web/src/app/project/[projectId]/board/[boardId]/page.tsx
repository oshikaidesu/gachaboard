import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type BoardPageProps = {
  params: Promise<{ projectId: string; boardId: string }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { projectId, boardId } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Board</h1>
        <p className="text-sm text-zinc-600">
          projectId: {projectId} / boardId: {boardId}
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-zinc-300 p-10 text-sm text-zinc-600">
        ここに tldraw コンポーネントを統合予定です（Phase 3/7 で接続）。
      </section>
    </main>
  );
}
