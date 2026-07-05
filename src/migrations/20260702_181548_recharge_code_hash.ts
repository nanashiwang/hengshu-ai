import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "recharge_codes_code_idx";
  ALTER TABLE "recharge_codes" ALTER COLUMN "code" DROP NOT NULL;
  ALTER TABLE "recharge_codes" ADD COLUMN "code_preview" varchar;
  ALTER TABLE "recharge_codes" ADD COLUMN "code_hash" varchar;
  UPDATE "recharge_codes"
    SET "status" = 'disabled',
        "note" = concat_ws(E'\n', nullif("note", ''), '旧明文充值码已因安全迁移禁用，请重新生成'),
        "code" = NULL
    WHERE "code" IS NOT NULL;
  CREATE INDEX "recharge_codes_code_preview_idx" ON "recharge_codes" USING btree ("code_preview");
  CREATE UNIQUE INDEX "recharge_codes_code_hash_idx" ON "recharge_codes" USING btree ("code_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "recharge_codes_code_preview_idx";
  DROP INDEX "recharge_codes_code_hash_idx";
  UPDATE "recharge_codes" SET "code" = "id"::text WHERE "code" IS NULL;
  ALTER TABLE "recharge_codes" ALTER COLUMN "code" SET NOT NULL;
  CREATE UNIQUE INDEX "recharge_codes_code_idx" ON "recharge_codes" USING btree ("code");
  ALTER TABLE "recharge_codes" DROP COLUMN "code_preview";
  ALTER TABLE "recharge_codes" DROP COLUMN "code_hash";`)
}
