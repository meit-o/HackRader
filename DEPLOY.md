# VercelとNeonへのデプロイ

このアプリはNext.jsのWebサービスとしてVercelで動作し、データベースにはNeonのPostgreSQLを使います。NeonはVercel Marketplaceから接続できます。アプリはTypeORMのバージョン付きマイグレーションを使い、データベースへの初回接続時に未適用のマイグレーションを実行します。

## Vercelプロジェクトを作成する

1. GitHubへこのブランチをpushし、VercelでリポジトリをImportします。
2. Vercel MarketplaceからNeonを追加し、対象のVercelプロジェクトへ接続します。
3. Neonの**pooled connection string**を`DATABASE_URL`として設定します。Neonの接続文字列に`sslmode=require`が含まれる場合は、`DATABASE_SSL=true`を設定してください。
4. 次の環境変数をVercelのProduction、必要ならPreviewにも設定します。

   - `DATABASE_URL`
   - `DATABASE_SSL=true`
   - `DB_POOL_SIZE=1`
   - `AUTH_SECRET`（十分に長いランダム文字列）
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_WEBHOOK_SECRET`
   - `ENABLE_DEMO_MODE=false`
   - `WAKATIME_CLIENT_ID`（使う場合）
   - `WAKATIME_CLIENT_SECRET`（使う場合）

   Neonの接続文字列は秘密情報です。`NEXT_PUBLIC_`を付けず、Gitへコミットしないでください。
5. Vercelのデプロイが完了したら、`https://<Vercelのドメイン>/api/health`を開き、`{"status":"ok"}`が返ることを確認します。初回のヘルスチェックでTypeORMがスキーマを作成します。

## GitHub OAuthとWebhook

GitHub OAuth AppのCallback URLを次に設定します。

```text
https://<Vercelのドメイン>/api/auth/github/callback
```

GitHubリポジトリのWebhook URLは次です。

```text
https://<Vercelのドメイン>/api/github/webhook
```

push、pull request、issues、pull request reviewイベントを購読し、Webhook secretには`GITHUB_WEBHOOK_SECRET`と同じ値を設定します。

WakaTimeを使う場合は、次のCallback URLを`WAKATIME_OAUTH_CALLBACK_URL`に設定します。

```text
https://<Vercelのドメイン>/api/auth/wakatime/callback
```

## ローカルのPostgreSQLを使う

Dockerは使わず、PCにPostgreSQLをインストールしてポート`5432`で起動します。

```sql
CREATE DATABASE hackradar;
```

`.env.example`を`.env.local`へコピーし、ローカルでは`DATABASE_SSL=false`を使います。`DATABASE_URL`はローカルPostgreSQLの接続文字列に設定してください。

```sh
npm ci
npm run dev
```

TypeORMはアプリが初めてデータベースへ接続したときに、未適用のマイグレーションを実行します。

## Supabaseから既存データを移す

移行スクリプトは旧Supabase PostgreSQLからNeon PostgreSQLへデータを一度だけコピーします。アプリ本体は移行後のSupabaseへ接続しません。

1. Vercel MarketplaceでNeonを接続し、Vercelから`DATABASE_URL`の値をコピーします。移行作業用の`.env.local`ではNeonの接続文字列を`DATABASE_URL`、`DATABASE_SSL=true`に設定します。
2. 旧Supabaseの接続先とStorage情報を、移行作業専用の環境変数として設定します。

   ```env
   SUPABASE_SOURCE_DATABASE_URL=
   SUPABASE_SOURCE_STORAGE_URL=
   SUPABASE_SOURCE_SERVICE_ROLE_KEY=
   ```

   これらはローカルの移行スクリプトだけで使い、Vercelには登録しないでください。
3. 移行先スキーマを作成するため、ローカルで一度`npm run dev`を起動し、`/api/health`を開きます。`{"status":"ok"}`を確認して停止します。
4. 次を実行します。

   ```sh
   node scripts/migrate-supabase-data.cjs
   ```

   ユーザー、イベント、チーム、所属情報、OAuthトークン、招待、アクティビティ、ヘルプ、チャット、ダイレクトメッセージをコピーします。非公開DM画像もPostgreSQLへ保存し、添付ファイルの移行漏れがあればエラーになります。
5. Vercel上でログイン、イベントダッシュボード、GitHub Webhook、必要ならWakaTimeとDM添付画像を確認します。確認後、ローカルの`SUPABASE_SOURCE_*`の値を削除してください。

移行データを確認できるまで旧Supabaseを削除しないでください。OAuthトークンとService Role Keyは特に慎重に管理してください。
