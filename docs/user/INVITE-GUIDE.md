# 参加者の招待ガイド

Gachaboard サーバーに友達を招待する手順です。

---

## 仕組み

Gachaboard は **Tailscale** のプライベートネットワークを使って公開されます。参加者はサーバーを立てる必要はなく、**Tailscale をインストールしてブラウザでアクセスするだけ**です。

```
サーバー主                        参加者
┌──────────────┐                ┌──────────────┐
│ Gachaboard   │  ← HTTPS →    │ ブラウザ      │
│ (自分のPC)    │  Tailscale     │ (PC/スマホ)   │
└──────────────┘                └──────────────┘
```

---

## サーバー主がやること

### 1. 共有ノードで招待する

1. [Tailscale Admin Console](https://login.tailscale.com/admin/machines) を開く
2. Gachaboard を動かしているマシンの右端「**…**」→「**Share…**」をクリック
3. 招待したい人のメールアドレスを入力
4. 「**Share**」をクリック

招待メールが自動送信されます。

### 2. アクセス URL を共有する

起動時にターミナルに表示される URL を参加者に共有してください:

```
https://your-machine.tailXXXXX.ts.net
```

> Discord のサーバーやグループチャットで URL を共有するのが便利です。

---

## 参加者がやること

### 1. Tailscale をインストール

| デバイス | インストール |
|----------|-------------|
| **Windows** | [tailscale.com/download](https://tailscale.com/download/windows) |
| **Mac** | [tailscale.com/download](https://tailscale.com/download/mac) |
| **iOS** | [App Store](https://apps.apple.com/app/tailscale/id1470499037) |
| **Android** | [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn) |

### 2. Tailnet に参加

サーバー主から届いた招待メールのリンクを開き、Tailscale アカウントでログインしてください。これで同じプライベートネットワークに接続されます。

### 3. URL をブラウザで開く

サーバー主から共有された `https://xxx.tailXXXXX.ts.net` をブラウザで開き、Discord でログインすれば完了です。

---

## FAQ

### Q: 参加者も起動スクリプトを実行する必要がある？

**いいえ。** `scripts/entry/start.bat`（Windows）または同等のエントリはサーバーを立てる人だけが使います。参加者はブラウザでアクセスするだけです。

### Q: 参加者もコマンドラインが必要？

**いいえ。** Tailscale のインストール（GUI）とブラウザだけで使えます。

### Q: Tailscale は無料？

はい。個人利用なら無料プラン（最大 100 デバイス）で十分です。

### Q: スマホからも使える？

はい。iOS / Android に Tailscale アプリをインストールし、同じアカウントでログインすれば URL にアクセスできます。

### Q: ERR_NAME_NOT_RESOLVED と出る

参加者の Tailscale が接続されていないか、共有ノードの招待が完了していません。Tailscale アプリが「Connected」になっているか確認してください。

### Q: サーバー主の PC が落ちたらどうなる？

アクセスできなくなります。サーバー主の PC が起動していて、ホスト側の起動スクリプト（例: Windows なら `scripts/entry/start.bat` のメニュー 1 または 2）が実行されている必要があります。常時稼働については [24-7-OPERATION.md](24-7-OPERATION.md) を参照。
