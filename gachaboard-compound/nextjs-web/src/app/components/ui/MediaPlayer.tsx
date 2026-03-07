"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiComment } from "@shared/apiTypes";

type Props = {
  assetId: string;
  mimeType: string;
  fileName: string;
  workspaceId: string;
  boardId?: string;
  isConverted?: boolean;
};

export default function MediaPlayer({ assetId, mimeType, fileName, workspaceId, boardId, isConverted }: Props) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const isAudio = mimeType.startsWith("audio/") || isConverted;
  const isVideo = mimeType.startsWith("video/");
  const srcUrl = `/api/assets/${assetId}/file${isConverted ? "?converted=1" : ""}`;

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/comments?assetId=${assetId}`);
    if (res.ok) setComments(await res.json() as ApiComment[]);
  }, [assetId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleTimeUpdate = () => {
    if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) setDuration(mediaRef.current.duration);
  };

  const seekTo = (sec: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = sec;
      mediaRef.current.play();
    }
  };

  const postComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId,
        workspaceId,
        boardId,
        timeSec: currentTime,
        body: newComment.trim(),
      }),
    });
    if (res.ok) { setNewComment(""); await loadComments(); }
    setPosting(false);
  };

  const deleteComment = async (commentId: string) => {
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    await loadComments();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-zinc-700 truncate">{fileName}</p>

      {isVideo ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={srcUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full rounded-lg bg-black"
        />
      ) : (isAudio || isConverted) ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={srcUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full"
        />
      ) : null}

      {duration > 0 && (
        <div className="relative h-8 rounded bg-zinc-100">
          <div
            className="absolute top-0 h-full w-0.5 bg-blue-500"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
          {comments.map((c) => (
            <button
              key={c.id}
              onClick={() => seekTo(c.timeSec)}
              title={`${formatTime(c.timeSec)}: ${c.body}`}
              className="absolute top-1 h-6 w-1.5 rounded-full bg-orange-400 hover:bg-orange-600"
              style={{ left: `${(c.timeSec / duration) * 100}%` }}
            />
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <span className="text-xs text-zinc-400 shrink-0 pt-2">{formatTime(currentTime)}</span>
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && postComment()}
          placeholder="この時点にコメントを追加..."
          className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={postComment}
          disabled={posting || !newComment.trim()}
          className="rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40"
        >
          投稿
        </button>
      </div>

      {comments.length > 0 && (
        <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-zinc-50">
              <button
                onClick={() => seekTo(c.timeSec)}
                className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono text-zinc-600 hover:bg-blue-100"
              >
                {formatTime(c.timeSec)}
              </button>
              <span className="flex-1 text-sm text-zinc-700">{c.body}</span>
              <span className="text-xs text-zinc-400 shrink-0">{c.author.discordName}</span>
              <button
                onClick={() => deleteComment(c.id)}
                className="hidden text-xs text-zinc-300 hover:text-red-400 group-hover:block"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
