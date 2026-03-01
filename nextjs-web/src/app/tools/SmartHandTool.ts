import {
  EASINGS,
  SelectTool,
  StateNode,
  TLClickEventInfo,
  TLPointerEventInfo,
  TLStateNodeConstructor,
  atom,
  react,
} from "@tldraw/tldraw";

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

// ---- SmartHandIdle ----
// SelectTool の Idle を上書きして、カーソルとパン動作を変更する
class SmartHandIdle extends StateNode {
  static override id = "idle";

  override onEnter() {
    this.editor.setCursor({ type: "default", rotation: 0 });
  }

  override onPointerMove() {
    // ホバー中のシェイプ更新
    const { editor } = this;
    const hoveredShape = editor.getShapeAtPoint(
      editor.inputs.getCurrentPagePoint(),
      {
        margin: editor.options.hitTestMargin / editor.getZoomLevel(),
        hitInside: false,
        hitLabels: false,
        renderingOnly: true,
      }
    );
    const shapeToHover = hoveredShape
      ? editor.getOutermostSelectableShape(hoveredShape)
      : null;
    editor.setHoveredShape(shapeToHover?.id ?? null);
  }

  override onPointerDown(info: TLPointerEventInfo) {
    switch (info.target) {
      case "canvas": {
        // シェイプがあれば shape として処理
        const { editor } = this;
        const hitShape = editor.getShapeAtPoint(
          editor.inputs.getCurrentPagePoint(),
          {
            margin: editor.options.hitTestMargin / editor.getZoomLevel(),
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
        if (this.editor.getIsReadonly()) break;
        if (this.editor.inputs.getAltKey()) {
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
            if (
              info.ctrlKey &&
              this.editor.canCropShape(onlySelectedShape)
            ) {
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
  }

  override onDoubleClick(info: TLClickEventInfo) {
    if (info.phase !== "settle") return;
    // キャンバス上のダブルクリック → ズームイン（HandTool と同じ）
    if (info.target === "canvas") {
      const currentScreenPoint = this.editor.inputs.getCurrentScreenPoint();
      this.editor.zoomIn(currentScreenPoint, {
        animation: { duration: 220, easing: EASINGS.easeOutQuint },
      });
    }
  }

  override onCancel() {
    // Escape → 選択解除のみ（select ツールへの遷移はしない）
    this.editor.markHistoryStoppingPoint("clearing selection");
    this.editor.selectNone();
  }
}

// ---- SmartPointingCanvas ----
// 空白ドラッグ → パン移動、クリックのみ → 選択解除
class SmartPointingCanvas extends StateNode {
  static override id = "smart_pointing_canvas";

  initialCamera = { x: 0, y: 0, z: 1 };

  override onEnter() {
    this.editor.stopCameraAnimation();
    this.editor.setCursor({ type: "grabbing", rotation: 0 });
    const cam = this.editor.getCamera();
    this.initialCamera = { x: cam.x, y: cam.y, z: cam.z };

    // 選択解除
    if (this.editor.getSelectedShapeIds().length > 0) {
      this.editor.markHistoryStoppingPoint("selecting none");
      this.editor.selectNone();
    }
  }

  override onPointerMove() {
    if (this.editor.inputs.getIsDragging()) {
      this.updatePan();
    }
  }

  override onPointerUp() {
    this.complete();
  }

  override onCancel() {
    this.complete();
  }

  override onComplete() {
    this.complete();
  }

  override onInterrupt() {
    this.parent.transition("idle");
  }

  private updatePan() {
    const { editor, initialCamera } = this;
    const currentScreenPoint = editor.inputs.getCurrentScreenPoint();
    const originScreenPoint = editor.inputs.getOriginScreenPoint();
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
// id を 'select' にすることで、子ステートがハードコードしている
// 'select.editing_shape' / 'select.translating' などのパスがそのまま機能する
export class SmartHandTool extends StateNode {
  static override id = "select";
  static override initial = "idle";
  static override isLockable = false;

  reactor: undefined | (() => void) = undefined;

  static override children(): TLStateNodeConstructor[] {
    // SelectTool の子ステートをすべて取得して idle だけ上書き
    // pointing_canvas はそのまま残す（ブラシ選択に使用）
    const selectChildren = SelectTool.children();
    const filtered = selectChildren.filter((C) => C.id !== "idle");
    return [SmartHandIdle, SmartPointingCanvas, ...filtered];
  }

  override onEnter() {
    this.reactor = react("clean duplicate props", () => {
      try {
        const selectedShapeIds = this.editor.getSelectedShapeIds();
        const instance = this.editor.getInstanceState();
        if (!instance.duplicateProps) return;
        const duplicatedShapes = new Set(instance.duplicateProps.shapeIds);
        if (
          selectedShapeIds.length === duplicatedShapes.size &&
          selectedShapeIds.every((shapeId) => duplicatedShapes.has(shapeId))
        ) {
          return;
        }
        this.editor.updateInstanceState({ duplicateProps: null });
      } catch {
        // ignore
      }
    });
  }

  override onExit() {
    this.reactor?.();
    if (this.editor.getCurrentPageState().editingShapeId) {
      this.editor.setEditingShape(null);
    }
  }
}
