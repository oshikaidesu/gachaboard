"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import emojiRegex from "emoji-regex";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import {
  DEFAULT_REACTION_EMOJI_LIST,
  FIXED_EMOJI_LIST,
} from "@shared/constants";

const REACTION_EMOJI_PRESET_MAP_KEY = "reactionEmojiPreset";
const REACTION_EMOJI_PRESET_EMOJIS_KEY = "emojis";

/** 固定5つを除いたカスタム絵文字のみを抽出 */
function getCustomEmojis(full: string[]): string[] {
  return full.filter((e) => !FIXED_EMOJI_LIST.includes(e));
}

/** 固定5つ + カスタムを結合（保存用） */
function toFullEmojiList(custom: string[]): string[] {
  return [...FIXED_EMOJI_LIST, ...custom];
}

function getSyncWsUrl(): string {
  if (typeof window === "undefined") return "";
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (!isLocal) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/ws`;
  }
  const url = process.env.NEXT_PUBLIC_SYNC_WS_URL ?? "ws://localhost:5858";
  return url.startsWith("__placeholder") ? "" : url;
}

type Props = {
  boardId: string;
  boardName: string;
  workspaceId: string;
  initialEmojis: string[] | null;
};

/** テキストから絵文字を抽出（順序保持・重複は先頭を優先） */
function extractEmojis(text: string): string[] {
  const regex = emojiRegex();
  const matches = text.match(regex) ?? [];
  return [...new Set(matches)];
}

export default function ReactionPresetClient({
  boardId,
  boardName,
  workspaceId,
  initialEmojis,
}: Props) {
  const initialCustom = getCustomEmojis(initialEmojis ?? DEFAULT_REACTION_EMOJI_LIST);
  const [text, setText] = useState(() => initialCustom.join(""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  const wsUrl = getSyncWsUrl();
  const useSync = Boolean(wsUrl);

  useEffect(() => {
    if (!useSync || typeof window === "undefined") return;
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    new IndexeddbPersistence(boardId, ydoc);
    const provider = new WebsocketProvider(wsUrl, boardId, ydoc, { connect: false });
    provider.connect();
    providerRef.current = provider;
    return () => {
      provider.disconnect();
      provider.destroy();
      providerRef.current = null;
      ydocRef.current = null;
    };
  }, [boardId, wsUrl, useSync]);

  // 初期値変更時（例: 別ボードへ遷移）にテキストを同期
  useEffect(() => {
    setText(initialCustom.join(""));
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const customEmojis = extractEmojis(text).filter((e) => !FIXED_EMOJI_LIST.includes(e));
  const fullEmojis = toFullEmojiList(customEmojis);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  const resetToDefault = useCallback(() => {
    setText(getCustomEmojis(DEFAULT_REACTION_EMOJI_LIST).join(""));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);

    if (providerRef.current) {
      const yMap = providerRef.current.doc.getMap<string>(REACTION_EMOJI_PRESET_MAP_KEY);
      yMap.set(REACTION_EMOJI_PRESET_EMOJIS_KEY, JSON.stringify(fullEmojis));
    }

    const res = await fetch(
      `/api/workspaces/${workspaceId}/boards/${boardId}/snapshot`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionEmojiPreset: fullEmojis }),
      }
    );
    setSaving(false);
    if (res.ok) setSaved(true);
  }, [boardId, workspaceId, fullEmojis]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(fullEmojis.join(""));
  }, [fullEmojis]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 bg-background p-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/workspace/${workspaceId}`}
          className="text-xs text-zinc-400 hover:underline dark:text-zinc-500 dark:hover:text-zinc-400"
        >
          ← ワークスペースに戻る
        </Link>
        <h1 className="text-xl font-semibold dark:text-zinc-100">
          リアクション絵文字のカスタマイズ
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ボード「{boardName}」で使用するリアクション絵文字を設定します。❤️👍🙇🔥🆗 は常に含まれます。
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            カスタム絵文字（テキストで編集・貼り付け・削除・並び替え）
          </h2>
          <button
            type="button"
            onClick={copyToClipboard}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            コピー
          </button>
        </div>
        <textarea
          value={text}
          onChange={handleTextChange}
          placeholder="絵文字を貼り付けてください。例: ✨😂🎉💯🚀"
          rows={6}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-3 text-lg placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder:text-zinc-500"
          spellCheck={false}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          絵文字以外の文字は無視されます。{customEmojis.length}件のカスタム絵文字
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={resetToDefault}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          デフォルトに戻す
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && (
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">保存しました</span>
        )}
      </div>

      <Link
        href={`/board/${boardId}`}
        className="text-sm text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
      >
        ボードに戻る →
      </Link>
    </main>
  );
}
