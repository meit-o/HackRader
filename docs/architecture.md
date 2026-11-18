# HackRadarのアーキテクチャ

`main` の `35c2170` を基準に、本番向け構成を示します。画面ごとの入力項目やローカルのデモ構成は省略しています。

## システム構成

```mermaid
flowchart LR
    subgraph Browser[ブラウザ]
        UI[React画面<br/>ダッシュボード・質問掲示板・チャット]
    end

    subgraph Vercel[Vercel上のNext.js]
        Auth[認証・セッション]
        API[アプリAPI<br/>イベント・投稿・状態取得]
        Score[Webhook受付・スコア計算]
        WS[WebSocket窓口<br/>/api/realtime]
        DBAccess[データアクセス層<br/>TypeORM]
    end

    People[参加者・運営・メンター・審査員] --> UI
    GH[GitHub] -->|プッシュ・PRなどのWebhook| Score
    Auth <-->|OAuth| GH
    Auth <-->|任意のOAuth連携| Waka[WakaTime]
    API -->|作業時間の集計を取得| Waka
    UI <-->|ログイン・セッションCookie| Auth
    UI <-->|HTTPSで投稿・データ取得| API
    Auth -->|WakaTimeの連携トークンを保存| DBAccess
    API --> DBAccess
    Score --> DBAccess
    DBAccess <-->|SQLで読み書き| Neon[(Neon PostgreSQL)]
    Score -->|保存後に変更を通知| Redis[(Upstash Redis Pub/Sub)]
    API -->|掲示板・チャットなどの保存後に通知| Redis
    Redis -->|イベント単位で配信| WS
    WS -->|WSSで変更を通知| UI
```

- 参加者・運営はGitHub OAuthでログインします。メンターは招待コード・名前・得意分野、審査員は招待コード・名前で参加でき、サーバーがイベントと役割を含むセッションを発行します。
- Neonはデータの保存先です。TypeORMはサーバー側でPostgreSQLへの接続やクエリの実行を扱います。運営がイベントを作ると既存の `events` テーブルに行が追加されます。テーブルの作成はマイグレーションが担当します。
- WakaTime連携ではOAuthで得たトークンをNeonに保存し、作業時間はサーバーがWakaTime APIから取得します。

## GitHubの操作がスコア表示に反映されるまで

```mermaid
sequenceDiagram
    participant G as GitHub
    participant B as Next.js Webhook処理
    participant N as Neon PostgreSQL
    participant R as Upstash Redis
    participant W as Next.js WebSocket窓口
    participant C as ブラウザ
    participant A as Next.js 状態API

    Note over W,C: 参加中のイベントでWebSocket接続済み
    G->>B: POST /api/github/webhook
    Note over B: 署名を確認し、対象チームとイベントの配点を調べる
    B->>N: TypeORM経由で活動を記録しスコアを更新
    N-->>B: 保存完了
    B->>R: イベントの状態が変わったと通知
    R-->>W: 変更通知を配信
    W-->>C: state_changed
    C->>A: GET /api/state
    A->>N: TypeORM経由でイベントの最新状態を取得
    N-->>A: スコア・活動など
    A-->>C: その利用者に公開できる状態をJSONで返す
    Note over C: Reactが表示を更新
```

ダッシュボードの質問と回答、チャットもHTTPで投稿し、保存後は同じ変更通知を使います。個別DMは `GET /api/direct-messages` を5秒ごとに呼びます。ダッシュボードはWebSocketの購読完了時にも最新状態を取得します。

## 実装をたどる

| 確認する内容 | 実装 |
| --- | --- |
| GitHubのWebhook受付・スコア計算と保存 | [Webhookルート](../app/api/github/webhook/route.ts)、[スコア処理](../lib/store.ts)、[DB処理](../lib/postgres-store.ts) |
| 状態の通知と再取得 | [Redis通知](../lib/realtime.ts)、[WebSocketルート](../app/api/realtime/route.ts)、[画面側の処理](../components/use-hackverse-state.ts)、[状態API](../app/api/state/route.ts) |
| 質問・回答・チャット・DM | [質問API](../app/api/help/route.ts)、[回答API](../app/api/help/replies/route.ts)、[チャットAPI](../app/api/chat/route.ts)、[DM画面](../components/direct-messages.tsx) |
| OAuthと参加時のセッション | [GitHub OAuth](../app/api/auth/github/callback/route.ts)、[メンター参加](../app/api/mentors/join/route.ts)、[審査員参加](../app/api/judges/join/route.ts) |
| WakaTime連携と集計 | [OAuthコールバック](../app/api/auth/wakatime/callback/route.ts)、[集計API](../app/api/wakatime/summary/route.ts)、[連携・集計処理](../lib/wakatime-store.ts) |
| DB接続とスキーマ | [TypeORMの設定](../lib/database.ts)、[マイグレーション](../database/migrations/1730000000000-InitialPostgresSchema.ts) |

## 別のプロジェクトで描くとき

1. 利用者、ブラウザ、サーバー、DB、外部サービスを箱にする。フロントエンドとバックエンドが同じプロジェクトでも、どこで処理が動くかを箱で示す。
2. 代表的な操作を一つ選び、誰が呼ぶか、どこで処理するか、どこに保存するか、誰が結果を読むかを矢印でつなぐ。矢印には「HTTPSで投稿」「SQLで保存」「WebSocketで通知」のように書く。
3. 画面の入力項目はユーザーフローに残す。処理順が大事な機能は、上のスコア反映のようにシーケンス図を添える。
