# Gachaboard ランチャー

Electron 製のデスクトップランチャー。初回ウィザードで Discord 設定を入力し、Tailscale モードでサーバを起動します。トレイ常駐に対応しています。

## 開発時の起動

プロジェクトルートで:

```bash
npm run launcher
```

または:

```bash
cd launcher && npm run start
```

**注意**: ランチャーはプロジェクトルート（`launcher/` の親）をアプリルートとして認識します。`scripts/win/run.ps1` や `nextjs-web/` がその直下にある必要があります。

## ビルド

```bash
cd launcher
npm run build        # 全プラットフォーム
npm run build:win    # Windows (portable + nsis)
npm run build:mac    # Mac (dmg)
npm run build:linux  # Linux (AppImage)
```

ビルド成果物は `launcher/dist/` に出力されます。

## 配布

ビルドした exe（例: `Gachaboard 1.0.0.exe`）を **プロジェクトフォルダのルート** に配置して配布。ユーザーはプロジェクトを clone または ZIP で取得し、そのフォルダに exe を置いて **exe をダブルクリック**で起動。exe のディレクトリがアプリルートとして使われます。cwd が合わない場合は run-launcher.bat を補助として使えます。

## リリース（GitHub Releases）

`v*` タグを push すると `.github/workflows/release-build.yml` が実行され、以下が自動ビルド・アップロードされます:

- `gachaboard-dist.zip` … プロジェクト一式（node_modules 除く）
- `Gachaboard 1.0.0.exe` … ポータブル版（インストール不要）
- `Gachaboard Setup 1.0.0.exe` … NSIS インストーラー版

## 更新

アプリ内の「最新版は Releases で確認」リンクから [Releases](https://github.com/oshikaidesu/gachaboard/releases) を開けます。新しいバージョンの exe をダウンロードして、既存のプロジェクトフォルダ内の exe を上書きすれば、`.env.local` や `data/` はそのまま保持されます。
