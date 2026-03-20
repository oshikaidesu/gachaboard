import {
  HIT_TEST_MARGIN,
  Matrix2d,
  SelectTool,
  StateNode,
  TLClickEventInfo,
  TLPointerEventInfo,
  TLStateNodeConstructor,
  atom,
} from "@cmpd/compound";
import { currentUserIdAtom } from "@/app/components/board/currentUserAtom";
import { PointingShapeArrowAware } from "./PointingShapeArrowAware";

/**
 * SmartHandTool — 万能ハンドツール
 *
 * SelectTool の全子ステートを継承しつつ、
 * - 空白ドラッグ → パン移動（isBrushMode ON 時はブラシ選択）
 * - マウスホイール → ズーム（setCameraOptions で設定）
 * - Escape → 選択解除のみ
 *
 * isBrushMode は UI パネルのボタンで切り替える。
 */

/** 範囲選択モードのグローバルフラグ（UI から読み書きする） */
export const brushModeAtom = atom("brushMode", false);

const ARROW_BEND_HANDLE_RADIUS_SCREEN_PX = { coarse: 20, fine: 12 } as const;
const ARROW_BEND_HANDLE_MIN_RADIUS_SCREEN_PX = 8;

function getSelectedArrowMiddleHandleHit(editor: StateNode["editor"]) {
  const selectedArrow = editor.getOnlySelectedShape();
  if (!selectedArrow || !editor.isShapeOfType(selectedArrow, "arrow")) {
    return null;
  }

  const middleHandle = editor.getShapeHandles(selectedArrow)?.find((handle) => handle.id === "middle");
  if (!middleHandle) {
    return null;
  }

  const transform = editor.getShapePageTransform(selectedArrow);
  const { scaleX, scaleY } = Matrix2d.Decompose(transform);
  const shapeToPageScale = Math.max(Math.abs(scaleX), Math.abs(scaleY), 1e-9);
  const zoom = editor.getZoomLevel();
  const radiusPx = editor.getInstanceState().isCoarsePointer
    ? ARROW_BEND_HANDLE_RADIUS_SCREEN_PX.coarse
    : ARROW_BEND_HANDLE_RADIUS_SCREEN_PX.fine;
  const combinedScale = Math.max(shapeToPageScale * zoom, 1e-9);
  const radius = Math.max(radiusPx / combinedScale, ARROW_BEND_HANDLE_MIN_RADIUS_SCREEN_PX / combinedScale);

  const pointInShapeSpace = editor.getPointInShapeSpace(
    selectedArrow,
    editor.inputs.currentPagePoint
  );
  const dx = pointInShapeSpace.x - middleHandle.x;
  const dy = pointInShapeSpace.y - middleHandle.y;

  if (dx * dx + dy * dy > radius * radius) {
    return null;
  }

  return { shape: selectedArrow, handle: middleHandle };
}

// ---- SmartHandIdle ----
// SelectTool の Idle を上書きして、カーソルとパン動作を変更する
class SmartHandIdle extends StateNode {
  static override id = "idle";

  override onEnter = () => {
    this.editor.setCursor({ type: "default", rotation: 0 });
  };

  override onPointerMove = () => {
    // ホバー中のシェイプ更新
    const { editor } = this;
    const hoveredShape = editor.getShapeAtPoint(
      editor.inputs.currentPagePoint,
      {
        margin: HIT_TEST_MARGIN / editor.getZoomLevel(),
        hitInside: false,
        hitLabels: false,
        renderingOnly: true,
      }
    );
    const shapeToHover = hoveredShape
      ? editor.getOutermostSelectableShape(hoveredShape)
      : null;
    editor.setHoveredShape(shapeToHover?.id ?? null);
  };

  override onPointerDown = (info: TLPointerEventInfo) => {
    const middleHandleHit =
      !this.editor.getInstanceState().isReadonly && !this.editor.inputs.altKey
        ? getSelectedArrowMiddleHandleHit(this.editor)
        : null;

    if (middleHandleHit) {
      this.parent.transition("pointing_handle", {
        ...info,
        target: "handle",
        shape: middleHandleHit.shape,
        handle: middleHandleHit.handle,
      });
      return;
    }

    switch (info.target) {
      case "canvas": {
        // シェイプがあれば shape として処理
        const { editor } = this;
        const hitShape = editor.getShapeAtPoint(
          editor.inputs.currentPagePoint,
          {
            margin: HIT_TEST_MARGIN / editor.getZoomLevel(),
            hitInside: false,
            renderingOnly: true,
          }
        );
        if (hitShape && !hitShape.isLocked) {
          this.onPointerDown({ ...info, shape: hitShape, target: "shape" });
          return;
        }

        // 範囲選択モード ON または Shift キー → ブラシ選択、それ以外 → パン
        if (brushModeAtom.get() || info.shiftKey) {
          this.parent.transition("pointing_canvas", info);
        } else {
          this.parent.transition("smart_pointing_canvas", info);
        }
        break;
      }
      case "shape": {
        if (this.editor.isShapeOrAncestorLocked(info.shape)) {
          this.parent.transition("smart_pointing_canvas", info);
          break;
        }
        this.parent.transition("pointing_shape", info);
        break;
      }
      case "handle": {
        if (this.editor.getInstanceState().isReadonly) break;
        if (this.editor.inputs.altKey) {
          this.parent.transition("pointing_shape", info);
        } else {
          this.parent.transition("pointing_handle", info);
        }
        break;
      }
      case "selection": {
        switch (info.handle) {
          case "mobile_rotate":
          case "top_left_rotate":
          case "top_right_rotate":
          case "bottom_left_rotate":
          case "bottom_right_rotate": {
            this.parent.transition("pointing_rotate_handle", info);
            break;
          }
          case "top":
          case "right":
          case "bottom":
          case "left":
          case "top_left":
          case "top_right":
          case "bottom_left":
          case "bottom_right": {
            const onlySelectedShape = this.editor.getOnlySelectedShape();
            const canCrop =
              onlySelectedShape &&
              !this.editor.isShapeOrAncestorLocked(onlySelectedShape) &&
              this.editor.getShapeUtil(onlySelectedShape).canCrop(onlySelectedShape);
            if (info.ctrlKey && canCrop) {
              this.parent.transition("crop.pointing_crop_handle", info);
            } else {
              this.parent.transition("pointing_resize_handle", info);
            }
            break;
          }
          default: {
            const hoveredShape = this.editor.getHoveredShape();
            if (
              hoveredShape &&
              !this.editor.getSelectedShapeIds().includes(hoveredShape.id) &&
              !hoveredShape.isLocked
            ) {
              this.onPointerDown({
                ...info,
                shape: hoveredShape,
                target: "shape",
              });
              return;
            }
            this.parent.transition("pointing_selection", info);
          }
        }
        break;
      }
    }
  };

  override onDoubleClick = (info: TLClickEventInfo) => {
    if (info.phase !== "settle") return;

    let shape = info.target === "shape" ? info.shape : null;
    if (!shape && info.target === "canvas") {
      shape = this.editor.getShapeAtPoint(
        this.editor.inputs.currentPagePoint,
        {
          margin: HIT_TEST_MARGIN / this.editor.getZoomLevel(),
          hitInside: true,
          renderingOnly: true,
        }
      ) ?? null;
    }

    if (shape && !this.editor.isShapeOrAncestorLocked(shape)) {
      const util = this.editor.getShapeUtil(shape);
      if (this.editor.isShapeOfType(shape, "geo")) {
        const meta = shape.meta as Record<string, unknown> | undefined;
        const openEdit = meta?.openEdit === true;
        if (!openEdit) {
          const createdById = meta?.createdById as string | undefined;
          if (createdById && createdById !== currentUserIdAtom.get()) {
            return;
          }
        }
      }
      if (util.canEdit(shape)) {
        this.editor.batch(() => {
          this.editor.mark("editing on double click");
          this.editor.select(shape!.id);
          this.editor.setEditingShape(shape!.id);
          this.editor.setCurrentTool("select.editing_shape");
        });
        return;
      }
    }

    // キャンバス上のダブルタップでズームインは無効化（誤タップ防止）
  };

  override onCancel = () => {
    // Escape → 選択解除のみ（select ツールへの遷移はしない）
    this.editor.mark("clearing selection");
    this.editor.selectNone();
  };

}

// ---- SmartPointingCanvas ----
// 空白ドラッグ → パン移動、クリックのみ → 選択解除
class SmartPointingCanvas extends StateNode {
  static override id = "smart_pointing_canvas";

  initialCamera = { x: 0, y: 0, z: 1 };

  override onEnter = () => {
    this.editor.stopCameraAnimation();
    this.editor.setCursor({ type: "grabbing", rotation: 0 });
    const cam = this.editor.getCamera();
    this.initialCamera = { x: cam.x, y: cam.y, z: cam.z };

    // 選択解除
    if (this.editor.getSelectedShapeIds().length > 0) {
      this.editor.mark("selecting none");
      this.editor.selectNone();
    }
  };

  override onPointerMove = () => {
    if (this.editor.inputs.isDragging) {
      this.updatePan();
    }
  };

  override onPointerUp = () => {
    this.complete();
  };

  override onCancel = () => {
    this.complete();
  };

  override onComplete = () => {
    this.complete();
  };

  override onInterrupt = () => {
    this.parent.transition("idle");
  };

  private updatePan() {
    const { editor, initialCamera } = this;
    const currentScreenPoint = editor.inputs.currentScreenPoint;
    const originScreenPoint = editor.inputs.originScreenPoint;
    const delta = {
      x: (currentScreenPoint.x - originScreenPoint.x) / editor.getZoomLevel(),
      y: (currentScreenPoint.y - originScreenPoint.y) / editor.getZoomLevel(),
    };
    editor.setCamera({
      x: initialCamera.x + delta.x,
      y: initialCamera.y + delta.y,
      z: initialCamera.z,
    });
  }

  private complete() {
    this.parent.transition("idle");
  }
}

// ---- SmartHandTool ----
// 別 id で追加し、ツールバーで select の代わりに表示する（上書きはしない）
export class SmartHandTool extends StateNode {
  static override id = "select";
  static override initial = "idle";

  reactor: undefined | (() => void) = undefined;

  static override children = (): TLStateNodeConstructor[] => {
    const selectChildren = SelectTool.children();
    const filtered = selectChildren.filter(
      (C) => C.id !== "idle" && C.id !== "pointing_shape"
    );
    return [SmartHandIdle, SmartPointingCanvas, PointingShapeArrowAware, ...filtered];
  };

  override onEnter = () => {
    // compound does not have duplicateProps; reactor kept for future use
    this.reactor = undefined;
  };

  override onExit = () => {
    this.reactor?.();
    try {
      if (this.editor.getEditingShapeId()) {
        this.editor.setEditingShape(null);
      }
    } catch {
      // state machine 遷移中の競合を安全に無視
    }
  };
}
