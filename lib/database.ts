import "reflect-metadata";
import { DataSource } from "typeorm";
import { InitialPostgresSchema1730000000000 } from "@/database/migrations/1730000000000-InitialPostgresSchema";
import { ManagedTeamRepositories1795000000000 } from "@/database/migrations/1795000000000-ManagedTeamRepositories";

declare global {
  // Reuse connections during Next.js development hot reloads and serverless invocations.
  var hackRadarDataSource: Promise<DataSource> | undefined;
}

export function isDatabaseConfigured(): boolean {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production; configure the Vercel PostgreSQL integration.");
  }
  return Boolean(process.env.DATABASE_URL);
}

export function getDataSource(): Promise<DataSource> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Start PostgreSQL and configure .env.local.");
  }

  globalThis.hackRadarDataSource ??= (async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL!);
    // pg connection-string SSL settings override the explicit ssl option.
    // Enforce certificate verification for every TLS-enabled connection.
    if (process.env.DATABASE_SSL !== "false") {
      databaseUrl.searchParams.set("sslmode", "verify-full");
    }
    const source = new DataSource({
      type: "postgres",
      url: databaseUrl.toString(),
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: true },
      entities: [],
      migrations: [InitialPostgresSchema1730000000000, ManagedTeamRepositories1795000000000],
      migrationsTableName: "typeorm_migrations",
      migrationsRun: true,
      synchronize: false,
      logging: process.env.NODE_ENV === "development" && process.env.DB_LOGGING === "true",
      extra: {
        // Vercel functions should use the pooled Neon connection URL and a small
        // per-instance pool to avoid exhausting the database connection limit.
        max: Number(process.env.DB_POOL_SIZE ?? (process.env.VERCEL ? 1 : 5)),
        idleTimeoutMillis: 30_000
      }
    });
    return source.initialize();
  })().catch((error) => {
    globalThis.hackRadarDataSource = undefined;
    throw error;
  });

  return globalThis.hackRadarDataSource;
}
