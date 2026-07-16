import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings"
      ALTER COLUMN "site_name" SET DEFAULT '溯源';

    UPDATE "site_settings"
    SET "site_name" = '溯源'
    WHERE "site_name" <> '溯源';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The pre-launch brand cutover is intentionally irreversible: rolling
  // application code back must not resurrect a retired public identity.
  await db.execute(sql`
    ALTER TABLE "site_settings"
      ALTER COLUMN "site_name" SET DEFAULT '溯源';
  `)
}
