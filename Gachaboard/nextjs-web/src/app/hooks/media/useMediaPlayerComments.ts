"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { useEditor } from "@cmpd/compound";
import { useBoardComments } from "@/app/components/board/BoardCommentProvider";
import { useBoardContext } from "@/app/components/board/BoardContext";

export const MEDIA_COMMENT_ROW_HEIGHT = 32;
const COMMENT_GAP = 4;
const COMMENT_LIST_OVERHEAD = 26;
export const MIN_COMMENT_LIST_H = COMMENT_LIST_OVERHEAD + MEDIA_COMMENT_ROW_HEIGHT + COMMENT_GAP;
const MAX_COMMENT_LIST_HEIGHT = COMMENT_LIST_OVERHEAD + 6 * (MEDIA_COMMENT_ROW_HEIGHT + COMMENT_GAP);

export type UseMediaPlayerCommentsOptions = {
  assetId: string;
  currentTime: number;
  shapeId: string;
  onSeek: (sec: number) => void;
  onTogglePlay: () => void;
};

export function useMediaPlayerComments({
  assetId,
  currentTime,
  shapeId,
  onSeek,
  onTogglePlay,
}: UseMediaPlayerCommentsOptions) {
  const { syncAvailable } = useBoardContext();
  const { comments, addComment, deleteComment } = useBoardComments(assetId);
  const editor = useEditor();

  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [commentFocused, setCommentFocused] = useState(false);
  const [isPointerOver, setIsPointerOver] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const commentInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const postComment = useCallback(() => {
    if (!newComment.trim() || !syncAvailable) return;
    setPosting(true);
    addComment(currentTime, newComment.trim());
    setNewComment("");
    setPosting(false);
  }, [newComment, syncAvailable, currentTime, addComment]);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      setDeleting(commentId);
      deleteComment(commentId);
      setDeleting(null);
    },
    [deleteComment]
  );

  const commentListH = Math.max(
    MIN_COMMENT_LIST_H,
    Math.min(
      comments.length > 0
        ? COMMENT_LIST_OVERHEAD + comments.length * (MEDIA_COMMENT_ROW_HEIGHT + COMMENT_GAP)
        : 0,
      MAX_COMMENT_LIST_HEIGHT
    )
  );

  // スペースキーで再生/一時停止
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " || commentFocused) return;
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      )
        return;
      const canControl = editor.getSelectedShapeIds().includes(shapeId as import("@cmpd/tlschema").TLShapeId) || isPointerOver;
      if (!canControl) return;
      e.preventDefault();
      e.stopPropagation();
      onTogglePlay();
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [shapeId, commentFocused, editor, isPointerOver, onTogglePlay]);

  const handleOutsideClick = useCallback(() => {
    const input = commentInputRef.current;
    if (input) {
      input.blur();
      setCommentFocused(false);
    }
  }, []);
  useOnClickOutside(containerRef, handleOutsideClick, "mousedown", { capture: true });
  useOnClickOutside(containerRef, handleOutsideClick, "touchstart", { capture: true, passive: true });

  return {
    comments,
    newComment,
    setNewComment,
    postComment,
    posting,
    commentFocused,
    setCommentFocused,
    commentInputRef,
    containerRef,
    setContainerRef: (node: HTMLDivElement | null) => {
      containerRef.current = node;
    },
    commentListH,
    handleDeleteComment,
    deleting,
    syncAvailable,
    isPointerOver,
    setIsPointerOver,
    COMMENT_ROW_HEIGHT: MEDIA_COMMENT_ROW_HEIGHT,
  };
}
