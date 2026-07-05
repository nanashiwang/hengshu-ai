import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "client_submission_key" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "skills_client_submission_key_idx" ON "skills" USING btree ("client_submission_key");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "skills_client_submission_key_idx";
    ALTER TABLE "skills" DROP COLUMN IF EXISTS "client_submission_key";
  `)
}
