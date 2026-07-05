import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_economy_settings_margin_source" AS ENUM('manual', 'newapi', 'local');
  ALTER TABLE "economy_settings" ADD COLUMN "margin_source" "enum_economy_settings_margin_source" DEFAULT 'manual';
  ALTER TABLE "economy_settings" ADD COLUMN "margin_reconciled_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "economy_settings" DROP COLUMN "margin_source";
  ALTER TABLE "economy_settings" DROP COLUMN "margin_reconciled_at";
  DROP TYPE "public"."enum_economy_settings_margin_source";`)
}
