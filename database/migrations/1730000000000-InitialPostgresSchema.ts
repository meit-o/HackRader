import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialPostgresSchema1730000000000 implements MigrationInterface {
  name = "InitialPostgresSchema1730000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), github_username text NOT NULL UNIQUE,
        display_name text NOT NULL, avatar_url text, role text NOT NULL DEFAULT 'participant'
          CHECK (role IN ('participant','mentor','admin','judge')), specialty text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
        join_code text NOT NULL UNIQUE, owner_github_username text NOT NULL,
        starts_at timestamptz, ends_at timestamptz, score_config jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE teams (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name text NOT NULL, github_repo text, score integer NOT NULL DEFAULT 0,
        commit_count integer NOT NULL DEFAULT 0, house_level integer NOT NULL DEFAULT 1 CHECK (house_level BETWEEN 1 AND 4),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX teams_event_name_lower_idx ON teams(event_id, lower(name));
      CREATE UNIQUE INDEX teams_event_github_repo_lower_idx ON teams(event_id, lower(github_repo)) WHERE github_repo IS NOT NULL;
      CREATE INDEX teams_score_idx ON teams(score DESC);
      CREATE INDEX teams_event_score_idx ON teams(event_id, score DESC);
      CREATE TABLE team_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(team_id,user_id)
      );
      CREATE TABLE event_members (
        event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('participant','mentor','admin','judge')), specialty text,
        created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id)
      );
      CREATE INDEX event_members_event_role_idx ON event_members(event_id,role);
      CREATE TABLE wakatime_connections (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, access_token text NOT NULL,
        refresh_token text, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX wakatime_connections_expires_at_idx ON wakatime_connections(expires_at);
      CREATE TABLE team_invites (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
        team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        invited_by text NOT NULL DEFAULT 'HackRadar Admin', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX team_invites_created_at_idx ON team_invites(created_at DESC);
      CREATE TABLE activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        type text NOT NULL CHECK(type IN ('push','pull_request_opened','pull_request_merged','issue_closed','review')),
        message text NOT NULL, score_delta integer NOT NULL DEFAULT 0, actor_login text, actor_avatar_url text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX activities_created_at_idx ON activities(created_at DESC);
      CREATE INDEX activities_team_id_idx ON activities(team_id);
      CREATE INDEX activities_actor_idx ON activities(team_id,actor_login);
      CREATE TABLE help_posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE, title text NOT NULL, body text NOT NULL,
        category text NOT NULL, is_anonymous boolean NOT NULL DEFAULT false,
        status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','helping','solved')),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX help_posts_status_idx ON help_posts(status);
      CREATE TABLE help_replies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), help_post_id uuid NOT NULL REFERENCES help_posts(id) ON DELETE CASCADE,
        author_name text NOT NULL, author_github text,
        author_role text NOT NULL DEFAULT 'participant' CHECK(author_role IN ('participant','mentor','admin','judge')),
        body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000), is_accepted boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX help_replies_post_idx ON help_replies(help_post_id,created_at);
      CREATE TABLE chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel text NOT NULL CHECK(channel IN ('staff')),
        event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE, team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
        author_name text NOT NULL, author_role text NOT NULL DEFAULT 'participant' CHECK(author_role IN ('participant','mentor','admin','judge')),
        body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX chat_messages_created_at_idx ON chat_messages(created_at);
      CREATE INDEX chat_messages_channel_team_idx ON chat_messages(channel,team_id);
      CREATE INDEX chat_messages_event_created_at_idx ON chat_messages(event_id,created_at);
      CREATE TABLE direct_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        sender_login text NOT NULL, recipient_login text NOT NULL, sender_name text NOT NULL,
        sender_role text NOT NULL CHECK(sender_role IN ('participant','mentor','admin','judge')),
        body text NOT NULL CHECK(char_length(body) <= 1000), attachment_path text, attachment_name text,
        attachment_mime_type text CHECK(attachment_mime_type IS NULL OR attachment_mime_type IN ('image/jpeg','image/png','image/gif','image/webp')),
        attachment_size integer CHECK(attachment_size IS NULL OR attachment_size BETWEEN 1 AND 5242880),
        attachment_data bytea, created_at timestamptz NOT NULL DEFAULT now(),
        CHECK(lower(sender_login) <> lower(recipient_login)),
        CHECK(char_length(body) > 0 OR attachment_path IS NOT NULL),
        CHECK((attachment_path IS NULL AND attachment_name IS NULL AND attachment_mime_type IS NULL AND attachment_size IS NULL AND attachment_data IS NULL)
          OR (attachment_path IS NOT NULL AND attachment_name IS NOT NULL AND attachment_mime_type IS NOT NULL AND attachment_size IS NOT NULL AND attachment_data IS NOT NULL))
      );
      CREATE INDEX direct_messages_sender_created_at_idx ON direct_messages(sender_login,created_at);
      CREATE INDEX direct_messages_recipient_created_at_idx ON direct_messages(recipient_login,created_at);
      CREATE INDEX direct_messages_event_sender_created_at_idx ON direct_messages(event_id,sender_login,created_at);
      CREATE INDEX direct_messages_event_recipient_created_at_idx ON direct_messages(event_id,recipient_login,created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS direct_messages, chat_messages, help_replies, help_posts, activities, team_invites, wakatime_connections, event_members, team_members, teams, events, users CASCADE`);
  }
}
