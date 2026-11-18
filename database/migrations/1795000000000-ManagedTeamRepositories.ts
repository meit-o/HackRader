import type { MigrationInterface, QueryRunner } from "typeorm";

export class ManagedTeamRepositories1795000000000 implements MigrationInterface {
  name = "ManagedTeamRepositories1795000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE teams ADD COLUMN github_repo_managed boolean NOT NULL DEFAULT false");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE teams DROP COLUMN github_repo_managed");
  }
}
