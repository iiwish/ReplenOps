CREATE TABLE "wecom_auth_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "corp_id" TEXT NOT NULL DEFAULT '',
    "agent_id" TEXT NOT NULL DEFAULT '',
    "encrypted_secret" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_login" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wecom_auth_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wecom_auth_config_singleton" CHECK ("id" = 1)
);

CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_identities_provider_organization_id_subject_id_key"
    ON "external_identities"("provider", "organization_id", "subject_id");
CREATE UNIQUE INDEX "external_identities_user_id_provider_organization_id_key"
    ON "external_identities"("user_id", "provider", "organization_id");
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wecom_auth_challenges" (
    "id" TEXT NOT NULL,
    "browser_hash" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "subject_id" TEXT,
    "return_path" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wecom_auth_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wecom_auth_challenges_stage" CHECK (
      ("stage" = 'oauth' AND "subject_id" IS NULL) OR
      ("stage" = 'bind' AND "subject_id" IS NOT NULL)
    )
);
CREATE INDEX "wecom_auth_challenges_expires_at_idx" ON "wecom_auth_challenges"("expires_at");
