import { getDataSource } from "@/lib/database";
import { DataSource, Brackets } from "typeorm";

const TABLES = new Set([
  "users", "events", "teams", "team_members", "event_members", "wakatime_connections",
  "team_invites", "activities", "help_posts", "help_replies", "chat_messages", "direct_messages"
]);
const conflictKeys: Record<string, string[]> = {
  users: ["github_username"], event_members: ["event_id", "user_id"],
  team_members: ["team_id", "user_id"], wakatime_connections: ["user_id"]
};

const columns: Record<string, string[]> = {
 users:["id","github_username","display_name","avatar_url","role","specialty","created_at"], events:["id","name","join_code","owner_github_username","starts_at","ends_at","score_config","created_at"], teams:["id","event_id","name","github_repo","score","commit_count","house_level","created_at"], team_members:["id","team_id","user_id"], event_members:["event_id","user_id","role","specialty","created_at"], wakatime_connections:["user_id","access_token","refresh_token","expires_at","created_at","updated_at"], team_invites:["id","code","team_id","invited_by","created_at"], activities:["id","team_id","type","message","score_delta","actor_login","actor_avatar_url","metadata","created_at"], help_posts:["id","user_id","team_id","title","body","category","is_anonymous","status","created_at"], help_replies:["id","help_post_id","author_name","author_github","author_role","body","is_accepted","created_at"], chat_messages:["id","channel","event_id","team_id","author_name","author_role","body","created_at"], direct_messages:["id","event_id","sender_login","recipient_login","sender_name","sender_role","body","attachment_path","attachment_name","attachment_mime_type","attachment_size","attachment_data","created_at"]
};

type Result = { data: any; error: Error | null; count?: number };

/** Application CRUD facade backed by TypeORM QueryBuilder; atomic GitHub scoring uses a TypeORM transaction. */
class TableQuery implements PromiseLike<Result> {
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private columns = "*";
  private values: Record<string, unknown> | Record<string, unknown>[] = {};
  private filters: Array<(qb: any, alias: string) => void> = [];
  private sorts: Array<{ column: string; ascending: boolean }> = [];
  private maxRows?: number;
  private one: "single" | "maybeSingle" | null = null;
  private returnRows = false;
  private conflict?: string[];

  constructor(private readonly tableName: string, private readonly source?: DataSource) {
    if (!TABLES.has(tableName)) throw new Error(`Unknown PostgreSQL table: ${tableName}`);
  }
  select(columns = "*"): this { this.columns = columns; this.returnRows = true; return this; }
  insert(values: Record<string, unknown> | Record<string, unknown>[]): this { this.action = "insert"; this.values = values; return this; }
  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): this { this.action = "upsert"; this.values = values; this.conflict = options?.onConflict?.split(",") ?? conflictKeys[this.tableName]; return this; }
  update(values: Record<string, unknown>): this { this.action = "update"; this.values = values; return this; }
  delete(): this { this.action = "delete"; return this; }
  eq(column: string, value: unknown): this { const i=this.filters.length; this.filters.push((qb,a) => qb.andWhere(`${a}.${column} = :v${i}`, { [`v${i}`]: value })); return this; }
  neq(column: string, value: unknown): this { const i=this.filters.length; this.filters.push((qb,a) => qb.andWhere(`${a}.${column} <> :v${i}`, { [`v${i}`]: value })); return this; }
  ilike(column: string, value: string): this { const i=this.filters.length; this.filters.push((qb,a) => qb.andWhere(`${a}.${column} ILIKE :v${i}`, { [`v${i}`]: value })); return this; }
  is(column: string, value: null | boolean): this {
    const condition = value === null ? "IS NULL" : value ? "IS TRUE" : "IS FALSE";
    this.filters.push((qb, alias) => qb.andWhere(`${alias}.${column} ${condition}`));
    return this;
  }
  not(column: string, op: string, value: unknown): this { const i=this.filters.length; this.filters.push((qb,a) => qb.andWhere(op === "is" && value === null ? `${a}.${column} IS NOT NULL` : `${a}.${column} IS DISTINCT FROM :v${i}`, { [`v${i}`]: value })); return this; }
  in(column: string, values: unknown[]): this { const i=this.filters.length; this.filters.push((qb,a) => qb.andWhere(`${a}.${column} IN (:...v${i})`, { [`v${i}`]: values })); return this; }
  or(expression: string): this {
    const branches = expression.split(",").map((part) => {
      const match = /^([a-z_]+)\.(eq|ilike)\.(.*)$/i.exec(part);
      if (!match) throw new Error(`Unsupported OR expression: ${part}`);
      return { column: match[1], op: match[2], value: match[3] };
    });
    this.filters.push((qb,a) => qb.andWhere(new Brackets((or: any) => branches.forEach((b,i) => or[i ? "orWhere" : "where"](`${a}.${b.column} ${b.op === "ilike" ? "ILIKE" : "="} :or${i}`, { [`or${i}`]: b.op === "ilike" ? b.value : b.value })))));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this { this.sorts.push({ column, ascending: options?.ascending ?? true }); return this; }
  limit(rows: number): this { this.maxRows = rows; return this; }
  single(): this { this.one = "single"; return this; }
  maybeSingle(): this { this.one = "maybeSingle"; return this; }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
  private async execute(): Promise<Result> {
    try {
      const source = this.source ?? await getDataSource();
      const alias = "row";
      const qb = source.createQueryBuilder();
      const applyFilters = (query: any) => this.filters.forEach((filter) => filter(query, alias));
      let data: any;
      if (this.action === "select") {
        const names = this.columns === "*" ? columns[this.tableName] : this.columns.split(",").map(c => c.trim());
        const query = qb.from(this.tableName, alias);
        names.forEach((name) => query.addSelect(`${alias}.${name}`, name));
        applyFilters(query);
        for (const s of this.sorts) query.addOrderBy(`${alias}.${s.column}`, s.ascending ? "ASC" : "DESC");
        if (this.maxRows !== undefined) query.take(this.maxRows);
        data = await query.getRawMany();
      } else if (this.action === "insert" || this.action === "upsert") {
        let query = qb.insert().into(this.tableName).values(this.values as any);
        if (this.action === "upsert") {
          if (!this.conflict?.length) throw new Error(`No conflict key configured for ${this.tableName}`);
          const updates = Object.keys(Array.isArray(this.values) ? this.values[0] : this.values).filter(k => !this.conflict!.includes(k));
          query = updates.length ? query.orUpdate(updates, this.conflict) : query.orIgnore();
        }
        const result = await query.returning("*").execute(); data = this.returnRows ? result.raw : null;
      } else if (this.action === "update") {
        const query = qb.update(this.tableName).set(this.values as any).where("1=1"); applyFilters(query);
        const result = await query.returning("*").execute(); data = this.returnRows ? returnedRows(result.raw) : null;
      } else {
        const query = qb.delete().from(this.tableName).where("1=1"); applyFilters(query);
        const result = await query.returning("*").execute(); data = this.returnRows ? returnedRows(result.raw) : null;
      }
      if (this.one) data = Array.isArray(data) ? data[0] ?? null : data;
      return { data, error: null };
    } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }; }
  }
}

function returnedRows(raw: unknown): unknown {
  // TypeORM's PostgreSQL UpdateResult/DeleteResult wrap RETURNING rows as [rows, affectedCount].
  return Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
}

class PostgresStore {
  table(tableName: string): any { return new TableQuery(tableName); }
  async recordActivityAtomically(args: Record<string, any>): Promise<Result> {
    try {
      const source = await getDataSource();
      const data = await source.transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`${args.p_team_id}:delivery:${args.p_metadata?.githubDeliveryId ?? ""}`]);
        if (args.p_metadata?.commitSha) await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`${args.p_team_id}:commit:${args.p_metadata.commitSha}`]);
        const exists = await manager.query(`SELECT * FROM activities WHERE team_id=$1 AND (($2::text IS NOT NULL AND metadata->>'githubDeliveryId'=$2) OR ($3::text IS NOT NULL AND metadata->>'commitSha'=$3)) ORDER BY created_at DESC LIMIT 1`, [args.p_team_id, args.p_metadata?.githubDeliveryId ?? null, args.p_metadata?.commitSha ?? null]);
        if (exists[0]) return exists[0];
        const insert = await manager.query(`INSERT INTO activities(id,team_id,type,message,score_delta,actor_login,actor_avatar_url,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [args.p_id,args.p_team_id,args.p_type,args.p_message,args.p_score_delta,args.p_actor_login,args.p_actor_avatar_url,JSON.stringify(args.p_metadata ?? {}),args.p_created_at]);
        await manager.query(`UPDATE teams SET score=score+GREATEST($2,0), commit_count=commit_count+GREATEST($3,0), house_level=CASE WHEN score+GREATEST($2,0)>=600 THEN 4 WHEN score+GREATEST($2,0)>=300 THEN 3 WHEN score+GREATEST($2,0)>=100 THEN 2 ELSE 1 END WHERE id=$1`, [args.p_team_id,args.p_score_delta,args.p_commit_delta]);
        return insert[0];
      });
      return { data, error: null };
    } catch (error) { return { data: null, error: error instanceof Error ? error : new Error(String(error)) }; }
  }
}

export function getPostgresStore(): PostgresStore { return new PostgresStore(); }
