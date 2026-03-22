/**
 * compound 用 UI overrides。
 * SmartHandTool (id="select") を select / brush-select の 2 ボタンで制御。
 * draw・eraser は再クリックで select に戻るトグル動作。
 * 消しゴムはデフォルトロック（ツール右上に表示）。2 回タップで解除して有効化（2 回目に時間制限なし）。E2E ではスキップ可。
 * geo ツールはツールバークリックで即配置。
 */

import type { TLUiOverrides, TLUiEventSource } from "@cmpd/compound";
import { toolbarItem } from "@cmpd/compound";
import {
  GeoShapeGeoStyle,
  createShapeId,
  Box2d,
} from "@cmpd/editor";
import { brushModeAtom } from "@/app/tools/SmartHandTool";
import { eraserLockAtom, eraserSecondTapPendingAtom } from "@/app/tools/eraserLockAtom";
import {
  GEO_SIZES,
  GEO_DEFAULT_SIZE,
  TOOLBAR_ALLOWED_IDS,
  HIDE_ACTION_IDS,
  CONTEXT_MENU_ENABLED,
  ACTIONS_DISABLE_KBD_IDS,
} from "./boardOverridesConfig";

export type BoardOverridesOptions = {
  onFileUploadAll: () => void;
  /** true のとき消しゴムのロックを使わない（E2E 用） */
  skipEraserConfirm?: boolean;
};

export function createBoardOverrides(options: BoardOverridesOptions): TLUiOverrides {
  const { onFileUploadAll, skipEraserConfirm } = options;
  return {
  actions(editor, actions) {
    const next = { ...actions };
    // ショートカットを無効化（ツールロック・Cmd+S・Cmd+E など誤爆防止）
    for (const id of ACTIONS_DISABLE_KBD_IDS) {
      if (next[id]) next[id] = { ...next[id], kbd: undefined };
    }
    // 複製（Cmd/Ctrl+D）を GEO シェイプのみに制限（他シェイプは依存関係でバグが発生するため）
    if (next["duplicate"]) {
      const origDuplicate = next["duplicate"];
      next["duplicate"] = {
        ...origDuplicate,
        onSelect() {
          const ids = editor.getSelectedShapeIds();
          if (ids.length === 0) return;
          const allGeo = ids.every((id) => {
            const shape = editor.getShape(id);
            return shape && editor.isShapeOfType(shape, "geo");
          });
          if (!allGeo) return; // GEO 以外が含まれる場合は何もしない
          const bounds = ids
            .map((id) => editor.getShapePageBounds(id))
            .filter((b): b is NonNullable<typeof b> => b != null);
          const commonBounds = Box2d.Common(bounds);
          const offset = editor.getInstanceState().canMoveCamera
            ? { x: commonBounds.width + 10, y: 0 }
            : { x: 16 / editor.getZoomLevel(), y: 16 / editor.getZoomLevel() };
          editor.mark("duplicate shapes");
          editor.duplicateShapes(ids, offset);
        },
      };
    }
    return next;
  },
  tools(editor, tools) {
    const next = { ...tools };

    // 単体キーショートカットを無効化（テキスト入力中の誤動作防止）
    // v=select, h=hand, e=eraser, d/b/x=draw, r=rectangle, o=ellipse, a=arrow, l=line, f=frame, t=text, n=note, k=laser
    const TOOLS_WITH_SINGLE_KEY_KBD = [
      "select",
      "hand",
      "draw",
      "eraser",
      "rectangle",
      "ellipse",
      "arrow",
      "line",
      "frame",
      "text",
      "note",
      "laser",
    ];
    for (const id of TOOLS_WITH_SINGLE_KEY_KBD) {
      if (next[id]) next[id] = { ...next[id], kbd: undefined };
    }

    // ── 通常選択（ポインタ）: brushMode OFF で select ──
    if (next["select"]) {
      const { kbd: _kbd, ...rest } = next["select"];
      next["select"] = {
        ...rest,
        kbd: undefined,
        onSelect() {
          brushModeAtom.set(false);
          eraserSecondTapPendingAtom.set(false);
          editor.setCurrentTool("select");
        },
      };
    }

    // ── 範囲選択（マーキー）: brushMode ON で select ──
    next["brush-select"] = {
      id: "brush-select",
      label: "tool.brush-select" as any,
      icon: "tool-marquee",
      readonlyOk: true,
      onSelect() {
        brushModeAtom.set(true);
        eraserSecondTapPendingAtom.set(false);
        editor.setCurrentTool("select");
      },
    };

    // ── 全ファイルアップロード: 画像以外も含む ──
    next["file-upload-all"] = {
      id: "file-upload-all",
      label: "tool.file-upload-all" as any,
      icon: "tool-file-upload",
      readonlyOk: false,
      onSelect() {
        onFileUploadAll();
        editor.setCurrentTool("select");
      },
    };

    // ── draw トグル ──
    for (const toggleId of ["draw"] as const) {
      if (next[toggleId]) {
        const orig = next[toggleId];
        let lastTime = 0;
        next[toggleId] = {
          ...orig,
          onSelect(source: TLUiEventSource) {
            const now = Date.now();
            if (now - lastTime < 300) return;
            lastTime = now;

            if (brushModeAtom.get()) brushModeAtom.set(false);

            if (editor.getCurrentToolId() === toggleId) {
              editor.setCurrentTool("select");
              return;
            }

            orig.onSelect(source);
          },
        };
      }
    }

    // ── eraser トグル（ロック中は 2 回タップで解除してから有効化。2 回目に時間制限なし）──
    if (next["eraser"]) {
      const orig = next["eraser"];
      let lastTime = 0;
      next["eraser"] = {
        ...orig,
        onSelect(source: TLUiEventSource) {
          if (brushModeAtom.get()) brushModeAtom.set(false);

          if (editor.getCurrentToolId() === "eraser") {
            editor.setCurrentTool("select");
            if (!skipEraserConfirm) {
              eraserLockAtom.set(true);
              eraserSecondTapPendingAtom.set(false);
            }
            return;
          }

          if (skipEraserConfirm) {
            const now = Date.now();
            if (now - lastTime < 300) return;
            lastTime = now;
            eraserLockAtom.set(false);
            eraserSecondTapPendingAtom.set(false);
            orig.onSelect(source);
            return;
          }

          const now = Date.now();

          if (!eraserLockAtom.get()) {
            if (now - lastTime < 300) return;
            lastTime = now;
            eraserSecondTapPendingAtom.set(false);
            orig.onSelect(source);
            return;
          }

          if (eraserSecondTapPendingAtom.get()) {
            eraserLockAtom.set(false);
            eraserSecondTapPendingAtom.set(false);
            lastTime = now;
            orig.onSelect(source);
            return;
          }
          eraserSecondTapPendingAtom.set(true);
        },
      };
    }

    // ── geo ツール: 再クリックで select、ツールバーから即配置 ──
    for (const key of Object.keys(next)) {
      const tool = next[key];
      if (!tool || !(tool.meta as { geo?: string })?.geo) continue;
      if (key === "select" || key === "brush-select") continue;

      const geoId = (tool.meta as { geo: string }).geo;
      const originalOnSelect = tool.onSelect?.bind(tool);
      let lastCallTime = 0;

      next[key] = {
        ...tool,
        onSelect(source: TLUiEventSource) {
          const now = Date.now();
          if (now - lastCallTime < 300) return;
          lastCallTime = now;

          if (brushModeAtom.get()) brushModeAtom.set(false);

          const activeToolId = editor.getCurrentToolId();
          const currentGeo = editor.getSharedStyles().getAsKnownValue(GeoShapeGeoStyle);

          if (activeToolId === "geo" && currentGeo === geoId) {
            editor.setCurrentTool("select");
            return;
          }

          if (source === "toolbar") {
            const size = GEO_SIZES[geoId] ?? GEO_DEFAULT_SIZE;
            const vp = editor.getViewportPageBounds();
            const cx = vp.x + vp.w / 2;
            const cy = vp.y + vp.h / 2;
            const id = createShapeId();
            editor.mark(`creating_geo:${id}`);
            editor.createShapes([
              {
                id,
                type: "geo",
                x: cx - size.w / 2,
                y: cy - size.h / 2,
                props: {
                  geo: geoId as
                    | "rectangle"
                    | "ellipse"
                    | "triangle"
                    | "diamond"
                    | "star"
                    | "cloud"
                    | "heart"
                    | "hexagon"
                    | "octagon"
                    | "oval"
                    | "pentagon"
                    | "rhombus",
                  w: size.w,
                  h: size.h,
                },
              },
            ]);
            editor.batch(() => {
              editor.select(id);
              editor.setEditingShape(id);
              editor.setCurrentTool("select.editing_shape");
            });
            return;
          }

          originalOnSelect?.(source);
        },
      };
    }

    return next;
  },
  toolbar(editor, schema, { tools }) {
    const selectTool = tools["select"];
    const brushSelectTool = tools["brush-select"];
    const fileUploadAllTool = tools["file-upload-all"];
    if (!selectTool) return schema;

    const filtered = schema
      .map((item) => {
        const id = item.toolItem?.id;
        if (!id || !TOOLBAR_ALLOWED_IDS.includes(id)) return null;
        if (id === "select") return toolbarItem(selectTool);
        return item;
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    // select の直後に brush-select を挿入
    if (brushSelectTool) {
      const selectIdx = filtered.findIndex((i) => i.toolItem?.id === "select");
      filtered.splice(selectIdx + 1, 0, toolbarItem(brushSelectTool));
    }

    // asset は非表示（file-upload-all で代替）。file-upload-all を挿入
    if (fileUploadAllTool) {
      const drawIdx = filtered.findIndex((i) => i.toolItem?.id === "draw");
      if (drawIdx >= 0) {
        filtered.splice(drawIdx + 2, 0, toolbarItem(fileUploadAllTool)); // draw, eraser の後に挿入
      } else {
        filtered.push(toolbarItem(fileUploadAllTool));
      }
    }

    return filtered;
  },
  contextMenu(_editor, schema) {
    if (!CONTEXT_MENU_ENABLED) return [];
    return schema;
  },
  actionsMenu(editor, schema) {
    if (!CONTEXT_MENU_ENABLED) return [];
    return schema.filter(
      (item) =>
        item.type !== "item" ||
        !("actionItem" in item) ||
        !HIDE_ACTION_IDS.includes(item.actionItem?.id ?? "")
    );
  },
  translations: {
    ja: {
      "tool.brush-select": "範囲選択",
      "tool.file-upload-all": "全ファイルアップロード",
      "action.fit-frame-to-content": "コンテンツに合わせる",
      "action.remove-frame": "フレームを削除",
    },
  },
};
}
