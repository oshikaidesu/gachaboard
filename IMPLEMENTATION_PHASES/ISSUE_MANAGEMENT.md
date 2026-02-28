# Issue管理ガイド

このプロジェクトでは、`master-task-board.md`のタスクをGitHub Issueに変換して管理しています。

## 概要

- **マークダウンファイル**: 全体像と依存関係を把握するためのドキュメント
- **GitHub Issue**: 個別タスクの進捗管理とPRとの連携

## ラベル

各フェーズに対応するラベルが設定されています：

- `phase-0` - Phase 0: ギャップ調査（関門）
- `phase-1` - Phase 1: Discord認証基盤
- `phase-2` - Phase 2: DB/スキーマ基盤
- `phase-3` - Phase 3: App Router導線
- `phase-4` - Phase 4: Guild認可と保護
- `phase-5` - Phase 5: ローカル運用と永続化
- `phase-6` - Phase 6: 資産削除GUI
- `phase-7` - Phase 7: メディア拡張
- `phase-8` - Phase 8: タイムラインコメント
- `phase-9` - Phase 9: オブジェクトリアクション
- `phase-10` - Phase 10: コネクタ体験
- `cross-cutting` - 横断タスク

## Issue作成方法

### 特定のフェーズのIssueを作成

```bash
# Phase 0のみ作成
node scripts/create-issues.js --phase=0

# Phase 1のみ作成
node scripts/create-issues.js --phase=1

# すべてのフェーズを作成
node scripts/create-issues.js
```

### ドライラン（作成せずに内容を確認）

```bash
node scripts/create-issues.js --phase=0 --dry-run
```

## マークダウンへのリンク追加

Issue作成後、`master-task-board.md`にIssue番号をリンクとして追加：

```bash
node scripts/update-task-board-with-issues.js
```

このスクリプトは：
1. GitHubからIssue一覧を取得
2. タスクID（例: `P0-01`）とIssueタイトルを照合
3. `master-task-board.md`の該当行にIssue番号を追加
4. バックアップファイル（`.backup`）を作成

## Issue本文のリンク更新

既存のIssue本文の相対パスリンクを完全なURLリンクに更新：

```bash
# Phase 0のIssueのみ更新
node scripts/update-issue-links.js --phase=0

# すべてのIssueを更新
node scripts/update-issue-links.js
```

このスクリプトは：
- 相対パス `../../IMPLEMENTATION_PHASES/...` を完全なURLに変換
- マスタータスクボードとPhase詳細へのリンクを正しく機能するように更新

## Issueの構造

各Issueには以下の情報が含まれます：

- **タイトル**: `[タスクID] タスク名`（例: `[P0-01] 現行機能一覧を確定`）
- **ラベル**: 対応するフェーズのラベル
- **本文**:
  - タスク説明
  - Phaseの目的（Phase詳細ファイルから抽出）
  - Phase完了条件
  - 関連資料へのリンク

## PRとの連携

PRを作成する際、対応するIssueをクローズ：

```markdown
Closes #2
```

または、複数のIssueを一度にクローズ：

```markdown
Closes #2, #3, #4
```

## 進捗管理

- **Open**: 未着手
- **In Progress**: 作業中（Issueにアサインして開始）
- **Closed**: 完了（PRマージ時に自動クローズ）

## 完了したIssueの処理

### 方法1: PRマージ時に自動クローズ

PRの説明に `Closes #2` と記載すると、PRマージ時に自動的にIssueがクローズされます。

### 方法2: 手動でIssueをクローズ

```bash
# 特定のIssueをクローズ
gh issue close 2

# 複数のIssueを一度にクローズ
gh issue close 2 3 4
```

### 方法3: マークダウンファイルから同期

完了したIssueをクローズした後、`master-task-board.md`のチェックボックスを自動更新：

```bash
# クローズ済みIssueに基づいてチェックボックスを更新
node scripts/sync-issues-with-board.js
```

このスクリプトは：
- クローズ済みのIssueに対応するタスクのチェックボックスを `- [ ]` から `- [x]` に更新
- バックアップファイル（`.backup`）を自動作成

### 方法4: タスクを直接チェック済みにする

タスクを完了した場合、直接チェック済みにして対応するIssueをクローズ：

```bash
# 特定のタスクをチェック済みにして、対応するIssueをクローズ
node scripts/sync-issues-with-board.js --mark=P0-01
```

### 方法5: チェック済みタスクのIssueを一括クローズ

マークダウンファイルでチェック済み（`- [x]`）になっているタスクのIssueを一括でクローズ：

```bash
node scripts/sync-issues-with-board.js --close-issues
```

## 注意事項

- Issue #1は重複して作成されているため、#2以降を使用してください
- 各フェーズのIssueは、依存関係に従って順番に着手してください
- Phase 0は必須の関門フェーズです。完了するまで他のフェーズに着手しないでください
- 同期スクリプト実行時は自動的にバックアップが作成されます

