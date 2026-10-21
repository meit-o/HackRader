/* One-time transfer from the legacy Supabase PostgreSQL database to the new PostgreSQL database. */
const { DataSource } = require("typeorm");
require("dotenv").config({ path: ".env.local" });

const tables = [
  ["users", ["id", "github_username", "display_name", "avatar_url", "role", "specialty", "created_at"]],
  ["events", ["id", "name", "join_code", "owner_github_username", "starts_at", "ends_at", "score_config", "created_at"]],
  ["teams", ["id", "event_id", "name", "github_repo", "score", "commit_count", "house_level", "created_at"]],
  ["team_members", ["id", "team_id", "user_id"]],
  ["event_members", ["event_id", "user_id", "role", "specialty", "created_at"]],
  ["wakatime_connections", ["user_id", "access_token", "refresh_token", "expires_at", "created_at", "updated_at"]],
  ["team_invites", ["id", "code", "team_id", "invited_by", "created_at"]],
  ["activities", ["id", "team_id", "type", "message", "score_delta", "actor_login", "actor_avatar_url", "metadata", "created_at"]],
  ["help_posts", ["id", "user_id", "team_id", "title", "body", "category", "is_anonymous", "status", "created_at"]],
  ["help_replies", ["id", "help_post_id", "author_name", "author_github", "author_role", "body", "is_accepted", "created_at"]],
  ["chat_messages", ["id", "channel", "event_id", "team_id", "author_name", "author_role", "body", "created_at"]],
  ["direct_messages", ["id", "event_id", "sender_login", "recipient_login", "sender_name", "sender_role", "body", "attachment_path", "attachment_name", "attachment_mime_type", "attachment_size", "created_at"]]
];

function required(name) {
  if (!process.env[name]) throw new Error(`${name} must be set for this one-time migration.`);
  return process.env[name];
}

async function main() {
  const source = new DataSource({ type: "postgres", url: required("SUPABASE_SOURCE_DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  const target = new DataSource({ type: "postgres", url: required("DATABASE_URL"), ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false });
  await Promise.all([source.initialize(), target.initialize()]);
  try {
    const storageUrl = required("SUPABASE_SOURCE_STORAGE_URL").replace(/\/$/, "");
    const serviceRoleKey = required("SUPABASE_SOURCE_SERVICE_ROLE_KEY");
    const counts = {};
    let attachmentCount = 0;
    await target.transaction(async (manager) => {
      for (const [table, columns] of tables) {
        const rows = await source.query(`SELECT ${columns.map((column) => `"${column}"`).join(", ")} FROM "${table}" ORDER BY 1`);
        for (const row of rows) {
          let insertColumns = columns;
          if (table === "direct_messages" && row.attachment_path) {
            const relativePath = String(row.attachment_path).split("/").map(encodeURIComponent).join("/");
            const response = await fetch(`${storageUrl}/storage/v1/object/authenticated/direct-message-attachments/${relativePath}`, {
              headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
            });
            if (!response.ok) throw new Error(`Could not download attachment for message ${row.id} (HTTP ${response.status}).`);
            row.attachment_data = Buffer.from(await response.arrayBuffer());
            insertColumns = [...columns, "attachment_data"];
            attachmentCount++;
          }
          const values = insertColumns.map((column) => row[column] ?? null);
          const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
          const names = insertColumns.map((column) => `"${column}"`).join(", ");
          const conflict = table === "team_members" ? `ON CONFLICT (team_id,user_id) DO NOTHING` :
            table === "event_members" ? `ON CONFLICT (event_id,user_id) DO NOTHING` :
            table === "wakatime_connections" ? `ON CONFLICT (user_id) DO UPDATE SET access_token=EXCLUDED.access_token, refresh_token=EXCLUDED.refresh_token, expires_at=EXCLUDED.expires_at, updated_at=EXCLUDED.updated_at` :
            `ON CONFLICT (id) DO NOTHING`;
          await manager.query(`INSERT INTO "${table}" (${names}) VALUES (${placeholders}) ${conflict}`, values);
        }
        counts[table] = rows.length;
      }
    });

    const incomplete = await target.query(`SELECT count(*)::int AS count FROM direct_messages WHERE attachment_path IS NOT NULL AND attachment_data IS NULL`);
    if (incomplete[0].count) throw new Error(`${incomplete[0].count} message attachments were not copied.`);
    console.log(JSON.stringify({ importedRows: counts, copiedAttachments: attachmentCount }, null, 2));
  } finally {
    await Promise.all([source.destroy(), target.destroy()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
