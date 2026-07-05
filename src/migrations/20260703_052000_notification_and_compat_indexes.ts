import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_notifications_type" ADD VALUE IF NOT EXISTS 'skill_updated' AFTER 'skill_favorited';
    CREATE INDEX IF NOT EXISTS "compat_reports_skill_created_at_idx" ON "compat_reports" USING btree ("skill_id", "created_at");
    CREATE INDEX IF NOT EXISTS "compat_reports_model_name_created_at_idx" ON "compat_reports" USING btree ("model_name", "created_at");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "compat_reports_model_name_created_at_idx";
    DROP INDEX IF EXISTS "compat_reports_skill_created_at_idx";
    UPDATE "notifications" SET "type" = 'system' WHERE "type" = 'skill_updated';
    ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT;
    ALTER TYPE "public"."enum_notifications_type" RENAME TO "enum_notifications_type_old";
    CREATE TYPE "public"."enum_notifications_type" AS ENUM('skill_favorited', 'review', 'bounty_accepted', 'bounty_submitted', 'bounty_completed', 'system');
    ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."enum_notifications_type" USING "type"::text::"public"."enum_notifications_type";
    ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system';
    DROP TYPE "public"."enum_notifications_type_old";
  `)
}
