"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Compound } from "@cmpd/compound";
import type { Editor } from "@cmpd/editor";
import "@cmpd/compound/compound.css";
import { CUSTOM_SHAPE_UTILS, placeAsset } from "@/app/shapes";
import type { ApiAsset } from "@shared/apiTypes";
import { useYjsStore } from "@/app/hooks/useYjsStore";
import { SmartHandTool } from "@/app/tools/SmartHandTool";
import { createBoardOverrides } from "./boardOverrides";
import { CollaboratorCursorWithName } from "@/app/components/collaboration/CollaboratorCursor";
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
import { useDoubleClickPreview } from "@/app/hooks/useDoubleClickPreview";
import { useUrlPreviewAttacher } from "@/app/hooks/useUrlPreviewAttacher";
import { useShapeDeletePositionCapture } from "@/app/hooks/useShapeDeletePositionCapture";
import { useSnapshotSave } from "@/app/hooks/useSnapshotPersistence";
import { DarkModeButton } from "./DarkModeButton";
import { BoardHeader } from "./BoardHeader";

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
  const router = useRouter();

  // 戻る遷移を高速化するため、ワークスペースをプリフェッチ
  useEffect(() => {
    router.prefetch(`/workspace/${workspaceId}`);
  }, [router, workspaceId]);

  const isE2eMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("e2e") === "1";

  // ローカル以外（Tailscale 等）では同一オリジン /ws を利用
  const syncWsUrl =
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      : process.env.NEXT_PUBLIC_SYNC_WS_URL ?? "ws://localhost:5858";
  const useSync =
    typeof syncWsUrl === "string" &&
    syncWsUrl.length > 0 &&
    !syncWsUrl.startsWith("__placeholder");

  const fetchSnapshotWhenEmpty = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`);
      if (!res.ok) return { records: [], reactions: {}, comments: {}, reactionEmojiPreset: null };
      const json = (await res.json()) as {
        records?: unknown[];
        reactions?: Record<string, string>;
        comments?: Record<string, string>;
        reactionEmojiPreset?: string[] | null;
      };
      const records = Array.isArray(json?.records) ? json.records : [];
      return {
        records: records as import("@cmpd/tlschema").TLRecord[],
        reactions: json?.reactions ?? {},
        comments: json?.comments ?? {},
        reactionEmojiPreset: json?.reactionEmojiPreset ?? null,
      };
    } catch {
      return { records: [], reactions: {}, comments: {}, reactionEmojiPreset: null };
    }
  }, [workspaceId, boardId]);

  const yjsStore = useYjsStore({
    roomId: boardId,
    wsUrl: useSync ? syncWsUrl : "",
    shapeUtils: CUSTOM_SHAPE_UTILS,
    defaultName: userName,
    userId: currentUserId,
    avatarUrl: avatarUrl ?? undefined,
    fetchSnapshotWhenEmpty: useSync ? fetchSnapshotWhenEmpty : undefined,
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
  } = useFileDropHandler(boardId, userName);

  const boardOverrides = useMemo(
    () => createBoardOverrides({ onFileUploadAll: openAllFilesPickerAndUpload }),
    [openAllFilesPickerAndUpload]
  );

  const components = useMemo(
    () => ({ CollaboratorCursor: CollaboratorCursorWithName }),
    []
  );
  const { registerListener: registerArrowDeleteListener } = useArrowCascadeDelete();
  const { registerListener: registerCreatedByListener } = useAutoCreatedBy(userName);
  const { registerHandler: registerDoubleClickHandler } = useDoubleClickPreview(setPreview);
  const { registerListener: registerUrlPreviewAttacher } = useUrlPreviewAttacher();
  const { registerListener: registerPositionCapture } = useShapeDeletePositionCapture();

  const handleRestoreAsset = useCallback(
    async (editor: Editor) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);

      const singleId = params.get("restoreAsset");
      const multiIds = params.get("restoreAssets");
      const assetIds = multiIds
        ? multiIds.split(",").filter(Boolean)
        : singleId
          ? [singleId]
          : [];

      if (assetIds.length === 0) return;

      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);

      /** キャンバスに既にこの assetId を参照するシェイプがあるか */
      const hasShapeForAsset = (dbAssetId: string): boolean => {
        for (const shape of editor.getCurrentPageShapes()) {
          const aid = (shape.props as { assetId?: string }).assetId;
          if (!aid) continue;
          if (aid === dbAssetId) return true;
          if (aid.startsWith("asset:")) {
            const assetRecord = editor.store.get(aid as never);
            const src = (assetRecord as { props?: { src?: string } } | undefined)?.props?.src ?? "";
            if (src.includes(`/api/assets/${dbAssetId}/file`)) return true;
          }
        }
        return false;
      };

      let lastPosition: { x: number; y: number } | null = null;

      for (const assetId of assetIds) {
        if (hasShapeForAsset(assetId)) continue;
        try {
          const res = await fetch(`/api/assets/${assetId}`);
          if (!res.ok) continue;
          const asset = (await res.json()) as ApiAsset;

          const viewport = editor.getViewportScreenCenter();
          const position = {
            x: asset.lastKnownX ?? viewport.x - 160,
            y: asset.lastKnownY ?? viewport.y - 120,
          };

          await placeAsset(editor, asset, position, userName);
          lastPosition = position;
        } catch {
          // 復元失敗はサイレントに無視
        }
      }

      if (lastPosition) {
        editor.centerOnPoint({ x: lastPosition.x, y: lastPosition.y });
      }
    },
    [userName]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
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

  const syncStatus =
    useSync && yjsStore.status === "synced-remote"
      ? yjsStore.connectionStatus === "online"
        ? "同期中"
        : "オフライン"
      : useSync && yjsStore.status === "error"
        ? `同期エラー: ${yjsStore.error?.message ?? "不明"}`
        : useSync && yjsStore.status === "loading"
          ? "接続中..."
          : null;

  const syncAvailable =
    useSync &&
    yjsStore.status === "synced-remote" &&
    (yjsStore as { connectionStatus?: string }).connectionStatus === "online";

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
        <div className="flex h-screen flex-col">
          <BoardHeader
            workspaceId={workspaceId}
            boardId={boardId}
            boardName={boardName}
            syncStatus={syncStatus}
            isSyncError={useSync && yjsStore.status === "error"}
            useSync={useSync}
            provider={yjsStore.provider}
            currentUserId={currentUserId}
            onHeaderActionsMount={setHeaderActionsEl}
            resumableUploads={resumableUploads}
            onResumeUpload={resumeUpload}
            onRefresh={() => router.refresh()}
          />

          <div className="flex-1 relative">
            {useSync ? (
              yjsStore.status === "loading" ? (
                <div className="flex h-full items-center justify-center text-zinc-500">接続中...</div>
              ) : yjsStore.status === "error" ? (
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
                  store={yjsStore}
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
                  {yjsStore.provider && (
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
              )
            ) : (
              <Compound
                persistenceKey={`gachaboard-compound-${boardId}`}
                sessionId={currentUserId}
                defaultName={userName}
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
