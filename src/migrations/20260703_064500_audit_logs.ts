import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "event" varchar NOT NULL,
      "actor_id" uuid,
      "target_user_id" uuid,
      "target_type" varchar,
      "target_id" varchar,
      "ip_hash" varchar,
      "summary" varchar,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "audit_logs_event_idx" ON "audit_logs" USING btree ("event");
    CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_target_user_idx" ON "audit_logs" USING btree ("target_user_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_target_type_idx" ON "audit_logs" USING btree ("target_type");
    CREATE INDEX IF NOT EXISTS "audit_logs_target_id_idx" ON "audit_logs" USING btree ("target_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_ip_hash_idx" ON "audit_logs" USING btree ("ip_hash");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "audit_logs";
  `)
}
