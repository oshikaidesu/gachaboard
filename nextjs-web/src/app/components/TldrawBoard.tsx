"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Tldraw,
  Editor,
  StateNode,
  TLClickEventInfo,
  TLRecord,
  TLShapeId,
  TLComponents,
  TLUiOverrides,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiToolbarButton,
  useValue,
  GeoShapeGeoStyle,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import { CUSTOM_SHAPE_UTILS, placeFile, type ApiAsset, getFileEmoji, type FileIconShape } from "@/app/shapes";
import MediaPlayer from "./MediaPlayer";
import { ConnectHandles } from "./ConnectHandles";
import { BoardContext } from "./BoardContext";
import { SmartHandTool, brushModeAtom } from "@/app/tools/SmartHandTool";

type Props = { boardId: string; workspaceId: string; userName: string; currentUserId: string };

// 全ツールをトグル動作にする：同じツールを再押下すると select（SmartHand）に戻る
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    delete tools["hand"];
    delete tools["select"];

    for (const key of Object.keys(tools)) {
      const tool = tools[key];
      if (!tool) continue;
      const originalOnSelect = tool.onSelect?.bind(tool);

      tool.onSelect = (source) => {
        const activeToolId = editor.getCurrentToolId();

        // geo 系ツールは activeToolId === 'geo' かつ meta.geo が現在値と一致したら再押下とみなす
        if (tool.meta?.geo) {
          const currentGeo = editor.getSharedStyles().getAsKnownValue(GeoShapeGeoStyle);
          if (activeToolId === "geo" && currentGeo === tool.meta.geo) {
            editor.setCurrentTool("select");
            return;
          }
        } else {
          // 通常ツール：activeToolId が同じなら再押下 → select に戻す
          if (activeToolId === tool.id) {
            editor.setCurrentTool("select");
            return;
          }
        }

        originalOnSelect?.(source);
      };
    }

    return tools;
  },
};

// 範囲選択トグルボタン付きツールバー
function SmartHandToolbar(props: React.ComponentProps<typeof DefaultToolbar>) {
  const isBrushMode = useValue("brushMode", () => brushModeAtom.get(), []);
  return (
    <DefaultToolbar {...props}>
      {/* 範囲選択トグルボタン（tldraw 標準の isActive で青ハイライト） */}
      <TldrawUiToolbarButton
        type="tool"
        isActive={isBrushMode}
        title="範囲選択 (ドラッグで複数選択)"
        onClick={() => brushModeAtom.set(!brushModeAtom.get())}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
          <polyline points="9 11 12 14 15 11" />
        </svg>
      </TldrawUiToolbarButton>
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
}

const CUSTOM_TOOLS = [SmartHandTool];

async function uploadFile(file: File, boardId: string): Promise<ApiAsset> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("boardId", boardId);
  const res = await fetch("/api/assets", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }
  return res.json();
}

export default function TldrawBoard({ boardId, workspaceId, userName, currentUserId }: Props) {
  const [preview, setPreview] = useState<ApiAsset | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      // ホイール → ズーム（tldraw の wheelBehavior を 'zoom' に設定）
      // デフォルトは 'pan'（ホイール=スクロール、Ctrl+ホイール=ズーム）なので反転する
      editor.setCameraOptions({ wheelBehavior: "zoom" });

      // ファイルドロップ → shapes/index.ts の placeFile() に委譲
      editor.registerExternalContentHandler("files", async ({ point, files }) => {
        const pagePoint = point ?? editor.getViewportScreenCenter();
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          let data: ApiAsset;
          try {
            data = await uploadFile(file, boardId);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "アップロードに失敗しました";
            setUploadError(msg);
            setTimeout(() => setUploadError(null), 5000);
            continue;
          }
          await placeFile(editor, file, data, {
            x: pagePoint.x + i * 120,
            y: pagePoint.y,
          }, userName);
        }
      });

      // シェイプ削除時に紐づくアローを連鎖削除する
      editor.store.listen(
        (entry) => {
          const removedRecords = Object.values(entry.changes.removed);
          const removedShapeIds = new Set(
            removedRecords
              .filter((r): r is TLRecord & { typeName: "shape" } => r.typeName === "shape")
              .map((r) => r.id)
          );
          if (removedShapeIds.size === 0) return;

          // 削除差分の中から「削除されたシェイプに接続していたアローバインディング」を拾う
          // ストア更新後に検索すると binding が消えて取り逃がすケースがあるため、差分ベースで判定する
          const arrowIds = new Set<TLShapeId>();
          for (const record of removedRecords) {
            if (record.typeName !== "binding") continue;
            if (!("type" in record) || record.type !== "arrow") continue;
            if (!("fromId" in record) || !("toId" in record)) continue;
            if (removedShapeIds.has(record.toId as TLShapeId)) {
              arrowIds.add(record.fromId as TLShapeId);
            }
          }

          if (arrowIds.size > 0) {
            editor.deleteShapes([...arrowIds]);
          }
        },
        { source: "user", scope: "document" }
      );

      // 新規シェイプ（矢印以外）に createdBy を自動付与する
      // placeFile() 経由以外（付箋・長方形など）でも名前ラベルが出るようにする
      editor.store.listen(
        (entry) => {
          const addedShapes = Object.values(entry.changes.added).filter(
            (r): r is TLRecord & { typeName: "shape"; type: string; meta: Record<string, unknown> } =>
              r.typeName === "shape" && r.type !== "arrow"
          );
          if (addedShapes.length === 0) return;

          const updates = addedShapes
            .filter((s) => !s.meta?.createdBy)
            .map((s) => ({
              ...s,
              meta: { ...s.meta, createdBy: userName },
            }));

          if (updates.length > 0) {
            editor.store.put(updates);
          }
        },
        { source: "user", scope: "document" }
      );

      // FileIconShape のダブルクリックでプレビューモーダルを開く
      type IdleStateNode = StateNode & {
        onDoubleClick: (info: TLClickEventInfo) => void;
      };
      const smartHandIdleState = editor.getStateDescendant<IdleStateNode>("select.idle");
      if (smartHandIdleState) {
        const originalOnDoubleClick = smartHandIdleState.onDoubleClick?.bind(smartHandIdleState);
        smartHandIdleState.onDoubleClick = function (info) {
          if (info.phase !== "up") {
            originalOnDoubleClick?.(info);
            return;
          }
          if (info.target === "shape") {
            const shape = info.shape as FileIconShape;
            if (shape.type === "file-icon") {
              setPreview({
                id: shape.props.assetId,
                fileName: shape.props.fileName,
                mimeType: shape.props.mimeType,
                kind: shape.props.kind,
                sizeBytes: "0",
              });
              return;
            }
          }
          originalOnDoubleClick?.(info);
        };
      }
    },
    [boardId, userName]
  );

  const components = useMemo<TLComponents>(
    () => ({
      Toolbar: SmartHandToolbar,
    }),
    []
  );

  return (
    <BoardContext.Provider value={{ boardId, workspaceId, currentUserId }}>
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 z-10">
        <Link href="javascript:history.back()" className="text-xs text-zinc-500 hover:underline">
          ← 戻る
        </Link>
        <span className="text-xs text-zinc-400">Board: {boardId}</span>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className="ml-auto rounded border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
        >
          URLをコピー
        </button>
      </div>

      {/* キャンバス */}
      <div className="flex-1 relative">
        <Tldraw
          persistenceKey={`board-${boardId}`}
          shapeUtils={CUSTOM_SHAPE_UTILS}
          tools={CUSTOM_TOOLS}
          overrides={uiOverrides}
          components={components}
          initialState="select"
          onMount={handleMount}
        >
          {/* draw.io ライクな接続ハンドル */}
          <ConnectHandles />

          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-50 select-none">
            ファイルをドロップして配置
          </div>
        </Tldraw>
      </div>

      {/* アップロードエラートースト */}
      {uploadError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
          {uploadError}
        </div>
      )}

      {/* FileIconShape ダブルクリック時のプレビューモーダル */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium truncate">{preview.fileName}</p>

            {preview.kind === "image" || preview.kind === "gif" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/assets/${preview.id}/file`}
                alt={preview.fileName}
                className="max-h-[60vh] w-full object-contain rounded"
              />
            ) : preview.kind === "video" || preview.kind === "audio" ? (
              <MediaPlayer
                assetId={preview.id}
                mimeType={preview.mimeType}
                fileName={preview.fileName}
                workspaceId={workspaceId}
                isConverted={preview.mimeType === "audio/wav"}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="text-6xl">{getFileEmoji(preview.fileName, preview.kind)}</span>
                <p className="text-sm text-zinc-500">プレビューできないファイルです</p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <a
                href={`/api/assets/${preview.id}/file`}
                download={preview.fileName}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                ダウンロード
              </a>
              <button
                onClick={() => setPreview(null)}
                className="rounded border border-zinc-200 px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </BoardContext.Provider>
  );
}
