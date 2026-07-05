import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "skill_runs" ADD COLUMN "charged_credits" numeric DEFAULT 0;
  UPDATE "skill_runs" SET "charged_credits" = round(("charged_amount" * 100)::numeric, 2) WHERE "charged_amount" IS NOT NULL AND "charged_amount" > 0;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "skill_runs" DROP COLUMN "charged_credits";`)
}
