"use client";

/**
 * tldraw 組み込みシェイプ（image / note / text / geo / arrow）に
 * CreatorLabel と ShapeReactionPanel を追加するための薄いラッパー。
 *
 * 型で区分けして個別クラス化。共通のラップ処理は renderWithExtras に集約。
 */

import {
  HTMLContainer,
  ImageShapeUtil,
  NoteShapeUtil,
  GeoShapeUtil,
  TextShapeUtil,
  ArrowShapeUtil,
  Editor,
  TLGeoShape,
  TLArrowShape,
  TLDefaultColorStyle,
  type TLShape,
  useEditor,
} from "@cmpd/compound";
import {
  CreatorLabel,
  getCreatedBy,
  getCreatedByAvatarUrl,
  getCreationRank,
  ShapeReactionPanel,
  ShapeConnectHandles,
  OgpPreview,
  DownloadButton,
  FileSizeLabel,
  getColorForShape,
} from "./common";
import { getSafeAssetId } from "@/lib/safeUrl";
import { currentUserIdAtom } from "@/app/components/board/currentUserAtom";

/** タッチで切り替えた直後の click 二重実行を防ぐため（geo オープン切替ボタン用） */
const lastTouchEndByGeoShapeId = new Map<string, number>();

// ---------- 共通ラップヘルパー ---------------------------------------------------

type ShapeWithOptionalSize = TLShape & { props: { w?: number; h?: number } };

/**
 * CreatorLabel + baseContent + ShapeReactionPanel + ShapeConnectHandles の共通レイアウト。
 * Note / Text の単純ラッパーで使用。
 */
function renderWithExtras(
  shape: ShapeWithOptionalSize,
  baseContent: React.ReactNode,
  editor: Editor
): React.ReactElement {
  const w = shape.props.w;
  const h = shape.props.h;
  const hasSize = w !== undefined && h !== undefined;

  if (hasSize) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: w, height: h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel
          name={getCreatedBy(shape)}
          avatarUrl={getCreatedByAvatarUrl(shape)}
          rank={getCreationRank(editor, shape)}
        />
        {baseContent}
        <div
          style={{
            position: "absolute",
            top: h,
            left: 0,
            width: w,
            pointerEvents: "none",
          }}
        >
          <ShapeReactionPanel
            shapeId={shape.id}
            containerStyle={{
              position: "static",
              marginTop: 4,
              pointerEvents: "all",
            }}
          />
        </div>
        <ShapeConnectHandles shapeId={shape.id} w={w} h={h} />
      </HTMLContainer>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "visible", width: "100%", height: "100%" }}>
      <CreatorLabel name={getCreatedBy(shape)} rank={getCreationRank(editor, shape)} />
      {baseContent}
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: 0,
          width: "100%",
          pointerEvents: "none",
        }}
      >
        <ShapeReactionPanel
          shapeId={shape.id}
          containerStyle={{
            position: "static",
            marginTop: 4,
            pointerEvents: "all",
          }}
        />
      </div>
    </div>
  );
}

// ---------- 個別クラス（Image / Note / Text） -----------------------------------

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  backgroundColor: "#c0c0c0",
};

export class WrappedImageShapeUtil extends ImageShapeUtil {
  override isAspectRatioLocked = () => true;

  override component(shape: Parameters<ImageShapeUtil["component"]>[0]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editor = useEditor();
    const base = super.component(shape);
    const { w, h, assetId } = shape.props;

    const asset = assetId ? editor.getAsset(assetId) : null;
    const src: string = (asset?.props as { src?: string } | undefined)?.src ?? "";
    const rawApiAssetId = src.match(/\/api\/assets\/([^/]+)\/file/)?.[1] ?? "";
    const apiAssetId = getSafeAssetId(rawApiAssetId) ?? "";
    const fileName: string = (asset?.props as { name?: string } | undefined)?.name ?? "image";

    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: w, height: h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel
          name={getCreatedBy(shape)}
          avatarUrl={getCreatedByAvatarUrl(shape)}
          rank={getCreationRank(editor, shape)}
        />
        {/* チェッカー背景（透過画像用）+ 画像を比率通りに表示 */}
        <div style={{ position: "absolute", inset: 0, ...CHECKER_STYLE }}>
          {base}
        </div>
        {/* ダウンロードボタン＋ファイルサイズ（右上） */}
        {apiAssetId && (
          <div style={{ position: "absolute", top: 4, right: 4, display: "flex", alignItems: "center", gap: 4, zIndex: 10, pointerEvents: "all" }}>
            <FileSizeLabel sizeBytes={shape.meta?.sizeBytes as string | undefined}
              style={{ background: "rgba(0,0,0,0.45)", color: "#fff", borderRadius: 4, padding: "2px 5px" }}
            />
            <DownloadButton
              assetId={apiAssetId}
              fileName={fileName}
              style={{
                width: 28,
                height: 28,
                background: "rgba(0,0,0,0.45)",
                color: "#fff",
                border: "none",
                fontSize: 14,
                pointerEvents: "all",
              }}
            />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: h,
            left: 0,
            width: w,
            pointerEvents: "none",
          }}
        >
          <ShapeReactionPanel
            shapeId={shape.id}
            containerStyle={{ position: "static", marginTop: 4, pointerEvents: "all" }}
          />
        </div>
        <ShapeConnectHandles shapeId={shape.id} w={w} h={h} />
      </HTMLContainer>
    );
  }
}

export class WrappedNoteShapeUtil extends NoteShapeUtil {
  override component(shape: Parameters<NoteShapeUtil["component"]>[0]) {
    const editor = useEditor();
    const base = super.component(shape);
    return renderWithExtras(shape, base, editor);
  }
}

export class WrappedTextShapeUtil extends TextShapeUtil {
  override onBeforeCreate = (shape: Parameters<TextShapeUtil["onBeforeCreate"]>[0]) => ({
    ...shape,
    props: { ...shape.props, font: "mono" as const },
  });

  override component(shape: Parameters<TextShapeUtil["component"]>[0]) {
    const editor = useEditor();
    const base = super.component(shape);
    return renderWithExtras(shape, base, editor);
  }
}

// ---------- 個別実装（独自ロジックあり） ------------------------------------

export class WrappedGeoShapeUtil extends GeoShapeUtil {
  override getDefaultProps(): TLGeoShape["props"] {
    return { ...super.getDefaultProps(), w: 200, h: 120 };
  }

  override onBeforeCreate = (shape: TLGeoShape): TLGeoShape | undefined => ({
    ...shape,
    props: {
      ...shape.props,
      color: getColorForShape(shape.id),
      fill: "solid",
      dash: "solid",
      font: "mono",
    },
  });

  override component(shape: TLGeoShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editor = useEditor();
    const createdBy = getCreatedBy(shape);
    const strokeColor = shape.props.color;
    const { w, h } = shape.props;
    const geoMeta = (shape.meta as Record<string, unknown> | undefined) ?? {};
    const rawGeoOgpUrls = geoMeta.ogpUrls;
    const ogpUrls: string[] = Array.isArray(rawGeoOgpUrls) ? rawGeoOgpUrls as string[] : [];

    const isOwner = !geoMeta.createdById || geoMeta.createdById === currentUserIdAtom.get();
    const handleDismiss = ogpUrls.length > 0 && isOwner
      ? (url: string) => {
          const next = ogpUrls.filter((u) => u !== url);
          editor.updateShape({
            id: shape.id,
            type: shape.type,
            meta: { ...geoMeta, ogpUrls: next },
          });
        }
      : undefined;

    // greyFill: text:"" で TextLabel を非マウント化。編集中も CSS display:none で textarea を無効化
    const greyFill = super.component({
      ...shape,
      props: { ...shape.props, color: "grey" as TLDefaultColorStyle, fill: "solid" as const, text: "" },
    });

    // coloredStroke: 本物の TextLabel（textarea）を持つ唯一のレイヤー
    const coloredStroke = super.component({
      ...shape,
      props: { ...shape.props, color: strokeColor, fill: "none" as const },
    });

    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: w, height: h, position: "relative", overflow: "visible" }}
      >
        <CreatorLabel
          name={createdBy}
          avatarUrl={getCreatedByAvatarUrl(shape)}
          rank={getCreationRank(editor, shape)}
          rightSlot={
            isOwner ? (
              <button
                type="button"
                title={geoMeta.openEdit === true ? "みんなで編集（誰でも編集可能）" : "ソロで編集（作成者のみ）"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    lastTouchEndByGeoShapeId.has(shape.id) &&
                    Date.now() - (lastTouchEndByGeoShapeId.get(shape.id) ?? 0) < 400
                  ) {
                    lastTouchEndByGeoShapeId.delete(shape.id);
                    return;
                  }
                  editor.updateShape({
                    id: shape.id,
                    type: shape.type,
                    meta: { ...geoMeta, openEdit: !geoMeta.openEdit },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: shape.type,
                    meta: { ...geoMeta, openEdit: !geoMeta.openEdit },
                  });
                  lastTouchEndByGeoShapeId.set(shape.id, Date.now());
                }}
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  border: "none",
                  borderRadius: 3,
                  background: "transparent",
                  cursor: "pointer",
                  touchAction: "manipulation",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >
                {geoMeta.openEdit === true ? (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                      fill="#22c55e"
                    />
                  </svg>
                ) : (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                      fill="#9ca3af"
                    />
                  </svg>
                )}
              </button>
            ) : geoMeta.openEdit === true ? (
              <span
                title="みんなで編集（誰でも編集可能）"
                style={{
                  width: 20,
                  height: 20,
                  padding: 0,
                  borderRadius: 3,
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                    fill="#22c55e"
                  />
                </svg>
              </span>
            ) : undefined
          }
        />
        <div className="geo-svg-only" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}>
          {greyFill}
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none" }}>
          {coloredStroke}
        </div>
        {/* OGP プレビュー + リアクションパネルを下部に配置 */}
        <div
          style={{
            position: "absolute",
            top: h,
            left: 0,
            width: w,
            pointerEvents: "none",
          }}
        >
          {ogpUrls.length > 0 && (
            <OgpPreview ogpUrls={ogpUrls} width={w} onDismiss={handleDismiss} />
          )}
          <ShapeReactionPanel
            shapeId={shape.id}
            containerStyle={{
              position: "static",
              marginTop: 4,
              pointerEvents: "all",
            }}
          />
        </div>
        <ShapeConnectHandles shapeId={shape.id} w={w} h={h} />
      </HTMLContainer>
    );
  }
}

function getSourceShapeColor(editor: Editor, arrow: TLArrowShape): TLDefaultColorStyle {
  const start = arrow.props.start;
  if (start.type === "binding") {
    const src = editor.getShape(start.boundShapeId);
    if (!src) return getColorForShape(arrow.id);
    const geo = editor.isShapeOfType(src, "geo") ? (src as TLGeoShape) : null;
    if (geo) return geo.props.color;
    return getColorForShape(src.id);
  }
  return getColorForShape(arrow.id);
}

export class WrappedArrowShapeUtil extends ArrowShapeUtil {
  override onBeforeCreate = (shape: TLArrowShape): TLArrowShape | undefined => ({
    ...shape,
    props: { ...shape.props, color: getSourceShapeColor(this.editor, shape), dash: "solid" as const },
  });

  override onBeforeUpdate = (prev: TLArrowShape, next: TLArrowShape): TLArrowShape | undefined => {
    const color = getSourceShapeColor(this.editor, next);
    if (color !== next.props.color) {
      return { ...next, props: { ...next.props, color } };
    }
    return undefined;
  };
}
