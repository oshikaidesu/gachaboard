"use client";

import { useBackupScheduler } from "@/app/hooks/board/useBackupScheduler";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { TLRecord } from "@cmpd/tlschema";

type Props = {
  store: { allRecords: () => Iterable<TLRecord> } | null;
  provider?: HocuspocusProvider | null;
  boardId: string;
  workspaceId: string;
  enabled: boolean;
};

/** 1時間間隔でバックアップを作成。Compound 内で useEditor にアクセスするためコンポーネント化 */
export function BackupScheduler({ store, provider, boardId, workspaceId, enabled }: Props) {
  useBackupScheduler({ store, provider, boardId, workspaceId, enabled });
  return null;
}
