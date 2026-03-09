# 💻 開発者・メンテナー向けガイド

Gachaboard の**内部設計・技術仕様・開発フロー**に関するドキュメントです。

---

## 🗺️ ガイドマップ

### 1. 全体像を掴む
- **[HANDOVER.md](HANDOVER.md)**: **【最初に読む】** プロジェクトの構造、開発の進め方、主要なディレクトリの役割。
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: システムの構成図と、フロントエンド・バックエンド・同期サーバーの関係。
- **[CONCEPT.md](CONCEPT.md)**: なぜこの技術を選んだのか、何を重視して設計しているのか。

### 2. 技術仕様を深掘りする
- **[yjs-system-specification.md](yjs-system-specification.md)**: Yjs と WebSocket を使ったリアルタイム同期の仕組み。
- **[database-and-storage-inventory.md](database-and-storage-inventory.md)**: Prisma スキーマと S3 ストレージのデータ構造。
- **[color-visibility-guide.md](color-visibility-guide.md)**: ホワイトボード上の視認性を確保するための色設計。

### 3. メンテナンス・改善
- **[security-and-refactor-changelog.md](security-and-refactor-changelog.md)**: 過去の重要なセキュリティ修正とリファクタの記録。
- **[refactor-candidates.md](refactor-candidates.md)**: 現在認識されている課題と、リファクタリングの提案。
- **[future-considerations.md](future-considerations.md)**: 将来的な機能拡張やスケールアップの検討事項。
- **[GLOSSARY.md](GLOSSARY.md)**: プロジェクト固有の用語集。

---

## 📋 ドキュメント一覧

| 分類 | ファイル | 概要 |
|:---|:---|:---|
| **基本** | [HANDOVER.md](HANDOVER.md) | 開発スタートガイド |
| | [ARCHITECTURE.md](ARCHITECTURE.md) | システム構成図と解説 |
| | [CONCEPT.md](CONCEPT.md) | 設計思想と原則 |
| **技術** | [yjs-system-specification.md](yjs-system-specification.md) | 同期エンジンの詳細 |
| | [database-and-storage-inventory.md](database-and-storage-inventory.md) | データ永続化の仕様 |
| **運用** | [security-and-refactor-changelog.md](security-and-refactor-changelog.md) | 変更履歴（セキュリティ） |
| | [color-visibility-guide.md](color-visibility-guide.md) | UI/UX 色設計ガイド |
| **未来** | [refactor-candidates.md](refactor-candidates.md) | 改善タスク案 |
| | [future-considerations.md](future-considerations.md) | 拡張プラン |
| **補助** | [GLOSSARY.md](GLOSSARY.md) | 用語集 |

---

[← ドキュメント TOP](../README.md)
