import { atom } from "@cmpd/compound";

/** 消しゴムツールバーがロック中か。true のときは 2 回タップで解除してから有効化（2 回目に時間制限なし） */
export const eraserLockAtom = atom("eraserLock", true);

/** ロック中の 1 回目タップ後、2 回目待ち（解除アイコン表示用） */
export const eraserSecondTapPendingAtom = atom("eraserSecondTapPending", false);
