import { useCallback } from "react";
import LinkifyIt from "linkify-it";
import { Editor, TLShapeId } from "@cmpd/compound";

const linkify = new LinkifyIt();

/** テキスト内の最初のURLを抽出する */
function extractFirstUrl(text: string): string | null {
  const matches = linkify.match(text);
  return matches?.[0]?.url ?? null;
}

const TARGET_TYPES = new Set(["geo"]);

export function useUrlPreviewAttacher() {
  const registerListener = useCallback((editor: Editor) => {
    let isProcessing = false;
    let prevEditingId: TLShapeId | null = null;

    const cleanup = editor.store.listen(
      () => {
        const currentEditingId = editor.getEditingShapeId();

        if (isProcessing) return;

        if (prevEditingId !== null && currentEditingId === null) {
          const idToProcess = prevEditingId;
          prevEditingId = null;
          isProcessing = true;
          handleEditingEnd(editor, idToProcess);
          setTimeout(() => { isProcessing = false; }, 0);
          return;
        }

        prevEditingId = currentEditingId;
      },
      { source: "user", scope: "session" }
    );

    return () => {
      cleanup();
    };
  }, []);

  return { registerListener };
}

function handleEditingEnd(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId);
  if (!shape) return;
  if (!TARGET_TYPES.has(shape.type)) return;

  const props = shape.props as Record<string, unknown>;
  const text = typeof props.text === "string" ? props.text : "";
  if (!text) return;

  const url = extractFirstUrl(text);
  if (!url) return;

  const existingUrls = (shape.meta as Record<string, unknown>)?.ogpUrls;
  const prevUrls: string[] = Array.isArray(existingUrls) ? (existingUrls as string[]) : [];
  const newUrls = prevUrls.includes(url) ? prevUrls : [...prevUrls, url];
  const newText = text.replace(url, "").trim();

  editor.updateShape({
    id: shapeId,
    type: shape.type,
    meta: { ...(shape.meta ?? {}), ogpUrls: newUrls },
    props: { ...props, text: newText },
  } as Parameters<Editor["updateShape"]>[0]);
}
