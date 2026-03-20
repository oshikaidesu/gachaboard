# セットアップガイド

GitHub から clone して、自分のマシンで Gachaboard サーバーを構築するまでの手順を説明します。

---

## 起動方法の選択

| 方法 | 対象 | 事前準備 |
|------|------|----------|
| **`scripts/entry/start.bat` → 1** | Windows（Tailscale・既定） | Node.js + Tailscale。PostgreSQL・MinIO は自動 |
| **`scripts/entry/start.bat` → 2** | Windows（localhost のみ） | Node.js のみ。PostgreSQL・MinIO は自動 |
| **`scripts/entry/start.sh`** / **`scripts/entry/start.command`** | Mac / Linux | Node.js + PostgreSQL（同一スクリプト。MinIO はスクリプトで自動取得） |

**Windows で始める場合は** [WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md)（メニュー実体: `scripts/entry/start.bat`）。

---

## 全体像（Tailscale 利用時）

```
あなた（サーバー主）             参加者（ブラウザだけ）
┌─────────────────────┐     ┌─────────────────────┐
│ scripts/entry/start.bat → 1 実行 │     │ Tailscale インストール│
│  → PostgreSQL/MinIO   │     │  → Tailnet に参加     │
│  → Next.js 起動       │     │  → URL をブラウザで開く│
│  → Tailscale Serve    │     │  → Discord ログイン   │
│  → HTTPS で公開       │     │  → 共同編集開始        │
└─────────────────────┘     └─────────────────────┘
         ↑ 起動スクリプトが全自動         ↑ Tailscale だけ
```

---

## 前提条件

- [ ] **Windows**: Node.js のみ。詳細は [WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md)
- [ ] **Mac**: Node.js 18+（PostgreSQL は `brew install postgresql@16` 等。未導入時はスクリプトが案内）
- [ ] **Linux**: Node.js + PostgreSQL（未導入時はスクリプトが案内）+ Tailscale 利用時は tailscale / jq
- [ ] **Discord アカウント**（ログインに使用）
- [ ] **Tailscale アカウント**（無料、[tailscale.com](https://tailscale.com/)）※ localhost のみなら不要

---

## ステップ 1: リポジトリをクローン

```bash
git clone https://github.com/oshikaidesu/gachaboard.git
cd gachaboard
```

---

## ステップ 2: Discord OAuth アプリを作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 「New Application」でアプリを作成
3. **OAuth2 → General** で **Client ID** と **Client Secret** をコピー
4. **OAuth2 → Redirects** に以下を追加:
   - `http://localhost:18580/api/auth/callback/discord`（ローカル用）
   - `https://<あなたのホスト名>.ts.net/api/auth/callback/discord`（Tailscale 用・起動後のターミナルで確認可能）

> ホスト名は起動後のターミナルで確認できます。初回は localhost のみを登録し、Tailscale 起動後に追加してください。

---

## ステップ 3: 環境変数を設定

**Windows（`scripts/entry/start.bat` のメニューから起動した場合）**:
- `run.ps1` 初回実行時に `nextjs-web/.env.local` が無ければ自動作成されることがあります
- `nextjs-web\.env.local` を開き、`DISCORD_CLIENT_ID` と `DISCORD_CLIENT_SECRET` を入力
- 詳細は [WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md)

**Mac / Linux の場合**:

```bash
npm run setup:env
```

（`nextjs-web/.env.local` が無い場合は `.env.example` から作成されます。）`nextjs-web/.env.local` を開き、以下を入力:

| 変数 | 取得元 | 必須 |
|------|--------|:----:|
| `DISCORD_CLIENT_ID` | ステップ 2 で取得 | ✅ |
| `DISCORD_CLIENT_SECRET` | ステップ 2 で取得 | ✅ |
| `NEXTAUTH_SECRET` | `setup:env` で自動生成（空のままで OK） | ✅ |
| `SERVER_OWNER_DISCORD_ID` | 管理者の Discord ID（空なら全員がワークスペース作成可） | - |

> **`NEXTAUTH_URL` は通常は設定不要です。** 起動スクリプトが Tailscale のホスト名を自動で取得し、設定に反映します。`nextjs-web/.env.local` に手で書く必要はありません。

それ以外の項目（ポート・DB・S3 等）はデフォルトのままで動きます。詳細は [ENV-REFERENCE.md](ENV-REFERENCE.md)。

---

## ステップ 4: Tailscale の準備（初回のみ・2 を選ぶ場合）

1. [Tailscale Admin Console](https://login.tailscale.com/admin/dns) を開く
2. **MagicDNS** を ON にする
3. **HTTPS Certificates** を ON にする

> この設定を行わないと `*.ts.net` のアドレスが解決できず、HTTPS も使えません。

---

## ステップ 5: 起動

| OS | 方法 |
|:---|:---|
| **Windows** | `scripts/entry/start.bat` をダブルクリック → メニューからモードを選択 |
| **Mac** | `scripts/entry/start.command` をダブルクリック |
| **Linux** | `./scripts/entry/start.sh` または `bash scripts/entry/start.sh` |

起動が完了すると、ターミナルに以下が表示されます:

```
  ✓ Gachaboard 起動完了

  アクセスURL: https://your-machine.tailXXXXX.ts.net （Tailscale の場合）
  または http://localhost:18580 （ローカルの場合）

  Discord でログインするには:
    Discord Developer Portal → アプリ → OAuth2 → Redirects に以下を追加:
    https://your-machine.tailXXXXX.ts.net/api/auth/callback/discord
```

**この URL を Discord の Redirect に追加してください。**

---

## ステップ 6: 友達を招待する

→ 詳細は [INVITE-GUIDE.md](INVITE-GUIDE.md) を参照。

### 手順（サーバー主がやること）

1. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) を開く
2. あなたのマシンの「**…**」→「**Share…**」をクリック
3. 相手のメールアドレスを入力して招待

### 参加者がやること

1. 招待メールのリンクから Tailscale に参加
2. デバイスに [Tailscale をインストール](https://tailscale.com/download)（Windows / Mac / iOS / Android）
3. Tailscale にログイン（共有された Tailnet に接続される）
4. サーバー主から共有された URL をブラウザで開く
5. Discord でログイン → 共同編集開始

> **参加者は起動スクリプトを実行する必要はありません。** ブラウザでアクセスするだけで完了です。

---

## 動作確認

1. ボード上にシェイプを配置できること
2. ファイルをドラッグ＆ドロップで配置できること
3. 別端末（スマホ等）からも同じ URL でアクセスできること（Tailscale の場合）

---

## 補足

### 起動オプション（Windows）

`scripts/entry/start.bat` の番号は [WINDOWS-NATIVE-SETUP.md](WINDOWS-NATIVE-SETUP.md) を参照（例: 1 = Tailscale 本番、2 = localhost 本番、6 = リセット後再起動 など）。

### ポート一覧

| サービス | ポート | 用途 |
|----------|--------|------|
| Next.js | 18580 | Web アプリ |
| PostgreSQL | 18581 | DB（ホスト側） |
| sync-server | 18582 | Yjs WebSocket |
| MinIO | 18583, 18584 | S3 互換ストレージ |

### ffmpeg

動画・音声の変換に必要。Windows: `winget install ffmpeg`。Mac: `brew install ffmpeg`。Linux: `sudo apt install ffmpeg`

### Caddyfile について

**デフォルトでは不要です。** Tailscale Serve が HTTPS を提供します。Caddy で自前運用したい場合のみ [TAILSCALE_HTTPS_SETUP.md](TAILSCALE_HTTPS_SETUP.md) を参照。

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 「保護されていない通信」・混合コンテンツ | 起動時に Tailscale（2）を選んでいれば NEXTAUTH_URL は自動設定されます。Caddy なしのときも *.ts.net なら https に強制するため、Next.js を再起動すれば解消する想定です。 |
| Discord ログイン後にエラー | Redirect URL が起動時に表示されたものと一致しているか確認 |
| ERR_NAME_NOT_RESOLVED | Tailscale Admin Console で HTTPS Certificates が ON か確認 |
| PostgreSQL 接続エラー | `scripts/entry/start.bat` → メニューの「Reset and restart」を選択して再起動 |
| ポートが使用中 | 同上、または手動: `fuser -k 18580/tcp` |
| `nextjs-web/.env.local` の変更が反映されない | 開発中は Next を再起動。スタック全体は `scripts/entry/start.bat` のリセット項で止めてから再起動 |
