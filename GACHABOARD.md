# Gachaboard

音楽・映像・デザインの複合合作ツール。  
Discord の延長線上にある「おもちゃ箱」的なホワイトボードサービス。

## プロジェクト情報

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Gachaboard |
| ドメイン | gachaboard.dpdns.org |
| ドメインサービス | DigitalPlat FreeDomain |
| ドメイン管理パネル | https://dash.domain.digitalplat.org/panel/main |
| 参考記事 | https://qiita.com/EdgeDevice/items/c7dbb968f2bf33d5e4bc |

---

## ドメイン更新手順（1年ごと）

DigitalPlat FreeDomain は **1年ごとに手動更新**が必要です。  
更新を忘れるとドメインが失効します。

### 更新ステップ

1. https://dash.domain.digitalplat.org/panel/main にアクセス
2. GitHubアカウントでログイン
3. `My Domains` を開く
4. `gachaboard.dpdns.org` の横にある **「Renew」ボタン**をクリック
5. 確認画面で承認 → 完了

### 更新タイミングの目安

- 取得日から **11ヶ月後**には更新しておくと安全
- 失効してもすぐには消えないが、早めに対応推奨

---

## Cloudflare Tunnel 設定メモ

ローカルサーバー（Docker）を `gachaboard.dpdns.org` で外部公開するための設定。

### 必要なもの

- Cloudflare アカウント（無料）
- `gachaboard.dpdns.org` を Cloudflare の DNS に向ける設定

### DNS 設定（DigitalPlat 側）

DigitalPlat のドメイン管理で Nameserver を Cloudflare に向ける：

```
NS1: xxx.ns.cloudflare.com
NS2: yyy.ns.cloudflare.com
```

※ Cloudflare でドメインを追加すると NS が発行される

### docker-compose.yml への追加

```yaml
cloudflared:
  image: cloudflare/cloudflared:latest
  restart: unless-stopped
  command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    - nextjs
```

### .env.local の変更

```env
AUTH_URL=https://gachaboard.dpdns.org
NEXTAUTH_URL=https://gachaboard.dpdns.org
```

### Discord Developer Portal の設定

Redirect URI に追加：
```
https://gachaboard.dpdns.org/api/auth/callback/discord
```

---

## コンセプト

- 音楽・映像・デザインファイルを**貼り付けて共有**するホワイトボード
- Discord ログイン必須（匿名性の排除）
- URLを知っていれば誰でもボードに入れる
- ワークスペース単位でプロジェクトを管理（3〜4個運用想定）
- ローカルサーバー運用（1TB ストレージ活用）
