# Docker まわりメモ

## 構成

Webアプリ（Next.js）は Docker に入ってなくて、`npm run dev` でローカル起動。
Docker で動いてるのは postgres と sync-server と minio だけ。インフラ用。

## なんで Docker 使ってるか

Mac で開発して Windows で動かす想定で、環境違いがめんどくさそうだったから。
postgres とか minio とかを OS ごとにインストールするより、docker compose 一発で揃う方が楽。

あと本番で Windows サーバーに載せるときも、Docker で一式持っていけそう。

## 聞かれたとき

「Webアプリ本体は Next.js で、Docker は DB とかストレージとかのインフラ用」って言っとけばいいと思う。
Vercel に載せても postgres とかは別途要るし、その辺をまとめるのに Docker 使ってる感じ。
