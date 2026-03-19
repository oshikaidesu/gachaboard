import { FIXED_EMOJI_LIST } from "@shared/constants";

/** Y.Map から取得した JSON 文字列をパースして絵文字配列を返す */
export function parseEmojiPresetFromRaw(raw: string | undefined): string[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.filter((e): e is string => typeof e === "string");
  } catch {
    return null;
  }
}

/**
 * 保存時に local と remote を統合する。
 * - 削除時: local が remote の部分集合かつ要素数が少ない → local をそのまま使う（削除を反映）
 * - 追加時: それ以外 → マージして両方の追加を統合（競合解消）
 */
export function mergeReactionEmojiPresets(
  local: string[],
  remote: string[] | null
): string[] {
  if (!remote || remote.length === 0) return local;

  const fixedSet = new Set(FIXED_EMOJI_LIST);
  const localCustom = local.filter((e) => !fixedSet.has(e));
  const remoteCustom = remote.filter((e) => !fixedSet.has(e));

  const localSet = new Set(localCustom);
  const remoteSet = new Set(remoteCustom);
  const isSubset =
    localCustom.length < remoteCustom.length &&
    [...localSet].every((e) => remoteSet.has(e));
  if (isSubset) return local;

  const mergedCustom: string[] = [...localCustom];
  for (const e of remoteCustom) {
    if (!mergedCustom.includes(e)) mergedCustom.push(e);
  }
  return [...FIXED_EMOJI_LIST, ...mergedCustom];
}
