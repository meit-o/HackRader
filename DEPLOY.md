# Renderへのデプロイ

このアプリはNext.jsのWebサービスとして動作し、データベースにはPostgreSQLを使います。Render Blueprintを使うと、シンガポールリージョンにWebサービスとPostgreSQLを作成し、Webサービスへデータベース接続URLを設定できます。TypeORMはアプリの初回データベース接続時に、未適用のマイグレーションを実行します。

## Renderへデプロイする

1. このブランチをGitHubへpushし、RenderでこのリポジトリからBlueprintを作成します。
2. Blueprintが作成するWebサービスとPostgreSQLのプランを確認します。Renderの無料PostgreSQLインスタンスには有効期限があるため、本番データを移す前に継続利用できるプランを選んでください。
3. Renderの`hackradar` Webサービスに、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_WEBHOOK_SECRET`を設定します。WakaTimeを使う場合は`WAKATIME_CLIENT_ID`と`WAKATIME_CLIENT_SECRET`も設定してください。`AUTH_SECRET`はBlueprintが作成し、`DATABASE_URL`はデータベースへの接続用に設定されます。
4. GitHub OAuth AppのCallback URLを`https://<Renderのサービス名>.onrender.com/api/auth/github/callback`に設定します。
5. GitHubリポジトリのWebhook URLを`https://<Renderのサービス名>.onrender.com/api/github/webhook`に設定します。push、pull request、issues、pull request reviewイベントを購読し、Webhook secretには`GITHUB_WEBHOOK_SECRET`と同じ値を設定します。
6. WakaTimeを使う場合は、`WAKATIME_OAUTH_CALLBACK_URL`を`https://<Renderのサービス名>.onrender.com/api/auth/wakatime/callback`に設定します。
7. デプロイ後、`https://<Renderのサービス名>.onrender.com/api/health`を開き、`{"status":"ok"}`が返ることを確認します。

WebサービスとPostgreSQLは同じリージョンに置き、Renderのプライベート接続URLを使ってください。PostgreSQLをインターネットへ公開しないでください。

## ローカルのPostgreSQLを使う

Dockerは使いません。PCにPostgreSQLをインストールし、サービスを起動してポート`5432`で接続できるようにします。PostgreSQLに接続して、アプリ用データベースを作成してください。

```sql
CREATE DATABASE hackradar;
```

`.env.example`を`.env.local`へコピーし、`DATABASE_URL`をローカルPostgreSQLのユーザー名とパスワードに合わせて編集します。

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/hackradar
DATABASE_SSL=false
ENABLE_DEMO_MODE=false
```

`postgres`と`YOUR_PASSWORD`は、PC上のPostgreSQLで使っているユーザー名とパスワードに置き換えてください。パスワードにURLで特別な意味を持つ文字が含まれる場合は、その文字をパーセントエンコードしてください。次に、リポジトリのルートで以下を実行します。

```sh
npm ci
npm run dev
```

TypeORMはアプリが初めてデータベースへ接続したときに、未適用のマイグレーションを実行します。利用中はローカルPostgreSQLを起動したままにしてください。

## Supabaseから既存データを移す

移行スクリプトは、Supabaseを使っていた環境からデータを一度だけ読み込みます。アプリ本体は移行後のSupabaseへ接続しません。既存データを引き継ぐ場合は、移行先へ切り替える前に次の手順を実施してください。

1. Render Blueprintを作成し、PostgreSQLが利用可能になるまで待ちます。Renderデータベースの**External Database URL**を一時的にコピーします。このURLは移行スクリプトを実行するPCから接続する場合に使います。
2. ローカルの`.env.local`で、`DATABASE_URL`にRenderのExternal Database URL、`DATABASE_SSL=true`を設定します。さらに、旧SupabaseのPostgreSQL接続URLを`SUPABASE_SOURCE_DATABASE_URL`、旧プロジェクトURLを`SUPABASE_SOURCE_STORAGE_URL`、移行作業専用のService Role Keyを`SUPABASE_SOURCE_SERVICE_ROLE_KEY`に設定します。これら3つの値は`node scripts/migrate-supabase-data.cjs`だけが読み込みます。Renderの環境変数には登録しないでください。
3. `DATABASE_URL`を設定した状態でアプリを一度起動し、TypeORMに移行先スキーマを作成させます。`npm run dev`を起動して`/api/health`へアクセスするか、ビルド後に`npm run start`を実行してください。スキーマ作成後、アプリを停止します。
4. リポジトリのルートで`node scripts/migrate-supabase-data.cjs`を実行します。ユーザー、イベント、チーム、所属情報、OAuthトークン、招待、アクティビティ、ヘルプ、チャット、ダイレクトメッセージをコピーします。非公開DM画像もダウンロードし、PostgreSQLに保存します。移行件数を表示し、添付ファイルの移行漏れがあればエラーになります。同じIDのデータについては再実行できます。
5. Render上でログイン、イベントダッシュボード、GitHub Webhook、（利用する場合）WakaTime、DM添付画像を確認します。確認後、ローカル環境から`SUPABASE_SOURCE_*`の3つの値を削除してください。

移行したデータを確認できるまでは、旧プロジェクトを削除しないでください。OAuthトークンも移行されるため、データベースへのアクセスを制限し、Renderアカウントの認証情報を安全に管理してください。
