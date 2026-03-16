"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Compound } from "@cmpd/compound";
import type { Editor } from "@cmpd/editor";
import "@cmpd/compound/compound.css";
import { CUSTOM_SHAPE_UTILS, placeAsset } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";
import { useYjsStore } from "@/app/hooks/yjs/useYjsStore";
import { SmartHandTool } from "@/app/tools/SmartHandTool";
import { createBoardOverrides } from "./boardOverrides";
import { CollaboratorCursorWithName } from "@/app/components/collaboration/CollaboratorCursor";
import { DraggingGhostOverlay } from "@/app/components/collaboration/DraggingGhostOverlay";
import { BrushModeToolbarSync } from "./BrushModeToolbarSync";
import { BoardContext } from "./BoardContext";
import { BoardReactionProvider } from "./BoardReactionProvider";
import { BoardCommentProvider } from "./BoardCommentProvider";
import { AwarenessSync } from "@/app/components/collaboration/AwarenessSync";
import { ConnectHandles } from "./ConnectHandles";
import { PreviewModal } from "@/app/components/ui/PreviewModal";
import { useFileDropHandler } from "@/app/hooks/useFileDropHandler";
import { useArrowCascadeDelete } from "@/app/hooks/useArrowCascadeDelete";
import { useAutoCreatedBy } from "@/app/hooks/useAutoCreatedBy";
import { currentUserIdAtom } from "./currentUserAtom";
import { useDoubleClickPreview } from "@/app/hooks/useDoubleClickPreview";
import { useUrlPreviewAttacher } from "@/app/hooks/useUrlPreviewAttacher";
import { useShapeDeletePositionCapture } from "@/app/hooks/useShapeDeletePositionCapture";
import { useSnapshotSave } from "@/app/hooks/board/useSnapshotPersistence";
import { DarkModeButton } from "./DarkModeButton";
import { BoardHeader } from "./BoardHeader";
import { getSyncWsUrl, isSyncWsUrlValid } from "@/lib/syncWsUrl";
import { useBoardSnapshotFetch } from "@/app/hooks/board/useBoardSnapshotFetch";
import { useRestoreAsset } from "@/app/hooks/board/useRestoreAsset";
import { useSyncStatus } from "@/app/hooks/board/useSyncStatus";
import { useSyncToken } from "@/app/hooks/board/useSyncToken";

type Props = {
  boardId: string;
  workspaceId: string;
  boardName: string;
  userName: string;
  currentUserId: string;
  avatarUrl?: string | null;
};

const CUSTOM_TOOLS = [SmartHandTool];

export default function CompoundBoard({
  boardId,
  workspaceId,
  boardName,
  userName,
  currentUserId,
  avatarUrl,
}: Props) {
  const [preview, setPreview] = useState<ApiAsset | null>(null);
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const router = useRouter();

  currentUserIdAtom.set(currentUserId);

  // Layout のレンダー中に Compound がマウントされると setState-in-render エラーが出るため遅延
  useEffect(() => {
    setEditorReady(true);
  }, []);

  // 戻る遷移を高速化するため、ワークスペースをプリフェッチ
  useEffect(() => {
    router.prefetch(`/workspace/${workspaceId}`);
  }, [router, workspaceId]);

  const isE2eMode =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("e2e") === "1" ||
      new URLSearchParams(window.location.search).get("testUserId") != null);

  // ローカル以外（Tailscale 等）では同一オリジン /ws を利用
  const syncWsUrl = getSyncWsUrl();
  const useSync = isSyncWsUrlValid(syncWsUrl);
  const e2eHeaders = isE2eMode ? { userId: currentUserId, userName } : null;
  const syncToken = useSyncToken(boardId, useSync, e2eHeaders);
  const fetchSnapshotWhenEmpty = useBoardSnapshotFetch(workspaceId, boardId);
  const handleRestoreAsset = useRestoreAsset(userName, avatarUrl ?? null);

  const yjsStore = useYjsStore({
    roomId: boardId,
    wsUrl: useSync ? syncWsUrl : "",
    shapeUtils: CUSTOM_SHAPE_UTILS,
    defaultName: userName,
    userId: currentUserId,
    avatarUrl: avatarUrl ?? undefined,
    fetchSnapshotWhenEmpty: useSync ? fetchSnapshotWhenEmpty : undefined,
    syncToken,
  });

  useSnapshotSave({
    store: yjsStore.status === "synced-remote" ? yjsStore.store : null,
    provider: yjsStore.provider ?? undefined,
    boardId,
    workspaceId,
    enabled: useSync,
  });

  const {
    registerHandler: registerFileDropHandler,
    uploadError,
    resumableUploads,
    openFilePickerAndUpload,
    openAllFilesPickerAndUpload,
    resumeUpload,
    isFileSystemAccessSupported,
  } = useFileDropHandler(boardId, userName, avatarUrl ?? null);

  const boardOverrides = useMemo(
    () => createBoardOverrides({ onFileUploadAll: openAllFilesPickerAndUpload }),
    [openAllFilesPickerAndUpload]
  );

  const components = useMemo(
    () => ({
      CollaboratorCursor: CollaboratorCursorWithName,
      InFrontOfTheCanvas: DraggingGhostOverlay,
    }),
    []
  );
  const { registerListener: registerArrowDeleteListener } = useArrowCascadeDelete();
  const { registerListener: registerCreatedByListener } = useAutoCreatedBy(currentUserId, userName, avatarUrl ?? null);
  const { registerHandler: registerDoubleClickHandler } = useDoubleClickPreview(setPreview);
  const { registerListener: registerUrlPreviewAttacher } = useUrlPreviewAttacher();
  const { registerListener: registerPositionCapture } = useShapeDeletePositionCapture();

  const { syncStatus, syncAvailable, isSyncError, isLoading } = useSyncStatus(useSync, yjsStore);

  // Compound が一度マウントされたら loading に戻っても絶対アンマウントしない
  const hasEverMountedCompound = useRef(false);
  if (!isLoading && !isSyncError && editorReady) {
    hasEverMountedCompound.current = true;
  }
  const showLoadingScreen = useSync && isLoading && !hasEverMountedCompound.current;

  const handleMount = useCallback(
    (editor: Editor) => {
      // 画面外シェイプのカリングを緩和。マージンを広げてスクロール時の読み込みちらつきを防ぐ
      editor.renderingBoundsMargin = 400;

      if (isE2eMode) {
        (window as unknown as { __E2E_TLDRAW_EDITOR__?: Editor }).__E2E_TLDRAW_EDITOR__ = editor;
        (window as unknown as { __E2E_PLACE_ASSET__?: typeof placeAsset }).__E2E_PLACE_ASSET__ = placeAsset;
      }
      // compound の Editor には setCameraOptions がない。ホイールズームは SmartHandTool 等で対応。

      // URL 直接ペーストで embed/bookmark を作らない（geo シェイプ貼り付け経由に統一）
      editor.registerExternalContentHandler("url", async () => {
        /* no-op */
      });

      registerFileDropHandler(editor);
      registerArrowDeleteListener(editor);
      registerCreatedByListener(editor);
      registerDoubleClickHandler(editor);
      registerUrlPreviewAttacher(editor);
      registerPositionCapture(editor);
      handleRestoreAsset(editor);
    },
    [
      isE2eMode,
      registerFileDropHandler,
      registerArrowDeleteListener,
      registerCreatedByListener,
      registerDoubleClickHandler,
      registerUrlPreviewAttacher,
      registerPositionCapture,
      handleRestoreAsset,
    ]
  );

  const boardContextValue = useMemo(
    () => ({
      boardId,
      workspaceId,
      currentUserId,
      userName,
      avatarUrl: avatarUrl ?? null,
      userInfoAtom: null,
      provider: useSync ? yjsStore.provider : undefined,
      syncAvailable,
    }),
    [boardId, workspaceId, currentUserId, userName, avatarUrl, useSync, yjsStore.provider, syncAvailable]
  );

  return (
    <BoardContext.Provider value={boardContextValue}>
      <BoardReactionProvider provider={useSync ? yjsStore.provider : undefined}>
        <BoardCommentProvider provider={useSync ? yjsStore.provider : undefined}>
        <div className="flex h-[100dvh] min-h-[100dvh] flex-col">
          <BoardHeader
            workspaceId={workspaceId}
            boardId={boardId}
            boardName={boardName}
            syncStatus={syncStatus}
            isSyncError={isSyncError}
            useSync={useSync}
            provider={yjsStore.provider}
            currentUserId={currentUserId}
            onHeaderActionsMount={setHeaderActionsEl}
            resumableUploads={resumableUploads}
            onResumeUpload={resumeUpload}
            onRefresh={() => router.refresh()}
          />

          <div className="flex-1 relative">
            {!editorReady ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">ボードを読み込み中...</div>
            ) : showLoadingScreen ? (
              <div className="flex h-full items-center justify-center text-zinc-500">接続中...</div>
            ) : useSync && isSyncError && !isE2eMode ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-4">
                <p className="text-red-500">同期エラー: {yjsStore.error?.message}</p>
                <button
                  onClick={() => router.refresh()}
                  className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                >
                  再読み込み
                </button>
                <details className="max-w-md rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
                  <summary className="cursor-pointer font-medium">対処法</summary>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>同期サーバー（sync-server）が起動しているか確認してください</li>
                    <li>開発環境: <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">docker compose up -d sync-server</code></li>
                    <li>環境変数 <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-700">NEXT_PUBLIC_SYNC_WS_URL</code> が正しいか確認してください</li>
                  </ul>
                </details>
              </div>
            ) : (
              <Compound
                {...(useSync && !(isE2eMode && isSyncError) ? { store: yjsStore } : {
                  persistenceKey: `gachaboard-${boardId}`,
                  sessionId: currentUserId,
                  defaultName: userName,
                })}
                shapeUtils={CUSTOM_SHAPE_UTILS}
                tools={CUSTOM_TOOLS}
                initialState="select"
                overrides={boardOverrides}
                components={components}
                onMount={handleMount}
                forceMobile
                assetUrls={{
                  icons: {
                    "tool-marquee": "/icons/tool-marquee.svg",
                    "tool-file-upload": "/icons/tool-file-upload.svg",
                  },
                  translations: { ja: "/translations/ja.json" },
                }}
              >
                <DarkModeButton portalTarget={headerActionsEl} />
                <BrushModeToolbarSync />
                {useSync && yjsStore.provider && (
                  <AwarenessSync
                    provider={yjsStore.provider}
                    localUserId={currentUserId}
                  />
                )}
                <ConnectHandles />
                <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-50 select-none dark:bg-white/20">
                  ファイルをドロップして配置
                </div>
              </Compound>
            )}
          </div>

          {uploadError && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-5 py-3 text-sm text-white shadow-lg dark:bg-red-700">
              {uploadError}
            </div>
          )}

          {preview && (
            <PreviewModal
              asset={preview}
              workspaceId={workspaceId}
              onClose={() => setPreview(null)}
            />
          )}
        </div>
        </BoardCommentProvider>
      </BoardReactionProvider>
    </BoardContext.Provider>
  );
}
