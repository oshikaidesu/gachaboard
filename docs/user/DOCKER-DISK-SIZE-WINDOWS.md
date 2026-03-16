# Docker Desktop（Windows）のディスク容量を増やす

**データを D ドライブに置きたいだけなら**、`.env` に `GACHABOARD_DATA_DIR=D:\gachaboard-data` を追加するだけで済みます（[ENV-REFERENCE.md](ENV-REFERENCE.md) の「Docker データ保存先」参照）。以下は「C ドライブの Docker 自体の容量」を増やしたい／空けたい場合の手順です。

Docker Desktop が WSL2 を使っている場合、コンテナ・イメージ・ボリュームは **WSL2 の仮想ディスク（ext4.vhdx）** に保存されます。  
「ディスク容量が足りない」「ビルドや compose が失敗する」ときは、次のいずれかで**容量を増やす**か、**不要データを削ってから仮想ディスクを圧縮**してください。

---

## 方法1: Docker Desktop の設定で増やす（WSL2 でない場合）

Docker Desktop を **Hyper-V バックエンド**で使っている場合のみ有効です。

1. Docker Desktop を開く
2. **設定（歯車）** → **Resources** → **Advanced**
3. **Disk usage limit** のスライダーを右に動かして上限を増やす（例: 64GB → 128GB）
4. **Apply & restart**

※ WSL2 を使っている場合は、この項目が表示されないか、効かないことがあります。そのときは方法2を使います。

---

## 方法2: WSL2 の仮想ディスク上限を増やす（推奨・WSL2 の場合）

Docker Desktop は WSL2 の `docker-desktop-data` というディストリビューションでディスクを使います。  
ここでは **「すでにある vhdx を拡張する」** 手順を書きます。

### 手順 A: WSL 2.5 以降で「リサイズコマンド」が使える場合

1. **Docker Desktop を終了**（タスクトレイ → Quit Docker Desktop）
2. 管理者で開いた **PowerShell** で次を実行（例: 100GB に変更）:
   ```powershell
   wsl --shutdown
   wsl --manage --resize docker-desktop-data 100GB
   ```
3. Docker Desktop を起動し直す

サイズは `50GB` / `100GB` / `200GB` など、必要なだけ指定できます。  
`wsl --manage --resize` が存在しない場合は、次の手順 B を使ってください。

### 手順 B: diskpart で vhdx を拡張する（どのバージョンでも可）

1. **Docker Desktop を終了**
2. **PowerShell を管理者で実行**し、WSL を止める:
   ```powershell
   wsl --shutdown
   ```
3. **diskpart** を起動:
   ```powershell
   diskpart
   ```
4. diskpart のウィンドウで次を実行（`USER` は自分の Windows のユーザー名に置き換え）:
   ```text
   select vdisk file="C:\Users\USER\AppData\Local\Docker\wsl\data\ext4.vhdx"
   expand vdisk maximum=102400
   exit
   ```
   - `maximum=102400` は **100GB**（単位は MB）。200GB にしたい場合は `maximum=204800`
5. Docker Desktop を起動する
6. WSL の Linux 側でファイルシステムを拡張する必要がある場合があります。  
   PowerShell で:
   ```powershell
   wsl -d docker-desktop
   ```
   入ったら:
   ```bash
   sudo resize2fs /dev/sdb
   exit
   ```
   （`/dev/sdb` は環境によって違う場合があります。`df -h` でマウントされているデバイスを確認してください）

これで「Docker に使える容量」の上限が増えます。

---

## 方法3: 容量を「空けて」から仮想ディスクを小さくする（空き容量を Windows に返す）

「Docker の容量は足りているが、C ドライブが逼迫している」場合は、**中身を削ってから vhdx を圧縮**すると、Windows 側の空き容量が増えます。

1. **不要なイメージ・コンテナ・ボリュームを削除**（PowerShell）:
   ```powershell
   docker system prune -a --volumes
   ```
   ※ 未使用のイメージ・停止コンテナ・未使用ボリュームがすべて削除されます。必要なものは先に退避してください。

2. **Docker Desktop を終了** → タスクトレイから **Quit Docker Desktop**

3. **WSL を停止**:
   ```powershell
   wsl --shutdown
   ```

4. **管理者の PowerShell** で diskpart を実行:
   ```powershell
   diskpart
   ```
   ```text
   select vdisk file="C:\Users\USER\AppData\Local\Docker\wsl\data\ext4.vhdx"
   attach vdisk readonly
   compact vdisk
   detach vdisk
   exit
   ```
   （`USER` は自分のユーザー名に置き換え）

5. Docker Desktop を起動し直す

---

## まとめ

| 目的 | やること |
|------|----------|
| **Docker の容量を増やしたい**（よく動かない） | 方法2の手順 A または B で vhdx の上限を増やす |
| **C ドライブの空きを増やしたい** | 方法3で prune → compact |

ユーザー名がわからないときは、PowerShell で `$env:USERNAME` を実行すると表示されます。  
vhdx の実際のパスは `$env:LOCALAPPDATA\Docker\wsl\data\ext4.vhdx` で確認できます。
