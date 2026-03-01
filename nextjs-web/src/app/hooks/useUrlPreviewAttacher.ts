import { useCallback } from "react";
import { Editor, TLShapeId } from "@tldraw/tldraw";

/** tldraw v4 の richText (TipTap JSON) からプレーンテキストを再帰的に抽出する */
function richTextToPlainText(richText: unknown): string {
  if (!richText || typeof richText !== "object") return "";
  const node = richText as { type?: string; text?: string; content?: unknown[] };
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  if (Array.isArray(node.content)) {
    return node.content.map(richTextToPlainText).join("");
  }
  return "";
}

/** テキスト内の最初のURLを抽出する */
function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match?.[0] ?? null;
}

/**
 * richText ノードツリーから URL テキストノードを再帰的に削除する。
 * - marks に link がある → 削除（tldraw は URL を link mark 付きの独立ノードに分割する）
 * - text が URL のみ → 削除（mark なしで URL だけのノード）
 * - それ以外 → そのまま保持
 */
function removeUrlFromRichText(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const n = node as { type?: string; text?: string; content?: unknown[]; marks?: unknown[] };

  if (n.type === "text" && typeof n.text === "string") {
    // link mark がついているノードは URL ノードとして削除
    const hasLinkMark = Array.isArray(n.marks) && n.marks.some(
      (m) => m && typeof m === "object" && (m as { type?: string }).type === "link"
    );
    if (hasLinkMark) return null;

    // URL のみのテキストノード
    if (/^https?:\/\/\S+$/.test(n.text.trim())) return null;

    // tldraw は URL を必ず独立ノードに分割するため、混在テキストの除去は不要
    return node;
  }

  if (Array.isArray(n.content)) {
    const newContent = n.content
      .map(removeUrlFromRichText)
      .filter((c) => c !== null);

    if (n.type === "paragraph" && newContent.length === 0) {
      // URL のみの paragraph を削除（上位の doc レベルで判断する）
      return null;
    }

    if (n.type === "doc") {
      // doc の全 paragraph が消えた場合は空の paragraph を1つ残す
      if (newContent.length === 0) {
        return { ...n, content: [{ type: "paragraph", content: [] }] };
      }
    }

    return { ...n, content: newContent };
  }

  return node;
}

const TARGET_TYPES = new Set(["text", "note", "geo"]);

export function useUrlPreviewAttacher() {
  const registerListener = useCallback((editor: Editor) => {
    // 処理中フラグ：handleEditingEnd 内の updateShape によるリスナー再発火を防ぐ
    let isProcessing = false;
    let prevEditingId: TLShapeId | null = null;

    const cleanup = editor.store.listen(
      () => {
        const currentEditingId = editor.getEditingShapeId();

        // updateShape 処理中は再入を防ぐ
        if (isProcessing) return;

        // 編集中 → 非編集中の遷移を検知
        if (prevEditingId !== null && currentEditingId === null) {
          const idToProcess = prevEditingId;
          prevEditingId = null;
          isProcessing = true;
          handleEditingEnd(editor, idToProcess);
          // updateShape によるストア変更が全て処理された後にフラグを解除
          setTimeout(() => { isProcessing = false; }, 0);
          return;
        }

        prevEditingId = currentEditingId;
      },
      { source: "all", scope: "session" }
    );

    return cleanup;
  }, []);

  return { registerListener };
}

function handleEditingEnd(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId);
  if (!shape) return;
  if (!TARGET_TYPES.has(shape.type)) return;

  const props = shape.props as Record<string, unknown>;
  const richText = props.richText;
  if (!richText) return;

  const text = richTextToPlainText(richText);
  const url = extractFirstUrl(text);

  if (url) {
    // URL を meta.ogpUrls 配列に追加し、richText から URL を削除
    const existingUrls = (shape.meta as Record<string, unknown>)?.ogpUrls;
    const prevUrls: string[] = Array.isArray(existingUrls) ? existingUrls as string[] : [];
    // 重複追加を防ぐ
    const newUrls = prevUrls.includes(url) ? prevUrls : [...prevUrls, url];
    const newRichText = removeUrlFromRichText(richText);
    editor.updateShape({
      id: shapeId,
      type: shape.type,
      meta: { ...(shape.meta ?? {}), ogpUrls: newUrls },
      props: { ...props, richText: newRichText },
    });
  }
  // URL がない場合は何もしない（OGP クリアは × ボタンのみ）
}
