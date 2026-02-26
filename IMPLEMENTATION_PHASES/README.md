# 実装フェーズ分割計画

このディレクトリは、実装を小分け・並行化するための作業計画をまとめたものです。

## フェーズ一覧

- [マスタータスクボード（全残タスク）](./master-task-board.md)
- [Phase 0: クローン元ギャップ調査](./phase-00-gap-survey.md)
- [Phase 1: Discord認証基盤](./phase-01-auth.md)
- [Phase 2: DB/スキーマ基盤](./phase-02-data-model.md)
- [Phase 3: App Router画面導線](./phase-03-app-router.md)
- [Phase 4: Guild認可と保護](./phase-04-authorization.md)
- [Phase 5: ローカル運用と永続化](./phase-05-local-ops.md)
- [Phase 6: 資産削除GUI](./phase-06-asset-delete-gui.md)
- [Phase 7: メディア拡張](./phase-07-media-features.md)
- [Phase 8: タイムラインコメント](./phase-08-timeline-comments.md)
- [Phase 9: オブジェクトリアクション（Twemoji）](./phase-09-object-reactions.md)
- [Phase 10: コネクタ体験（draw.io風）](./phase-10-connector-experience.md)

## 並行実装の推奨順

1. `Phase 0` は最初に完了（前提の確定）。
2. `Phase 1` と `Phase 2` は並行可（最後に統合）。
3. `Phase 3` は `Phase 1/2` 完了後に着手。
4. `Phase 4` は `Phase 3` と並行で一部進行可（ガード実装中心）。
5. `Phase 5` はいつでも着手可（インフラ寄り）。
6. `Phase 6` は `Phase 2/4` 依存。
7. `Phase 7` は `Phase 3/4/6` の後半で段階導入。
8. `Phase 8` は `Phase 2/4/7` 完了後に着手。
9. `Phase 9` は `Phase 2/3/4` 完了後に着手（`Phase 8` と並行可）。
10. `Phase 10` は `Phase 2/3/4` 完了後に着手（`Phase 9` と並行可）。

## 完了定義（全体）

- Discordログイン済みユーザのみアクセス可能。
- 所属Guild外の `Project/Board/Asset` は閲覧不可。
- URL入室は可能だが、Guild認可を通過しないと表示不可。
- ローカル再起動後もデータ保持。
- GUIで資産削除可能（削除後は取得不可）。
