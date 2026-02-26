# 並行実装ワークストリーム

## Stream A: 認証・認可

- Phase 1（Auth.js + Discord）
- Phase 4（Guild認可）

## Stream B: データ・運用

- Phase 2（Prisma/Postgres）
- Phase 5（ローカル永続化）

## Stream C: 画面・体験

- Phase 3（App Router導線）
- Phase 6（削除GUI）
- Phase 7（メディア拡張）
- Phase 8（タイムラインコメント）
- Phase 9（オブジェクトリアクション）
- Phase 10（コネクタ体験）

## 同時進行ルール

- `Phase 0` 完了までは実装開始しない。
- 各StreamはPR/ブランチを分離する。
- 統合前に `Phase 4` 認可チェックを必須テストにする。
