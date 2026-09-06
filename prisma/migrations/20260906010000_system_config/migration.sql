-- CreateTable
CREATE TABLE "system_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(80) NOT NULL DEFAULT 'ReplenOps',
    "logo_path" TEXT NOT NULL DEFAULT '/brand/logo.svg',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- Keep a single default configuration available after migration.
INSERT INTO "system_config" ("id", "name", "logo_path", "updated_at")
VALUES (1, 'ReplenOps', '/brand/logo.svg', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
