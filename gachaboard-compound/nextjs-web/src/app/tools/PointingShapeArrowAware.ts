/**
 * PointingShape の代替。矢印シェイプではドラッグ閾値を大きくし、
 * うっかり触っただけでは接続が切れないようにする。
 *
 * デフォルトの dragDistanceSquared (16 = 4px) の代わりに、
 * 矢印のときは ARROW_DRAG_THRESHOLD_SQ を満たすまで translating へ遷移しない。
 */

import {
  HIT_TEST_MARGIN,
  StateNode,
  type TLPointerEventInfo,
  type TLShape,
} from "@cmpd/compound";

/** 矢印用ドラッグ閾値（Infinity = ドラッグ移動を無効化、負荷なし） */
const ARROW_DRAG_THRESHOLD_SQ = Infinity;

/**
 * compound の PointingShape と同等のロジックを持ち、
 * 矢印のときのみ onPointerMove で閾値を厳格化する。
 */
export class PointingShapeArrowAware extends StateNode {
  static override id = "pointing_shape";

  hitShape = {} as TLShape;
  hitShapeForPointerUp = {} as TLShape;
  didSelectOnEnter = false;

  override onEnter = (info: TLPointerEventInfo & { target: "shape" }) => {
    const selectedShapeIds = this.editor.getSelectedShapeIds();
    const selectionBounds = this.editor.getSelectionRotatedPageBounds();
    const focusedGroupId = this.editor.getFocusedGroupId();
    const { currentPagePoint, shiftKey, altKey } = this.editor.inputs;

    this.hitShape = info.shape;
    const outermostSelectingShape = this.editor.getOutermostSelectableShape(info.shape);
    if (
      this.editor.getShapeUtil(info.shape).onClick ||
      outermostSelectingShape.id === focusedGroupId ||
      selectedShapeIds.includes(outermostSelectingShape.id) ||
      this.editor.isAncestorSelected(outermostSelectingShape.id) ||
      (selectedShapeIds.length > 1 && selectionBounds?.containsPoint(currentPagePoint))
    ) {
      this.didSelectOnEnter = false;
      this.hitShapeForPointerUp = outermostSelectingShape;
      return;
    }
    this.didSelectOnEnter = true;
    if (shiftKey && !altKey) {
      this.editor.cancelDoubleClick();
      if (!selectedShapeIds.includes(outermostSelectingShape.id)) {
        this.editor.mark("shift selecting shape");
        this.editor.setSelectedShapes([...selectedShapeIds, outermostSelectingShape.id]);
      }
    } else {
      this.editor.mark("selecting shape");
      this.editor.setSelectedShapes([outermostSelectingShape.id]);
    }
  };

  override onPointerUp = (info: TLPointerEventInfo) => {
    const selectedShapeIds = this.editor.getSelectedShapeIds();
    const focusedGroupId = this.editor.getFocusedGroupId();
    const zoomLevel = this.editor.getZoomLevel();
    const { currentPagePoint, shiftKey } = this.editor.inputs;

    const hitShape =
      this.editor.getShapeAtPoint(currentPagePoint, {
        margin: HIT_TEST_MARGIN / zoomLevel,
        hitInside: true,
        renderingOnly: true,
      }) ?? this.hitShape;
    const selectingShape = hitShape
      ? this.editor.getOutermostSelectableShape(hitShape)
      : this.hitShapeForPointerUp;

    if (selectingShape) {
      const util = this.editor.getShapeUtil(selectingShape);
      if (util.onClick) {
        const change = util.onClick?.(selectingShape);
        if (change) {
          this.editor.mark("shape on click");
          this.editor.updateShapes([change]);
          this.parent.transition("idle", info);
          return;
        }
      }
      if (selectingShape.id === focusedGroupId) {
        if (selectedShapeIds.length > 0) {
          this.editor.mark("clearing shape ids");
          this.editor.setSelectedShapes([]);
        } else {
          this.editor.popFocusedGroupId();
        }
        this.parent.transition("idle", info);
        return;
      }
    }

    if (!this.didSelectOnEnter) {
      const outermostSelectableShape = this.editor.getOutermostSelectableShape(
        hitShape,
        (parent) => !selectedShapeIds.includes(parent.id)
      );
      if (selectedShapeIds.includes(outermostSelectableShape.id)) {
        if (shiftKey) {
          this.editor.mark("deselecting on pointer up");
          this.editor.deselect(selectingShape);
        } else {
          if (selectedShapeIds.includes(selectingShape.id)) {
            if (
              selectedShapeIds.length === 1 &&
              this.editor.isShapeOfType(selectingShape, "arrow")
            ) {
              const geometry = this.editor.getShapeGeometry(selectingShape) as {
                children?: Array<{ bounds: { containsPoint: (p: unknown, t: number) => boolean }; hitTestPoint: (p: unknown) => boolean }>;
              };
              const labelGeometry = geometry.children?.[1];
              if (labelGeometry) {
                const pointInShapeSpace = this.editor.getPointInShapeSpace(
                  selectingShape,
                  currentPagePoint
                );
                if (
                  labelGeometry.bounds.containsPoint(pointInShapeSpace, 0) &&
                  labelGeometry.hitTestPoint(pointInShapeSpace)
                ) {
                  this.editor.batch(() => {
                    this.editor.mark("editing on pointer up");
                    this.editor.select(selectingShape.id);
                    const util = this.editor.getShapeUtil(selectingShape);
                    if (this.editor.getInstanceState().isReadonly) {
                      if (!util.canEditInReadOnly(selectingShape)) return;
                    }
                    this.editor.setEditingShape(selectingShape.id);
                    this.editor.setCurrentTool("select.editing_shape");
                  });
                  return;
                }
              }
            }
            this.editor.mark("selecting on pointer up");
            this.editor.select(selectingShape.id);
          } else {
            this.editor.mark("selecting on pointer up");
            this.editor.select(selectingShape);
          }
        }
      } else if (shiftKey) {
        const ancestors = this.editor.getShapeAncestors(outermostSelectableShape);
        this.editor.mark("shift deselecting on pointer up");
        this.editor.setSelectedShapes([
          ...this.editor.getSelectedShapeIds().filter(
            (id) => !ancestors.find((a) => a.id === id)
          ),
          outermostSelectableShape.id,
        ]);
      } else {
        this.editor.mark("selecting on pointer up");
        this.editor.setSelectedShapes([outermostSelectableShape.id]);
      }
    }

    this.parent.transition("idle", info);
  };

  override onPointerMove = (info: TLPointerEventInfo) => {
    if (!this.editor.inputs.isDragging) return;
    if (this.editor.getInstanceState().isReadonly) return;

    // 矢印のときは閾値を厳格化（12px 以上動いたときだけ translating へ）
    if (this.editor.isShapeOfType(this.hitShape, "arrow")) {
      const { originScreenPoint, currentScreenPoint } = this.editor.inputs;
      const dx = currentScreenPoint.x - originScreenPoint.x;
      const dy = currentScreenPoint.y - originScreenPoint.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < ARROW_DRAG_THRESHOLD_SQ) return;
    }

    this.parent.transition("translating", info);
  };

  override onCancel = () => {
    this.cancel();
  };

  override onComplete = () => {
    this.cancel();
  };

  override onInterrupt = () => {
    this.cancel();
  };

  private cancel() {
    this.parent.transition("idle");
  }
}
