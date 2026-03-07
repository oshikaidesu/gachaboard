import Link from "next/link";

type Props = { searchParams: Promise<{ reason?: string }> };

const messages: Record<string, string> = {
  workspaces:
    "ワークスペース一覧にはアクセスできません。このサーバーはオーナー制限で運用されています。",
  default:
    "このページにアクセスする権限がありません。ワークスペースやボードに参加するには、オーナーから招待リンクをもらう必要があります。",
};

export default async function AccessDeniedPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const body = messages[reason ?? "default"] ?? messages.default;

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold text-amber-600 dark:text-amber-400 sm:text-3xl">
          アクセスできません
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-800 dark:bg-amber-950/50">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">オーナーに依頼してください</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            招待リンクの発行はワークスペースのオーナーのみが行えます。オーナーに連絡し、招待リンクの発行を依頼してください。
          </p>
        </div>

        <Link
          className="min-h-[44px] rounded-lg bg-zinc-900 px-6 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          href="/"
        >
          トップに戻る
        </Link>
      </div>
    </main>
  );
}
