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
 * richText ノードツリーから全ての link mark を除去する（青字化防止）。
 * URL テキストノード自体は残す（removeUrlFromRichText で別途削除する）。
 */
function stripLinkMarks(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const n = node as { type?: string; text?: string; content?: unknown[]; marks?: unknown[] };

  if (n.type === "text") {
    if (!Array.isArray(n.marks) || n.marks.length === 0) return node;
    const filteredMarks = n.marks.filter(
      (m) => !(m && typeof m === "object" && (m as { type?: string }).type === "link")
    );
    return { ...n, marks: filteredMarks };
  }

  if (Array.isArray(n.content)) {
    return { ...n, content: n.content.map(stripLinkMarks) };
  }

  return node;
}

/**
 * richText ノードツリーから URL テキストノードを再帰的に削除する。
 * - text が URL のみのノード → 削除
 * - marks に link があり text も URL → 削除
 * - marks に link があるが text が URL でない（文字にリンクが付いた）→ link mark だけ除去してテキストは保持
 */
function removeUrlFromRichText(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const n = node as { type?: string; text?: string; content?: unknown[]; marks?: unknown[] };

  if (n.type === "text" && typeof n.text === "string") {
    const hasLinkMark = Array.isArray(n.marks) && n.marks.some(
      (m) => m && typeof m === "object" && (m as { type?: string }).type === "link"
    );
    const isUrlText = /^https?:\/\/\S+$/.test(n.text.trim());

    if (isUrlText) {
      // URL テキストノードは削除（link mark の有無に関わらず）
      return null;
    }

    if (hasLinkMark) {
      // URL でない文字に link mark が付いている場合は mark だけ除去してテキストは保持
      const filteredMarks = (n.marks as { type?: string }[]).filter((m) => m.type !== "link");
      return { ...n, marks: filteredMarks };
    }

    return node;
  }

  if (Array.isArray(n.content)) {
    const newContent = n.content
      .map(removeUrlFromRichText)
      .filter((c) => c !== null);

    if (n.type === "paragraph" && newContent.length === 0) {
      return null;
    }

    if (n.type === "doc") {
      if (newContent.length === 0) {
        return { ...n, content: [{ type: "paragraph", content: [] }] };
      }
    }

    return { ...n, content: newContent };
  }

  return node;
}

const TARGET_TYPES = new Set(["text", "note", "geo"]);

/** richText に link mark が含まれているか確認する */
function hasLinkMarkAnywhere(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as { type?: string; marks?: unknown[]; content?: unknown[] };
  if (n.type === "text" && Array.isArray(n.marks)) {
    if (n.marks.some((m) => m && typeof m === "object" && (m as { type?: string }).type === "link")) {
      return true;
    }
  }
  if (Array.isArray(n.content)) {
    return n.content.some(hasLinkMarkAnywhere);
  }
  return false;
}

export function useUrlPreviewAttacher() {
  const registerListener = useCallback((editor: Editor) => {
    let isProcessing = false;
    let prevEditingId: TLShapeId | null = null;

    // store に書き込まれる前に link mark を除去する（ペースト時の青字リンク防止）
    const cleanupLinkMarks = editor.sideEffects.registerBeforeChangeHandler("shape", (_prev, next) => {
      if (!TARGET_TYPES.has(next.type)) return next;
      const props = next.props as Record<string, unknown>;
      const richText = props.richText;
      if (!richText || !hasLinkMarkAnywhere(richText)) return next;
      const stripped = stripLinkMarks(richText);
      return { ...next, props: { ...props, richText: stripped } };
    });

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

    return () => {
      cleanup();
      cleanupLinkMarks();
    };
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
    const newUrls = prevUrls.includes(url) ? prevUrls : [...prevUrls, url];
    const newRichText = removeUrlFromRichText(richText);
    editor.updateShape({
      id: shapeId,
      type: shape.type,
      meta: { ...(shape.meta ?? {}), ogpUrls: newUrls },
      props: { ...props, richText: newRichText },
    });
  }
  // URL がない場合は何もしない（link mark 除去はリアルタイムハンドラが担当）
}
