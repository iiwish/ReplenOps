-- Keep the internal string primary key for existing relationships while exposing a stable numeric code.
ALTER TABLE "users" ADD COLUMN "code" SERIAL NOT NULL;

CREATE UNIQUE INDEX "users_code_key" ON "users"("code");
