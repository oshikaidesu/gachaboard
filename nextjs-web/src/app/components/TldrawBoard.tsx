"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Tldraw,
  Editor,
  GeoShapeGeoStyle,
  type TLComponents,
  type TLUiOverrides,
  getDefaultUserPresence,
  atom,
  createShapeId,
} from "@tldraw/tldraw";
import { useSync } from "@tldraw/sync";
import "@tldraw/tldraw/tldraw.css";
import Link from "next/link";
import { CUSTOM_SHAPE_UTILS } from "@/app/shapes";
import { BoardContext } from "./BoardContext";
import { BoardReactionProvider } from "./BoardReactionProvider";
import { SmartHandTool, brushModeAtom } from "@/app/tools/SmartHandTool";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { CollaboratorCursorWithName } from "./CollaboratorCursor";
import { SmartHandToolbar } from "./SmartHandToolbar";
import { PreviewModal } from "./PreviewModal";
import { useFileDropHandler } from "@/app/hooks/useFileDropHandler";
import { useArrowCascadeDelete } from "@/app/hooks/useArrowCascadeDelete";
import { useAutoCreatedBy } from "@/app/hooks/useAutoCreatedBy";
import { useDoubleClickPreview } from "@/app/hooks/useDoubleClickPreview";
import { useUrlPreviewAttacher } from "@/app/hooks/useUrlPreviewAttacher";
import type { ApiAsset } from "@shared/apiTypes";

type Props = {
  boardId: string;
  workspaceId: string;
  userName: string;
  currentUserId: string;
  avatarUrl?: string | null;
};

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

const uiOverrides: TLUiOverrides = {
  actions(_editor, actions) {
    // リンク埋め込みアクションを削除（ショートカット含む）
    delete actions["insert-link"];
    // 回転アクションを削除（ショートカット Shift+. / Shift+, を無効化）
    delete actions["rotate-cw"];
    delete actions["rotate-ccw"];
    return actions;
  },
  tools(editor, tools) {
    delete tools["hand"];
    delete tools["note"];

    // select ツールを brushModeAtom のトグルとして上書き
    // スマホでは onTouchStart + onClick の両方が発火して2回トグルされるため
    // 300ms 以内の2回目呼び出しを無視するデバウンスを入れる
    if (tools["select"]) {
      let lastToggleTime = 0;
      tools["select"].onSelect = () => {
        const now = Date.now();
        if (now - lastToggleTime < 300) return;
        lastToggleTime = now;
        brushModeAtom.set(!brushModeAtom.get());
      };
    }

    for (const key of Object.keys(tools)) {
      const tool = tools[key];
      if (!tool) continue;
      if (key === "select") continue; // select は上で個別に上書き済み
      const originalOnSelect = tool.onSelect?.bind(tool);

      // スマホでは onTouchStart + onClick の両方が発火して2回呼ばれるため
      // 300ms 以内の2回目呼び出しを無視する
      let lastCallTime = 0;

      tool.onSelect = (source) => {
        const now = Date.now();
        if (now - lastCallTime < 300) return;
        lastCallTime = now;

        // 他のツールが選択されたら範囲選択モードを解除
        if (brushModeAtom.get()) brushModeAtom.set(false);

        const activeToolId = editor.getCurrentToolId();

        if (tool.meta?.geo) {
          const currentGeo = editor.getSharedStyles().getAsKnownValue(GeoShapeGeoStyle);
          if (activeToolId === "geo" && currentGeo === tool.meta.geo) {
            editor.setCurrentTool("select");
            return;
          }

          // ツールバーからのクリック → ビューポート中央に即配置
          if (source === "toolbar") {
            const geo = tool.meta.geo as string;
            const size =
              geo === "star" ? { w: 200, h: 190 }
              : geo === "cloud" ? { w: 300, h: 180 }
              : { w: 200, h: 200 };
            const scale = editor.user.getIsDynamicResizeMode()
              ? 1 / editor.getZoomLevel()
              : 1;
            const vp = editor.getViewportPageBounds();
            const cx = vp.x + vp.w / 2;
            const cy = vp.y + vp.h / 2;
            const id = createShapeId();
            editor.markHistoryStoppingPoint(`creating_geo:${id}`);
            editor.createShapes([{
              id,
              type: "geo",
              x: cx - (size.w * scale) / 2,
              y: cy - (size.h * scale) / 2,
              props: { geo, scale, w: size.w * scale, h: size.h * scale },
            }]);
            editor.select(id);
            editor.setCurrentTool("select");
            editor.setEditingShape(id);
            return;
          }
        } else {
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

const CUSTOM_TOOLS = [SmartHandTool];

const COLOR_STORAGE_KEY = "gachaboard:cursorColor";

function getInitialColor(userId: string): string {
  if (typeof window === "undefined") return stringToColor(userId);
  return localStorage.getItem(COLOR_STORAGE_KEY) ?? stringToColor(userId);
}

export default function TldrawBoard({ boardId, workspaceId, userName, currentUserId, avatarUrl }: Props) {
  const [preview, setPreview] = useState<ApiAsset | null>(null);

  const isE2eMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("e2e") === "1";

  // tldraw の atom でリアクティブに色を管理（useSync の userInfo に Signal として渡す）
  const userInfoAtom = useMemo(() => atom("userInfo", {
    id: currentUserId,
    name: userName || "Unknown",
    color: getInitialColor(currentUserId),
  }), [currentUserId, userName]);

  const syncServerUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `ws://localhost:5858/sync/${boardId}`;
    }
    if (isE2eMode) {
      return `ws://${window.location.hostname}:5858/sync/${boardId}`;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/ws/sync/${boardId}`;
  }, [boardId, isE2eMode]);

  const store = useSync({
    uri: syncServerUrl,
    shapeUtils: CUSTOM_SHAPE_UTILS,
    userInfo: userInfoAtom,
    getUserPresence(tlStore, user) {
      const defaults = getDefaultUserPresence(tlStore, user);
      if (!defaults) return null;
      return {
        ...defaults,
        meta: { avatarUrl: avatarUrl ?? null },
      };
    },
  });

  const { registerHandler: registerFileDropHandler, uploadError } = useFileDropHandler(boardId, userName);
  const { registerListener: registerArrowDeleteListener } = useArrowCascadeDelete();
  const { registerListener: registerCreatedByListener } = useAutoCreatedBy(userName);
  const { registerHandler: registerDoubleClickHandler } = useDoubleClickPreview(setPreview);
  const { registerListener: registerUrlPreviewAttacher } = useUrlPreviewAttacher();

  const cameraStorageKey = `gachaboard:camera:${boardId}`;

  const handleMount = useCallback(
    (editor: Editor) => {
      if (isE2eMode) {
        (window as unknown as { __E2E_TLDRAW_EDITOR__?: Editor }).__E2E_TLDRAW_EDITOR__ = editor;
      }
      editor.setCameraOptions({ wheelBehavior: "zoom" });

      // カメラ位置を復元
      const savedCamera = localStorage.getItem(cameraStorageKey);
      if (savedCamera) {
        try {
          const { x, y, z } = JSON.parse(savedCamera);
          editor.setCamera({ x, y, z }, { animation: { duration: 0 } });
        } catch {
          // 無効なデータは無視
        }
      }

      // カメラ位置の変化を監視して保存
      const unsubscribe = editor.store.listen(
        () => {
          const camera = editor.getCamera();
          localStorage.setItem(cameraStorageKey, JSON.stringify({ x: camera.x, y: camera.y, z: camera.z }));
        },
        { source: "user", scope: "session" }
      );

      registerFileDropHandler(editor);
      registerArrowDeleteListener(editor);
      registerCreatedByListener(editor);
      registerDoubleClickHandler(editor);
      registerUrlPreviewAttacher(editor);

      return () => { unsubscribe(); };
    },
    [isE2eMode, cameraStorageKey, registerFileDropHandler, registerArrowDeleteListener, registerCreatedByListener, registerDoubleClickHandler, registerUrlPreviewAttacher]
  );

  const components = useMemo<TLComponents>(
    () => ({
      Toolbar: SmartHandToolbar,
      CollaboratorCursor: CollaboratorCursorWithName,
    }),
    []
  );

  return (
    <BoardContext.Provider value={{ boardId, workspaceId, currentUserId, avatarUrl: avatarUrl ?? null, userInfoAtom }}>
    <BoardReactionProvider>
      <div className="flex h-[100dvh] flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5 z-10 min-h-0">
          <Link href="javascript:history.back()" className="shrink-0 text-xs text-zinc-500 hover:underline">
            ← 戻る
          </Link>
          <div className="shrink-0">
            <SyncStatusBadge
              store={store}
              syncUrl={`/ws/sync/${boardId}`}
              boardId={boardId}
              userId={currentUserId}
            />
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="ml-auto shrink-0 rounded border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-50"
            title="URLをコピー"
            aria-label="URLをコピー"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 relative">
          <Tldraw
            store={store}
            shapeUtils={CUSTOM_SHAPE_UTILS}
            tools={CUSTOM_TOOLS}
            overrides={uiOverrides}
            components={components}
            initialState="select"
            onMount={handleMount}
          >
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-black/50 px-4 py-1.5 text-xs text-white opacity-50 select-none">
              ファイルをドロップして配置
            </div>
          </Tldraw>
        </div>

        {uploadError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-600 px-5 py-3 text-sm text-white shadow-lg">
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
    </BoardReactionProvider>
    </BoardContext.Provider>
  );
}
