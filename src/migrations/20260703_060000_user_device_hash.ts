import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "device_hash" varchar;
    CREATE INDEX IF NOT EXISTS "users_device_hash_idx" ON "users" USING btree ("device_hash");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_device_hash_idx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "device_hash";
  `)
}
