# WSL2 24時間運用の設定（AE 共存・自動起動）

AE（After Effects）と Gachaboard を同じマシンで運用する場合の設定手順です。

---

## 前提

- **AE**: C ドライブ
- **Gachaboard**: D ドライブ（データは `/mnt/d/gachaboard-data`）
- **WSL2 メモリ**: 4GB に制限（AE に十分なメモリを残す）
- **自動起動**: ログオン時に start.bat を実行

---

## 1. WSL2 メモリ制限

1. `scripts/setup/wslconfig` を編集（必要なら memory / swap を変更）
2. プロジェクトルートで PowerShell を開き、以下を実行:
   ```powershell
   .\scripts\setup\setup-wslconfig.ps1
   ```
3. WSL を再度起動（スタートメニューから Ubuntu 等を開く）
4. 反映確認: `wsl -e free -h` でメモリを確認

---

## 2. Gachaboard データを D ドライブに配置

プロジェクトが `D:\server\gachaboard` にある場合、データは自動で **D:\gachaboard-data** に保存されます。

初回起動時、`/mnt/d/gachaboard-data` に postgres / minio / sync のデータが作成されます。

---

## 3. 自動起動の設定

### 方法 A: PowerShell で一括設定（推奨）

1. プロジェクトルートで PowerShell を開く
2. 以下を実行:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
   .\scripts\setup\setup-auto-start.ps1
   ```

### 方法 B: タスクスケジューラで手動設定

1. **タスクスケジューラ** を開く（Win + R → `taskschd.msc`）
2. **タスクの作成** → **全般** で名前を「Gachaboard-Start」に
3. **トリガー** → **新規** → **ログオン時**、ユーザーを選択
4. **操作** → **新規** → プログラム: `cmd.exe`、引数: `/c "D:\server\gachaboard\start.bat"`
5. **開始** に `D:\server\gachaboard` を指定
6. **条件** で「コンピューターを AC 電源で使用している場合のみ」のチェックを外す（24時間運用のため）

---

## 4. スリープ無効化（24時間運用時）

24時間稼働させる場合は、Windows のスリープを無効にしてください。

1. **設定** → **システム** → **電源とバッテリ**
2. **画面とスリープ** で「次の時間が経過したらデバイスをスリープする」を **なし** に

---

## 5. 容量の戻し方（重要）

**WSL2 の仮想ディスク（vhdx）は、ファイルを削除しても自動では縮みません。** 普通のドライブと違い、容量が戻らない。

定期的に圧縮する:

```powershell
# 管理者 PowerShell で（Gachaboard 等は停止する）
.\scripts\setup\wsl2-compact.ps1
```

- 実行前に WSL 内の作業を保存
- Docker の未使用イメージ削除も有効: `wsl -e docker system prune -a`

---

## 6. 運用の流れ

| タイミング | 動作 |
|------------|------|
| PC 起動・ログオン | start.bat が自動実行され、Gachaboard が起動 |
| AE 使用時 | そのまま両方稼働（WSL2 は 4GB に制限済み） |
| 停止したい場合 | タスクスケジューラで「Gachaboard-Start」を無効化 |

---

## 7. トラブルシューティング

| 現象 | 対処 |
|------|------|
| 自動起動でウィンドウが一瞬で閉じる | タスクの「実行時に最上位のウィンドウで実行」をオフにする |
| WSL2 が起動しない | `.wslconfig` 反映後は `wsl --shutdown` 必須 |
| メモリ不足 | `.wslconfig` の `memory=4GB` を `2GB` に下げる |

---

## 関連ドキュメント

- [WSL2-HELP.md](WSL2-HELP.md) … 詰まりポイントと対処
- [24-7-OPERATION.md](24-7-OPERATION.md) … 24時間運用の注意点
