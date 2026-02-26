import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { projectId } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Project {projectId}</h1>
      <p className="text-sm text-zinc-600">
        プロジェクト詳細ページ（今は導線確認用のプレースホルダ）。
      </p>

      <Link
        className="inline-flex w-fit rounded bg-black px-4 py-2 text-sm text-white"
        href={`/project/${projectId}/board/default`}
      >
        ボードを開く
      </Link>
    </main>
  );
}
