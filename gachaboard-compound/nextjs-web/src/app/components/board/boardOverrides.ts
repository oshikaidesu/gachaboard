/**
 * compound 用 UI overrides。
 * SmartHandTool (id="select") を select / brush-select の 2 ボタンで制御。
 * draw・eraser は再クリックで select に戻るトグル動作。
 * geo ツールはツールバークリックで即配置。
 */

import type { TLUiOverrides, TLUiEventSource } from "@cmpd/compound";
import { toolbarItem } from "@cmpd/compound";
import {
  GeoShapeGeoStyle,
  createShapeId,
} from "@cmpd/editor";
import { brushModeAtom } from "@/app/tools/SmartHandTool";

export type BoardOverridesOptions = {
  onFileUploadAll: () => void;
};

const GEO_SIZES: Record<string, { w: number; h: number }> = {
  star: { w: 200, h: 190 },
  cloud: { w: 300, h: 180 },
  rectangle: { w: 200, h: 120 },
  ellipse: { w: 200, h: 120 },
  triangle: { w: 200, h: 120 },
  diamond: { w: 200, h: 120 },
  hexagon: { w: 200, h: 120 },
  octagon: { w: 200, h: 120 },
  oval: { w: 200, h: 120 },
  pentagon: { w: 200, h: 120 },
  heart: { w: 200, h: 120 },
  rhombus: { w: 200, h: 120 },
};

export function createBoardOverrides(options: BoardOverridesOptions): TLUiOverrides {
  const { onFileUploadAll } = options;
  return {
  actions(editor, actions) {
    return actions;
  },
  tools(editor, tools) {
    const next = { ...tools };

    // 単体キーショートカット（D/E/Z）を無効化（テキスト入力中の誤動作防止）
    const TOOLS_WITH_SINGLE_KEY_KBD = ["draw", "eraser", "zoom"];
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

    // ── draw / eraser トグル ──
    for (const toggleId of ["draw", "eraser"] as const) {
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
            const size = GEO_SIZES[geoId] ?? { w: 200, h: 120 };
            const scale = 1 / editor.getZoomLevel();
            const vp = editor.getViewportPageBounds();
            const cx = vp.x + vp.w / 2;
            const cy = vp.y + vp.h / 2;
            const id = createShapeId();
            editor.mark(`creating_geo:${id}`);
            editor.createShapes([
              {
                id,
                type: "geo",
                x: cx - (size.w * scale) / 2,
                y: cy - (size.h * scale) / 2,
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
                  w: size.w * scale,
                  h: size.h * scale,
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

    const ALLOWED_IDS = ["select", "draw", "eraser", "file-upload-all", "rectangle"];
    const filtered = schema
      .map((item) => {
        const id = item.toolItem?.id;
        if (!id || !ALLOWED_IDS.includes(id)) return null;
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
  actionsMenu(editor, schema) {
    const HIDE_ACTION_IDS = ["rotate-cw", "rotate-ccw", "toggle-dark-mode"];
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
